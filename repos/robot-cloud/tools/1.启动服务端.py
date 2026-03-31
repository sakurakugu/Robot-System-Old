import argparse
import sys
import time
from scripts.start.orchestrator import start_all, status_all, stop_all, test_all
from scripts.start.utils import 持续监控直到中断


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="tools/3.启动服务端.py", add_help=False)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--start", "-s", action="store_true")
    group.add_argument("--stop", "-x", action="store_true")
    group.add_argument("--restart", "-r", action="store_true")
    group.add_argument("--status", action="store_true")
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
    elif ns.status:
        return "status"
    elif ns.test:
        return "test"
    elif ns.help:
        return "help"
    return "restart"


def show_help() -> None:
    print("机器狗控制系统 - 统一启动脚本 (Python)")
    print("")
    print("用法：")
    print("  python3 tools/3.启动服务端.py [ACTION]")
    print("")
    print("操作参数 (ACTION):")
    print("  --start, -s       启动服务")
    print("  --stop, -x        停止服务")
    print("  --restart, -r     重启服务（默认）")
    print("  --status          查看本地进程和 PostgreSQL 容器状态")
    print("  --test, -t        运行系统自检")
    print("  --help, -h        显示帮助")
    print("")
    print("说明：")
    print("  默认会先用 Docker 启动仓库根目录 docker-compose.yml 里的 postgres")
    print("  然后再启动本地热更新后端和前端")
    print("")


def main() -> int:
    print("\033]0;服务端\007")
    ns = parse_args()
    action = resolve_action(ns)

    if action == "help":
        show_help()
        return 0

    if action == "stop":
        stop_all()
        return 0

    if action == "status":
        status_all()
        return 0

    if action == "test":
        ok = test_all()
        return 0 if ok else 1

    if action == "restart":
        stop_all()
        time.sleep(2)
        start_all()
        rc = 持续监控直到中断("系统启动完成，开始监控进程")
        try:
            stop_all()
        except KeyboardInterrupt:
            pass
        return rc

    if action == "start":
        start_all()
        rc = 持续监控直到中断("系统启动完成，开始监控进程")
        try:
            stop_all()
        except KeyboardInterrupt:
            pass
        return rc

    show_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
