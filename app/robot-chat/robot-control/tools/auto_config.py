#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import argparse
import subprocess
import re


def ensure_package(pkg, import_name=None):
    if import_name is None:
        import_name = pkg
    try:
        __import__(import_name)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


def exec_cmd(client, cmd, use_sudo=False, password=""):
    if use_sudo:
        cmd = f"echo {password} | sudo -S {cmd}"
    stdin, stdout, stderr = client.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    return code == 0, out, err


def write_file(client, content, target_path, description, password=""):
    temp_path = "/tmp/" + target_path.split("/")[-1]
    ok, _, err = exec_cmd(client, f"cat > {temp_path} << 'EOF'\n{content}\nEOF", password=password)
    if not ok:
        print(f"写入临时文件失败: {err}", file=sys.stderr)
        return False
    ok, _, err = exec_cmd(client, f"cp {temp_path} {target_path}", use_sudo=True, password=password)
    if not ok:
        print(f"复制{description}失败: {err}", file=sys.stderr)
        return False
    return True


def detect_mode(client, start_script):
    ok, out, err = exec_cmd(client, "ip addr show wlan0")
    if not ok:
        print(f"获取网络信息失败: {err}", file=sys.stderr)
        return None
    ip_match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", out)
    ip = ip_match.group(1) if ip_match else None
    if ip and ip.startswith("192.168.234."):
        return "ap"
    ok2, script, err2 = exec_cmd(client, f"cat {start_script}", use_sudo=True)
    if ok2 and "SDK_CLIENT_IP" in script:
        return "wifi"
    return "wifi" if ip else "ap"


def update_sdk_config(client, sdk_config, local_ip, local_port, password=""):
    ok, content, err = exec_cmd(client, f"cat {sdk_config}", use_sudo=True)
    if not ok:
        print(f"读取SDK配置失败: {err}", file=sys.stderr)
        return False
    from ruamel.yaml import YAML  # noqa: E402
    yaml = YAML()
    try:
        data = yaml.load(content) or {}
        data["target_ip"] = str(local_ip)
        data["target_port"] = int(local_port)
        from io import StringIO
        out_stream = StringIO()
        yaml.dump(data, out_stream)
        new_content = out_stream.getvalue()
    except Exception as e:
        print(f"YAML 解析失败: {e}", file=sys.stderr)
        return False
    return write_file(client, new_content, sdk_config, "SDK配置文件", password=password)


def update_start_script(client, start_script, mode, robot_ip, password=""):
    ok, content, err = exec_cmd(client, f"cat {start_script}", use_sudo=True)
    if not ok:
        print(f"读取启动脚本失败: {err}", file=sys.stderr)
        return False
    content = re.sub(r"\nexport SDK_CLIENT_IP=.*\n", "\n", content)
    if mode == "wifi":
        if re.search(r"(export ROBOT_TYPE=\w+)", content):
            content = re.sub(r"(export ROBOT_TYPE=\w+)", r"\1\nexport SDK_CLIENT_IP='{}'".format(robot_ip), content)
        else:
            content = content + f"\nexport SDK_CLIENT_IP='{robot_ip}'\n"
    return write_file(client, content, start_script, "运控启动脚本", password=password)


def main():
    parser = argparse.ArgumentParser(description="自动配置运控与 SDK")
    parser.add_argument("--robot-ip", required=True)
    parser.add_argument("--local-ip", required=True)
    parser.add_argument("--local-port", required=True, type=int)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    ensure_package("paramiko")
    ensure_package("ruamel.yaml", "ruamel.yaml")
    import paramiko  # noqa: E402

    START_SCRIPT = "/opt/app_launch/start_motion_control.sh"
    SDK_CONFIG = "/opt/export/config/sdk_config.yaml"

    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=args.robot_ip,
            username=args.username,
            password=args.password,
            timeout=10,
        )

        mode = detect_mode(client, START_SCRIPT)
        if not mode:
            print("无法检测连接模式", file=sys.stderr)
            sys.exit(1)
        if not update_sdk_config(client, SDK_CONFIG, args.local_ip, args.local_port, password=args.password):
            print("更新SDK配置失败", file=sys.stderr)
            sys.exit(1)
        if not update_start_script(client, START_SCRIPT, mode, args.robot_ip, password=args.password):
            print("更新运控脚本失败", file=sys.stderr)
            sys.exit(1)
        client.close()
        print(f"[MODE:{mode}] 自动配置完成: 模式={mode}, target_ip={args.local_ip}, target_port={args.local_port}")
        sys.exit(0)
    except Exception as e:
        print(f"自动配置异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
