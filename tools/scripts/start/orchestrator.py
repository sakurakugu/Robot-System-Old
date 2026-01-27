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
    is_port_in_use,
    ensure_ports_available,
)


DANCE_BACKEND = ROOT / "app" / "dance-choreo" / "backend"
DANCE_FRONTEND = ROOT / "app" / "dance-choreo" / "frontend"
CHAT_BACKEND = ROOT / "app" / "robot-chat" / "cloud" / "backend"
CHAT_FRONTEND = ROOT / "app" / "robot-chat" / "cloud" / "frontend"

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

def _parse_ts_default_port(ts_config_path: Path, default_port: int) -> int:
    text = _read_text(ts_config_path)
    import re
    m = re.search(r"parseInt\(\s*process\.env\.PORT\s*\|\|\s*'(\d+)'\s*,\s*10\s*\)", text)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    return default_port

def _dance_backend_port() -> int:
    ts_path = DANCE_BACKEND / "src" / "config" / "index.ts"
    return _parse_ts_default_port(ts_path, 3000)

def _dance_frontend_port() -> int:
    vite_path = DANCE_FRONTEND / "vite.config.ts"
    return _parse_vite_port(vite_path, 5173)

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


def start_dance() -> List[Tuple[str, int]]:
    ensure_dirs()
    ensure_node_modules(DANCE_BACKEND)
    ensure_node_modules(DANCE_FRONTEND)

    dist_init = DANCE_BACKEND / "dist" / "database" / "init.js"
    if not dist_init.exists():
        print("🗄️  编译 TypeScript...")
        run(["npm", "run", "build"], cwd=DANCE_BACKEND, check=True)
    run(["npm", "run", "init-db"], cwd=DANCE_BACKEND, check=True)

    procs: List[Tuple[str, int]] = []

    print(f"🚀 启动编舞系统后端...  (http://localhost:{_dance_backend_port()})")
    backend_log = LOGS_DIR / "dance-choreo" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=DANCE_BACKEND, log_path=backend_log)
    write_pid("dance-backend", pid_backend)
    procs.append(("dance-backend", pid_backend))

    print(f"🚀 启动编舞系统前端...  (http://localhost:{_dance_frontend_port()})")
    frontend_log = LOGS_DIR / "dance-choreo" / "frontend.log"
    p_frontend, pid_frontend = spawn(["npm", "run", "dev"], cwd=DANCE_FRONTEND, log_path=frontend_log)
    write_pid("dance-frontend", pid_frontend)
    procs.append(("dance-frontend", pid_frontend))

    return procs


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
    backend_log = LOGS_DIR / "robot-chat" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=CHAT_BACKEND, log_path=backend_log)
    write_pid("chat-backend", pid_backend)
    procs.append(("chat-backend", pid_backend))

    print(f"🚀 启动对话系统前端...  (http://localhost:{_chat_frontend_port()})")
    frontend_log = LOGS_DIR / "robot-chat" / "frontend.log"
    p_frontend, pid_frontend = spawn(["npm", "run", "dev", "--", "--port", str(_chat_frontend_port())], cwd=CHAT_FRONTEND, log_path=frontend_log)
    write_pid("chat-frontend", pid_frontend)
    procs.append(("chat-frontend", pid_frontend))

    return procs


def stop_dance() -> bool:
    any_stopped = False
    any_stopped |= kill_pid_file("dance-backend")
    any_stopped |= kill_pid_file("dance-frontend")
    return any_stopped


def stop_chat() -> bool:
    any_stopped = False
    any_stopped |= kill_pid_file("chat-backend")
    any_stopped |= kill_pid_file("chat-frontend")
    return any_stopped


def stop_all(app: str) -> None:
    stopped_any = False
    if app in ("all", "dance"):
        stopped_any |= stop_dance()
    if app in ("all", "chat"):
        stopped_any |= stop_chat()

    pkill_patterns(["vite", "ts-node-dev"])
    if stopped_any:
        print("✅ 所有服务已停止")
    else:
        print("ℹ️  没有运行中的服务")


def start_all(app: str) -> List[Tuple[str, int]]:
    check_env()
    print("========================================")
    print(f"  机器狗控制系统 - 启动: {app}")
    print("========================================")

    procs: List[Tuple[str, int]] = []
    if app in ("all", "dance"):
        print("\n----------------------------------------")
        print("  📦 准备编舞系统 (Dance Choreo)")
        print("----------------------------------------")
        procs += start_dance()
    if app in ("all", "chat"):
        print("\n----------------------------------------")
        print("  📦 准备对话系统 (Robot Chat)")
        print("----------------------------------------")
        started = start_chat()
        # 如果返回空，可能是 .env 刚创建
        if not started and (CHAT_BACKEND / ".env").exists():
            pass
        procs += started
    return procs


def test_all(app: str) -> bool:
    print("========================================")
    print(f"  机器狗控制系统 - 自检: {app}")
    print("========================================")
    ok_all = True

    if app in ("all", "dance"):
        print("🧪 测试编舞系统 (Dance Choreo)...")
        dbp = _dance_backend_port()
        dfp = _dance_frontend_port()
        ok_all &= http_ok(f"http://localhost:{dbp}/health")
        ok_all &= http_ok(f"http://localhost:{dbp}/api/projects")
        ok_all &= http_ok(f"http://localhost:{dfp}")
        print("✅ 编舞系统通过" if ok_all else "❌ 编舞系统异常")
    if app in ("all", "chat"):
        print("🧪 测试对话系统 (Robot Chat)...")
        cbp = _chat_backend_port()
        cfp = _chat_frontend_port()
        ok_chat = http_ok(f"http://localhost:{cbp}/health")
        ok_chat &= http_ok(f"http://localhost:{cfp}")
        print("✅ 对话系统通过" if ok_chat else "❌ 对话系统异常")
        ok_all &= ok_chat
    return ok_all
