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
from pathlib import Path
from typing import Iterable, Optional, Tuple
from urllib import request, error

ROOT: Path = Path(__file__).resolve().parents[1]
LOGS_DIR: Path = ROOT / "logs"
PID_DIR: Path = LOGS_DIR / "pid"


def ensure_dirs() -> None:
    """确保日志目录和 PID 目录存在"""
    (ROOT / "logs" / "dance-choreo").mkdir(parents=True, exist_ok=True)
    (ROOT / "logs" / "robot-chat").mkdir(parents=True, exist_ok=True)
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


def spawn(cmd: Iterable[str], cwd: Path, log_path: Path) -> Tuple[subprocess.Popen, int]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "a", buffering=1)
    proc = subprocess.Popen(
        list(cmd),
        cwd=str(cwd),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
    )
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

