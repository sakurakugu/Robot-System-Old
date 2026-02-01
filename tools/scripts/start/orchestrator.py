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
    ensure_dirs,
    ensure_node_modules,
    copy_env_example_if_missing,
    run,
    spawn,
    write_pid,
    kill_pid_file,
    http_ok,
    pkill_patterns,
    check_env,
    ensure_ports_available,
)


CHAT_BACKEND = ROOT / "app" / "robot-cloud" / "后端"
CHAT_FRONTEND = ROOT / "app" / "robot-cloud" / "前端"

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


def _chat_backend_port() -> int:
    env_path = CHAT_BACKEND / ".env"
    if env_path.exists():
        return _parse_env_port(env_path, 3001)
    example = CHAT_BACKEND / ".env.example"
    if example.exists():
        return _parse_env_port(example, 3001)
    return 3001

def _chat_backend_ports() -> dict:
    env_path = CHAT_BACKEND / ".env"
    example = CHAT_BACKEND / ".env.example"
    src = env_path if env_path.exists() else example

    defaults = {
        "http": 9004,
        "control": 9000,
        "business": 9001,
        "audio_upload": 9002,
        "audio_download": 9003,
    }
    if not src or not src.exists():
        return defaults
    return {
        "http": _parse_env_value(src, "PORT", defaults["http"]),
        "control": _parse_env_value(src, "CONTROL_PORT", defaults["control"]),
        "business": _parse_env_value(src, "BUSINESS_PORT", defaults["business"]),
        "audio_upload": _parse_env_value(src, "AUDIO_UPLOAD_PORT", defaults["audio_upload"]),
        "audio_download": _parse_env_value(src, "AUDIO_DOWNLOAD_PORT", defaults["audio_download"]),
    }

def _chat_frontend_port() -> int:
    vite_path = CHAT_FRONTEND / "vite.config.ts"
    return _parse_vite_port(vite_path, 5174)


def start_chat() -> List[Tuple[str, int]]:
    ensure_dirs()
    if copy_env_example_if_missing(CHAT_BACKEND):
        # 首次创建 .env 即退出，等待用户配置
        return []

    ports = _chat_backend_ports()
    if not ensure_ports_available(ports, interactive=True):
        return []

    ensure_node_modules(CHAT_BACKEND)
    ensure_node_modules(CHAT_FRONTEND)

    procs: List[Tuple[str, int]] = []

    print(f"🚀 启动对话系统后端...  (http://localhost:{ports['http']})")
    backend_log = LOGS_DIR / "robot-cloud" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=CHAT_BACKEND, log_path=backend_log)
    write_pid("chat-backend", pid_backend)
    procs.append(("chat-backend", pid_backend))

    print(f"🚀 启动对话系统前端...  (http://localhost:{_chat_frontend_port()})")
    frontend_log = LOGS_DIR / "robot-cloud" / "frontend.log"
    p_frontend, pid_frontend = spawn(["npm", "run", "dev", "--", "--port", str(_chat_frontend_port())], cwd=CHAT_FRONTEND, log_path=frontend_log)
    write_pid("chat-frontend", pid_frontend)
    procs.append(("chat-frontend", pid_frontend))

    return procs


def stop_chat() -> bool:
    any_stopped = False
    any_stopped |= kill_pid_file("chat-backend")
    any_stopped |= kill_pid_file("chat-frontend")
    return any_stopped


def stop_all() -> None:
    stopped_any = stop_chat()

    pkill_patterns(["vite", "ts-node-dev"])
    if stopped_any:
        print("✅ 所有服务已停止")
    else:
        print("ℹ️  没有运行中的服务")


def start_all() -> List[Tuple[str, int]]:
    check_env()
    print("========================================")
    print("  机器狗控制系统 - 启动")
    print("========================================")

    print("\n----------------------------------------")
    print("  📦 准备对话系统 (Robot Cloud)")
    print("----------------------------------------")
    procs = start_chat()
    return procs


def test_all() -> bool:
    print("========================================")
    print("  机器狗控制系统 - 自检")
    print("========================================")

    print("🧪 测试对话系统 (Robot Cloud)...")
    ports = _chat_backend_ports()
    cfp = _chat_frontend_port()
    ok = http_ok(f"http://localhost:{ports['http']}/api/v1/health")
    ok &= http_ok(f"http://localhost:{cfp}")
    print("✅ 对话系统通过" if ok else "❌ 对话系统异常")
    return ok
