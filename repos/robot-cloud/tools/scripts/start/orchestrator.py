#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# @brief 协调系统启动和关闭
#
import shutil
import subprocess
import time
from pathlib import Path
from typing import List, Tuple
from .utils import (
    ROOT,
    LOGS_DIR,
    确保目录存在,
    确保node_modules存在,
    复制env_example_如果没有,
    spawn,
    write_pid,
    kill_pid_file,
    http_ok,
    pkill_patterns,
    检查运行环境,
    确保端口可用,
)


CLOUD_SERVER_DIR = ROOT
CLOUD_SERVER_BACKEND = ROOT / "后端"
CLOUD_SERVER_FRONTEND = ROOT / "前端"


def _which(cmd: str) -> str | None:
    return shutil.which(cmd)


def _compose_env_path() -> Path:
    env_path = CLOUD_SERVER_DIR / ".env"
    if env_path.exists():
      return env_path
    return CLOUD_SERVER_DIR / ".env.example"


def _compose_env_args() -> List[str]:
    env_path = _compose_env_path()
    return ["--env-file", str(env_path)]


def _ensure_cloud_server_env() -> None:
    env_path = CLOUD_SERVER_DIR / ".env"
    example = CLOUD_SERVER_DIR / ".env.example"
    if not env_path.exists() and example.exists():
        shutil.copyfile(example, env_path)
        print(f"已创建云端 Docker 环境文件: {env_path}")


def _docker_info_ok() -> bool:
    docker = _which("docker")
    if docker is None:
        return False
    result = subprocess.run(
        [docker, "info"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def _ensure_docker_running() -> None:
    if _which("docker") is None:
        raise RuntimeError("未检测到 docker，请先安装 Docker Desktop / Docker Engine")

    if _docker_info_ok():
        return

    docker_desktop = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
    if docker_desktop.exists():
        print("Docker 未运行，正在尝试启动 Docker Desktop...")
        subprocess.Popen([str(docker_desktop)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(30):
            time.sleep(2)
            if _docker_info_ok():
                print("Docker 已启动")
                return

    raise RuntimeError("Docker 未运行，请先启动 Docker 后重试")

def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""

def _parse_vite_port(vite_path: Path, default_port: int) -> int:
    text = _read_text(vite_path)
    import re
    m = re.search(r"server\s*:\s*\{[^}]*port\s*:\s*(\d+)", text, re.S)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    return default_port

def _parse_env_port(env_path: Path, default_port: int) -> int:
    text = _read_text(env_path)
    import re
    m = re.search(r"^PORT\s*=\s*(\d+)\s*$", text, re.M)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    return default_port

def _parse_env_value(env_path: Path, key: str, default_port: int) -> int:
    text = _read_text(env_path)
    import re
    m = re.search(rf"^{key}\s*=\s*(\d+)\s*$", text, re.M)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    return default_port


def _cloud_server_backend_port() -> int:
    env_path = CLOUD_SERVER_BACKEND / ".env"
    if env_path.exists():
        return _parse_env_port(env_path, 3001)
    example = CLOUD_SERVER_BACKEND / ".env.example"
    if example.exists():
        return _parse_env_port(example, 3001)
    return 3001

def _cloud_server_backend_ports() -> dict:
    env_path = CLOUD_SERVER_BACKEND / ".env"
    example = CLOUD_SERVER_BACKEND / ".env.example"
    src = env_path if env_path.exists() else example

    defaults = {
        "http": 9000,
    }
    if not src or not src.exists():
        return defaults
    return {
        "http": _parse_env_value(src, "PORT", defaults["http"]),
    }


def _cloud_server_docker_ports() -> dict:
    src = _compose_env_path()
    defaults = {
        "postgres": 15432,
    }
    if not src.exists():
        return defaults
    return {
        "postgres": _parse_env_value(src, "DB_EXPOSE_PORT", defaults["postgres"]),
    }

def _cloud_server_frontend_port() -> int:
    vite_path = CLOUD_SERVER_FRONTEND / "vite.config.ts"
    return _parse_vite_port(vite_path, 5174)


def start_cloud_server() -> List[Tuple[str, int]]:
    确保目录存在()
    _ensure_cloud_server_env()
    复制env_example_如果没有(CLOUD_SERVER_BACKEND)

    ports = _cloud_server_backend_ports()
    ports.update(_cloud_server_docker_ports())
    if not 确保端口可用(ports, interactive=True):
        return []

    print("检查 Docker / PostgreSQL ...")
    _ensure_docker_running()
    subprocess.run(
        ["docker", "compose", *_compose_env_args(), "up", "-d", "postgres"],
        cwd=str(CLOUD_SERVER_DIR),
        check=True,
    )

    确保node_modules存在(CLOUD_SERVER_BACKEND)
    确保node_modules存在(CLOUD_SERVER_FRONTEND)

    procs: List[Tuple[str, int]] = []

    print(f"启动机器狗管理系统后端...  (http://localhost:{ports['http']})")
    backend_log = LOGS_DIR / "cloud-server" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=CLOUD_SERVER_BACKEND, log_path=backend_log)
    write_pid("cloud-server-backend", pid_backend)
    procs.append(("cloud-server-backend", pid_backend))

    print(f"启动机器狗管理系统前端...  (http://localhost:{_cloud_server_frontend_port()})")
    frontend_log = LOGS_DIR / "cloud-server" / "frontend.log"
    p_frontend, pid_frontend = spawn(["npm", "run", "dev", "--", "--port", str(_cloud_server_frontend_port())], cwd=CLOUD_SERVER_FRONTEND, log_path=frontend_log)
    write_pid("cloud-server-frontend", pid_frontend)
    procs.append(("cloud-server-frontend", pid_frontend))

    return procs


def stop_cloud_server() -> bool:
    any_stopped = False
    any_stopped |= kill_pid_file("cloud-server-backend")
    any_stopped |= kill_pid_file("cloud-server-frontend")
    if _which("docker") is not None and _docker_info_ok():
        subprocess.run(
            ["docker", "compose", *_compose_env_args(), "stop", "postgres"],
            cwd=str(CLOUD_SERVER_DIR),
            check=False,
        )
    return any_stopped


def stop_all() -> None:
    stopped_any = stop_cloud_server()

    pkill_patterns(["vite", "ts-node-dev"])
    if stopped_any:
        print("所有服务已停止")
    else:
        print("没有运行中的服务")


def start_all() -> List[Tuple[str, int]]:
    检查运行环境()
    print("========================================")
    print("  机器狗控制系统 - 启动")
    print("========================================")

    print("\n----------------------------------------")
    print("  准备机器狗管理系统 (Cloud Server)")
    print("----------------------------------------")
    procs = start_cloud_server()
    return procs


def status_all() -> None:
    print("========================================")
    print("  机器狗控制系统 - 状态")
    print("========================================")
    print("Cloud Server 本地进程:")
    for name in ("cloud-server-backend", "cloud-server-frontend"):
        pid = (ROOT / ".cache" / "pid" / f"{name}.pid")
        if pid.exists():
            print(f"  - {name}: pid 文件存在")
        else:
            print(f"  - {name}: 未记录")

    if _which("docker") is None:
        print("Docker: 未安装")
        return

    if not _docker_info_ok():
        print("Docker: 未运行")
        return

    print("PostgreSQL 容器:")
    subprocess.run(
        ["docker", "compose", *_compose_env_args(), "ps", "postgres"],
        cwd=str(CLOUD_SERVER_DIR),
        check=False,
    )


def test_all() -> bool:
    print("========================================")
    print("  机器狗控制系统 - 自检")
    print("========================================")

    print("测试机器狗管理系统 (Cloud Server)...")
    ports = _cloud_server_backend_ports()
    cfp = _cloud_server_frontend_port()
    ok = http_ok(f"http://localhost:{ports['http']}/api/v1/health")
    ok &= http_ok(f"http://localhost:{cfp}")
    print("机器狗管理系统通过" if ok else "机器狗管理系统异常")
    return ok
