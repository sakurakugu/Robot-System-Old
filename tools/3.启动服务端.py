#!/usr/bin/env python3
import argparse
import sys
import time
from typing import List, Tuple
from scripts.start.orchestrator import start_all, stop_all, test_all


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="tools/3.启动前后端.py", add_help=False)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--start", "-s", action="store_true")
    group.add_argument("--stop", "-x", action="store_true")
    group.add_argument("--restart", "-r", action="store_true")
    group.add_argument("--test", "-t", action="store_true")
    group.add_argument("--help", "-h", action="store_true")
    return parser.parse_args()


def resolve_action(ns: argparse.Namespace) -> str:
    if ns.start:
        return "start"
    elif ns.stop:
        return "stop"
    elif ns.restart:
        return "restart"
    elif ns.test:
        return "test"
    elif ns.help:
        return "help"
    return "restart"


def show_help() -> None:
    print("机器狗控制系统 - 统一启动脚本 (Python)")
    print("")
    print("用法：")
    print("  python3 tools/3.启动前后端.py [ACTION]")
    print("")
    print("操作参数 (ACTION):")
    print("  --start, -s       启动服务")
    print("  --stop, -x        停止服务")
    print("  --restart, -r     重启服务（默认）")
    print("  --test, -t        运行系统自检")
    print("  --help, -h        显示帮助")
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
    action = resolve_action(ns)

    if action == "help":
        show_help()
        return 0

    if action == "stop":
        stop_all()
        return 0

    if action == "test":
        ok = test_all()
        return 0 if ok else 1

    if action == "restart":
        stop_all()
        time.sleep(2)
        pids = start_all()
        rc = monitor(pids)
        stop_all()
        return rc

    if action == "start":
        pids = start_all()
        rc = monitor(pids)
        stop_all()
        return rc

    show_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
