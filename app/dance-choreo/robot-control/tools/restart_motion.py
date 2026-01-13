#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import argparse
import subprocess


def ensure_package(pkg, import_name=None):
    if import_name is None:
        import_name = pkg
    try:
        __import__(import_name)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


def main():
    parser = argparse.ArgumentParser(description="重启运控")
    parser.add_argument("--robot-ip", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    ensure_package("paramiko")
    import paramiko  # noqa: E402

    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=args.robot_ip,
            username=args.username,
            password=args.password,
            timeout=10,
        )
        cmd = f"echo {args.password} | sudo -S robot-launch restart 4"
        stdin, stdout, stderr = client.exec_command(cmd)
        code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="ignore")
        err = stderr.read().decode("utf-8", errors="ignore")
        client.close()
        if code == 0:
            print("运控重启成功")
            sys.exit(0)
        else:
            print(err or "运控重启失败", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

