#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# @brief 协调系统启动和关闭
#
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


ROBOT_CLOUD_BACKEND = ROOT / "app" / "robot-cloud" / "后端"
ROBOT_CLOUD_FRONTEND = ROOT / "app" / "robot-cloud" / "前端"

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


def _robot_cloud_backend_port() -> int:
    env_path = ROBOT_CLOUD_BACKEND / ".env"
    if env_path.exists():
        return _parse_env_port(env_path, 3001)
    example = ROBOT_CLOUD_BACKEND / ".env.example"
    if example.exists():
        return _parse_env_port(example, 3001)
    return 3001

def _robot_cloud_backend_ports() -> dict:
    env_path = ROBOT_CLOUD_BACKEND / ".env"
    example = ROBOT_CLOUD_BACKEND / ".env.example"
    src = env_path if env_path.exists() else example

    defaults = {
        "http": 9000,
    }
    if not src or not src.exists():
        return defaults
    return {
        "http": _parse_env_value(src, "PORT", defaults["http"]),
    }

def _robot_cloud_frontend_port() -> int:
    vite_path = ROBOT_CLOUD_FRONTEND / "vite.config.ts"
    return _parse_vite_port(vite_path, 5174)


def start_robot_cloud() -> List[Tuple[str, int]]:
    确保目录存在()
    if 复制env_example_如果没有(ROBOT_CLOUD_BACKEND):
        # 首次创建 .env 即退出，等待用户配置
        return []

    ports = _robot_cloud_backend_ports()
    if not 确保端口可用(ports, interactive=True):
        return []

    确保node_modules存在(ROBOT_CLOUD_BACKEND)
    确保node_modules存在(ROBOT_CLOUD_FRONTEND)

    procs: List[Tuple[str, int]] = []

    print(f"🚀 启动机器狗管理系统后端...  (http://localhost:{ports['http']})")
    backend_log = LOGS_DIR / "robot-cloud" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=ROBOT_CLOUD_BACKEND, log_path=backend_log)
    write_pid("robot-cloud-backend", pid_backend)
    procs.append(("robot-cloud-backend", pid_backend))

    print(f"🚀 启动机器狗管理系统前端...  (http://localhost:{_robot_cloud_frontend_port()})")
    frontend_log = LOGS_DIR / "robot-cloud" / "frontend.log"
    p_frontend, pid_frontend = spawn(["npm", "run", "dev", "--", "--port", str(_robot_cloud_frontend_port())], cwd=ROBOT_CLOUD_FRONTEND, log_path=frontend_log)
    write_pid("robot-cloud-frontend", pid_frontend)
    procs.append(("robot-cloud-frontend", pid_frontend))

    return procs


def stop_robot_cloud() -> bool:
    any_stopped = False
    any_stopped |= kill_pid_file("robot-cloud-backend")
    any_stopped |= kill_pid_file("robot-cloud-frontend")
    return any_stopped


def stop_all() -> None:
    stopped_any = stop_robot_cloud()

    pkill_patterns(["vite", "ts-node-dev"])
    if stopped_any:
        print("✅ 所有服务已停止")
    else:
        print("ℹ️  没有运行中的服务")


def start_all() -> List[Tuple[str, int]]:
    检查运行环境()
    print("========================================")
    print("  机器狗控制系统 - 启动")
    print("========================================")

    print("\n----------------------------------------")
    print("  📦 准备机器狗管理系统 (Robot Cloud)")
    print("----------------------------------------")
    procs = start_robot_cloud()
    return procs


def test_all() -> bool:
    print("========================================")
    print("  机器狗控制系统 - 自检")
    print("========================================")

    print("🧪 测试机器狗管理系统 (Robot Cloud)...")
    ports = _robot_cloud_backend_ports()
    cfp = _robot_cloud_frontend_port()
    ok = http_ok(f"http://localhost:{ports['http']}/api/v1/health")
    ok &= http_ok(f"http://localhost:{cfp}")
    print("✅ 机器狗管理系统通过" if ok else "❌ 机器狗管理系统异常")
    return ok
