import argparse
import json
import socket
import threading
import time
from colorama import init, Fore, Style

# ── 初始化 colorama ─────────────────────────────────────────────────────────────
init(autoreset=True)  # 自动在每次打印后重置颜色

DOG_IP       = "192.168.0.85"
SEND_PORT    = 8081
LISTEN_PORT  = 8080
DATA_PACKAGE = json.dumps({"type": "heartbeat", "heartbeat": 1}).encode()


def receiver(sock: socket.socket, stop_event: threading.Event, max_packets: int):
    received = 0
    type_counter: dict[str, int] = {}

    print(Fore.CYAN + f"\n[RX] 监听 UDP :{LISTEN_PORT} …\n")
    while not stop_event.is_set():
        try:
            sock.settimeout(1.0)
            data, addr = sock.recvfrom(65535)
        except socket.timeout:
            continue
        except OSError:
            break

        received += 1
        try:
            obj = json.loads(data.decode("utf-8", errors="replace"))
            pkt_type = obj.get("type", "<unknown>")
            type_counter[pkt_type] = type_counter.get(pkt_type, 0) + 1

            if type_counter[pkt_type] <= 3:
                print(Fore.GREEN + f"[RX #{received:04d}] {addr}  type={pkt_type}")
                pretty = json.dumps(obj, ensure_ascii=False, indent=2)
                if len(pretty) > 600:
                    pretty = pretty[:600] + "\n  … (truncated)"
                print(Fore.GREEN + pretty + "\n")
        except json.JSONDecodeError:
            print(Fore.RED + f"[RX #{received:04d}] {addr}  <非 JSON，{len(data)} bytes>")
            print(Fore.RED + str(data[:120]) + "\n")

        if max_packets > 0 and received >= max_packets:
            stop_event.set()
            break

    print(Fore.CYAN + "\n── 接收统计 ──────────────────────────────")
    print(Fore.CYAN + f"总计收到 {received} 个包")
    for t, c in sorted(type_counter.items(), key=lambda x: -x[1]):
        print(Fore.CYAN + f"  {t:30s}: {c}")
    print(Fore.CYAN + "──────────────────────────────────────────")


def main():
    print("\033]0;测试数据包\007")
    parser = argparse.ArgumentParser(description="机器狗数据包测试")
    parser.add_argument("--dog-ip",   default=DOG_IP,  help="机器狗 IP")
    parser.add_argument("--count",    type=int, default=5,   help="发送数据包次数（0=无限）")
    parser.add_argument("--interval", type=float, default=0.2, help="发送间隔(秒)")
    parser.add_argument("--rx-max",   type=int, default=0,
                        help="最多接收多少包后停止（0=跟随发送完成后再等 3 秒）")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(("", LISTEN_PORT))
    except OSError as e:
        print(Fore.RED + f"[ERROR] 无法绑定 UDP :{LISTEN_PORT}  ->  {e}")
        print(Fore.RED + "        请检查端口是否被占用，或用管理员权限运行。")
        return

    stop_event = threading.Event()
    rx_thread = threading.Thread(
        target=receiver, args=(sock, stop_event, args.rx_max), daemon=True
    )
    rx_thread.start()

    total = args.count if args.count > 0 else float("inf")
    sent = 0
    print(Fore.MAGENTA + f"[TX] 发送数据包  ->  {args.dog_ip}:{SEND_PORT}")
    print(Fore.MAGENTA + f"     payload = {DATA_PACKAGE.decode()}")
    print(Fore.MAGENTA + f"     count={args.count}  interval={args.interval}s\n")

    try:
        while sent < total:
            sock.sendto(DATA_PACKAGE, (args.dog_ip, SEND_PORT))
            sent += 1
            print(Fore.YELLOW + f"[TX #{sent:04d}] sent data package")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print(Fore.RED + "\n[TX] 用户中断发送")

    wait = 3.0
    print(Fore.MAGENTA + f"\n[TX] 发送完毕，等待 {wait}s 接收剩余回包 …")
    time.sleep(wait)
    stop_event.set()
    rx_thread.join(timeout=2)
    sock.close()
    print(Fore.CYAN + "[DONE]")


if __name__ == "__main__":
    main()
