#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# @brief 协调系统启动和关闭
#
from pathlib import Path
from typing import Dict, List, Tuple
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
)


DANCE_BACKEND = ROOT / "app" / "dance-choreo" / "backend"
DANCE_FRONTEND = ROOT / "app" / "dance-choreo" / "frontend"
CHAT_BACKEND = ROOT / "app" / "robot-chat" / "backend"
CHAT_FRONTEND = ROOT / "app" / "robot-chat" / "frontend"


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

    print("🚀 启动编舞系统后端...  (http://localhost:3000)")
    backend_log = LOGS_DIR / "dance-choreo" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=DANCE_BACKEND, log_path=backend_log)
    write_pid("dance-backend", pid_backend)
    procs.append(("dance-backend", pid_backend))

    print("🚀 启动编舞系统前端...  (http://localhost:5173)")
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

    ensure_node_modules(CHAT_BACKEND)
    ensure_node_modules(CHAT_FRONTEND)

    procs: List[Tuple[str, int]] = []

    print("🚀 启动对话系统后端...  (http://localhost:3001)")
    backend_log = LOGS_DIR / "robot-chat" / "backend.log"
    p_backend, pid_backend = spawn(["npm", "run", "dev"], cwd=CHAT_BACKEND, log_path=backend_log)
    write_pid("chat-backend", pid_backend)
    procs.append(("chat-backend", pid_backend))

    print("🚀 启动对话系统前端...  (http://localhost:5174)")
    frontend_log = LOGS_DIR / "robot-chat" / "frontend.log"
    p_frontend, pid_frontend = spawn(["npm", "run", "dev", "--", "--port", "5174"], cwd=CHAT_FRONTEND, log_path=frontend_log)
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
        print("\n========================================")
        print("  📦 准备编舞系统 (Dance Choreo)")
        print("========================================")
        procs += start_dance()
    if app in ("all", "chat"):
        print("\n========================================")
        print("  📦 准备对话系统 (Robot Chat)")
        print("========================================")
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
        ok_all &= http_ok("http://localhost:3000/health")
        ok_all &= http_ok("http://localhost:3000/api/projects")
        ok_all &= http_ok("http://localhost:5173")
        print("✅ 编舞系统通过" if ok_all else "❌ 编舞系统异常")
    if app in ("all", "chat"):
        print("🧪 测试对话系统 (Robot Chat)...")
        ok_chat = http_ok("http://localhost:3001/health")
        ok_chat &= http_ok("http://localhost:5174")
        print("✅ 对话系统通过" if ok_chat else "❌ 对话系统异常")
        ok_all &= ok_chat
    return ok_all

