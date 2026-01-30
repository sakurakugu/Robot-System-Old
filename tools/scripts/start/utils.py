#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# @brief 工具函数
#
import os
import shutil
import signal
import subprocess
import sys
import time
import threading
from pathlib import Path
from typing import Iterable, Optional, Tuple
from urllib import request, error
import socket

ROOT: Path = Path(__file__).resolve().parents[3]
LOGS_DIR: Path = ROOT / ".cache" / "logs"
PID_DIR: Path = ROOT / ".cache" /"pid"


def ensure_dirs() -> None:
    """确保日志目录和 PID 目录存在"""
    (LOGS_DIR / "dance-choreo").mkdir(parents=True, exist_ok=True)
    (LOGS_DIR / "robot-agent").mkdir(parents=True, exist_ok=True)
    PID_DIR.mkdir(parents=True, exist_ok=True)


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def check_env() -> None:
    if which("node") is None:
        print("❌ 未检测到 Node.js，请先安装 Node.js 24+", file=sys.stderr)
        sys.exit(1)
    if which("npm") is None:
        print("❌ 未检测到 npm，请安装 Node.js(自带 npm)", file=sys.stderr)
        sys.exit(1)
    if which("python3") is None:
        print("❌ 未检测到 Python3，请先安装 Python 3.10+", file=sys.stderr)
        sys.exit(1)

    try:
        node_v = subprocess.check_output(["node", "--version"], text=True).strip()
        py_v = subprocess.check_output(["python3", "--version"], text=True).strip()
        print(f"✅ Node.js 版本: {node_v}")
        print(f"✅ Python 版本: {py_v}")
    except Exception:
        pass


def run(cmd: Iterable[str], cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(list(cmd), cwd=str(cwd) if cwd else None, check=check)


def _tee_stream(stream, log_file, label: str) -> None:
    for line in iter(stream.readline, ""):
        log_file.write(line)
        log_file.flush()
        sys.stdout.write(f"[{label}] {line}")
        sys.stdout.flush()


def _log_label(log_path: Path) -> str:
    parent = log_path.parent.name
    name = log_path.stem
    if parent:
        return f"{parent}:{name}"
    return name


def spawn(cmd: Iterable[str], cwd: Path, log_path: Path) -> Tuple[subprocess.Popen, int]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "a", buffering=1)
    proc = subprocess.Popen(
        list(cmd),
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    if proc.stdout is not None:
        label = _log_label(log_path)
        t = threading.Thread(target=_tee_stream, args=(proc.stdout, log_file, label), daemon=True)
        t.start()
    return proc, proc.pid


def write_pid(name: str, pid: int) -> None:
    PID_DIR.mkdir(parents=True, exist_ok=True)
    (PID_DIR / f"{name}.pid").write_text(str(pid), encoding="utf-8")


def read_pid(name: str) -> Optional[int]:
    f = PID_DIR / f"{name}.pid"
    if f.exists():
        try:
            return int(f.read_text(encoding="utf-8").strip())
        except Exception:
            return None
    return None


def kill_pid_file(name: str) -> bool:
    pid = read_pid(name)
    if pid is None:
        return False
    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(30):
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                break
            time.sleep(0.1)
        (PID_DIR / f"{name}.pid").unlink(missing_ok=True)
        return True
    except ProcessLookupError:
        (PID_DIR / f"{name}.pid").unlink(missing_ok=True)
        return False
    except Exception:
        return False


def ensure_node_modules(dir_path: Path) -> None:
    if not (dir_path / "node_modules").exists():
        print(f"📦 安装依赖: {dir_path}")
        run(["npm", "install"], cwd=dir_path)
    else:
        print(f"📦 依赖已存在: {dir_path}")


def copy_env_example_if_missing(dir_path: Path) -> bool:
    env = dir_path / ".env"
    example = dir_path / ".env.example"
    if not env.exists() and example.exists():
        shutil.copyfile(example, env)
        print("✅ 已创建 .env，请编辑配置后重新运行")
        return True
    return False


def http_ok(url: str, timeout: float = 3.0) -> bool:
    try:
        with request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 400
    except error.URLError:
        return False
    except Exception:
        return False


def pkill_patterns(patterns: Iterable[str]) -> None:
    for p in patterns:
        try:
            subprocess.run(["pkill", "-f", p], check=False)
        except Exception:
            pass


def is_port_in_use(port: int) -> bool:
    """检查本机端口是否被占用（监听）"""
    for host, family in (("127.0.0.1", socket.AF_INET), ("::1", socket.AF_INET6)):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.3)
                if sock.connect_ex((host, port)) == 0:
                    return True
        except Exception:
            continue
    return False


def _read_cmdline(pid: int) -> str:
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            raw = f.read().replace(b"\x00", b" ")
            return raw.decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""


def _listeners_from_ss(port: int) -> list:
    try:
        out = subprocess.check_output(["ss", "-lptn"], text=True)
    except Exception:
        return []
    listeners = []
    for line in out.splitlines():
        if f":{port}" not in line:
            continue
        # users:(("node",pid=1234,fd=20))
        for token in line.split():
            if "pid=" in token:
                try:
                    pid = int(token.split("pid=")[1].split(",")[0].strip(")"))
                    cmdline = _read_cmdline(pid)
                    listeners.append((pid, cmdline))
                except Exception:
                    continue
    return listeners


def _listeners_from_lsof(port: int) -> list:
    try:
        out = subprocess.check_output(["lsof", "-i", f":{port}", "-sTCP:LISTEN", "-n", "-P"], text=True)
    except Exception:
        return []
    listeners = []
    for line in out.splitlines()[1:]:
        cols = line.split()
        if len(cols) < 2:
            continue
        try:
            pid = int(cols[1])
        except Exception:
            continue
        cmdline = _read_cmdline(pid)
        listeners.append((pid, cmdline))
    return listeners


def find_listeners(port: int) -> list:
    listeners = _listeners_from_ss(port)
    if listeners:
        return listeners
    return _listeners_from_lsof(port)


def read_known_pids() -> set:
    pids = set()
    for f in PID_DIR.glob("*.pid"):
        try:
            pids.add(int(f.read_text(encoding="utf-8").strip()))
        except Exception:
            continue
    return pids


def terminate_pid(pid: int) -> bool:
    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(30):
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                return True
            time.sleep(0.1)
        os.kill(pid, signal.SIGKILL)
        return True
    except ProcessLookupError:
        return True
    except Exception:
        return False


def is_managed_process(pid: int, cmdline: str) -> bool:
    if pid in read_known_pids():
        return True
    if not cmdline:
        return False
    markers = [
        str(ROOT / "app" / "robot-cloud"),
        str(ROOT / "app" / "dance-choreo"),
        "ts-node-dev",
        "vite",
    ]
    return any(m in cmdline for m in markers)


def ensure_ports_available(ports: dict, interactive: bool = True) -> bool:
    """确保端口可用。若为本项目进程则自动清理；否则询问确认。"""
    blocked = []
    for name, port in ports.items():
        listeners = find_listeners(port)
        if not listeners:
            continue
        blocked.append((name, port, listeners))

    if not blocked:
        return True

    print("⚠️  发现端口占用:")
    for name, port, listeners in blocked:
        print(f"  - {name}: {port}")
        for pid, cmd in listeners:
            print(f"    pid={pid} cmd={cmd}")

    auto_killed = True
    for name, port, listeners in blocked:
        for pid, cmd in listeners:
            if is_managed_process(pid, cmd):
                ok = terminate_pid(pid)
                print(f"✅ 自动清理 pid={pid} ({name})" if ok else f"❌ 自动清理失败 pid={pid} ({name})")
            else:
                auto_killed = False

    if auto_killed:
        time.sleep(0.5)
        return True

    if not interactive or not sys.stdin.isatty():
        print("❌ 存在非本项目进程占用端口，未自动清理。")
        return False

    resp = input("存在非本项目进程占用端口，是否继续清理？(y/N): ").strip().lower()
    if resp != "y":
        print("❌ 已取消清理，请手动处理端口占用。")
        return False

    for name, port, listeners in blocked:
        for pid, cmd in listeners:
            if not is_managed_process(pid, cmd):
                ok = terminate_pid(pid)
                print(f"✅ 已清理 pid={pid} ({name})" if ok else f"❌ 清理失败 pid={pid} ({name})")
    time.sleep(0.5)
    return True
