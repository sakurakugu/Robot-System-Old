#!/usr/bin/env python3
import argparse
import signal
import sys
import time
from pathlib import Path
from typing import List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.utils import ROOT
from scripts.orchestrator import start_all, stop_all, test_all


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="tools/3.启动前后端.py", add_help=False)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--start", "-s", action="store_true")
    group.add_argument("--stop", "-x", action="store_true")
    group.add_argument("--restart", "-r", action="store_true")
    group.add_argument("--test", "-t", action="store_true")
    group.add_argument("--help", "-h", action="store_true")
    parser.add_argument("--all", "-a", dest="app_all", action="store_true")
    parser.add_argument("--dance", "-d", dest="app_dance", action="store_true")
    parser.add_argument("--chat", "-c", dest="app_chat", action="store_true")
    return parser.parse_args()


def resolve_action_and_app(ns: argparse.Namespace) -> Tuple[str, str]:
    action = "restart"
    if ns.start:
        action = "start"
    elif ns.stop:
        action = "stop"
    elif ns.restart:
        action = "restart"
    elif ns.test:
        action = "test"
    elif ns.help:
        action = "help"

    app = "all"
    if ns.app_dance:
        app = "dance"
    elif ns.app_chat:
        app = "chat"
    elif ns.app_all:
        app = "all"
    return action, app


def show_help() -> None:
    print("机器狗控制系统 - 统一启动脚本 (Python)")
    print("")
    print("用法：")
    print("  python3 tools/3.启动前后端.py [ACTION] [APP]")
    print("")
    print("操作参数 (ACTION):")
    print("  --start, -s       启动服务（默认重启）")
    print("  --stop, -x        停止服务")
    print("  --restart, -r     重启服务")
    print("  --test, -t        运行系统自检")
    print("  --help, -h        显示帮助")
    print("")
    print("应用参数 (可选):")
    print("  --all, -a         启动所有系统 (默认)")
    print("  --dance, -d       只启动编舞系统 (端口: 3000/5173)")
    print("  --chat, -c        只启动对话系统 (端口: 3001/5174)")
    print("")


def monitor(pids: List[Tuple[str, int]]) -> int:
    """监控进程，等待用户中断"""
    print("")
    print("========================================")
    print("  ✅ 系统启动完成，开始监控进程")
    print("========================================")
    print("按 Ctrl+C 停止所有服务")
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n正在停止服务...")
        return 130


def main() -> int:
    ns = parse_args()
    action, app = resolve_action_and_app(ns)

    if action == "help":
        show_help()
        return 0

    if action == "stop":
        stop_all(app)
        return 0

    if action == "test":
        ok = test_all(app)
        return 0 if ok else 1

    if action == "restart":
        stop_all(app)
        time.sleep(2)
        pids = start_all(app)
        rc = monitor(pids)
        stop_all(app)
        return rc

    if action == "start":
        pids = start_all(app)
        rc = monitor(pids)
        stop_all(app)
        return rc

    show_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
