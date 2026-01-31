"""
mDNS 服务发现脚本

用于扫描局域网内的 SparkRobot 机器人设备。
通过 robot-cloud 后端调用此脚本来发现机器人。
"""
import json
import sys
import time
from typing import Any

from zeroconf import ServiceBrowser, ServiceListener, Zeroconf

# mDNS 服务类型（与 robot-server 保持一致）
SERVICE_TYPE = "_sparkrobot._tcp.local."

# 发现超时时间（秒）
DEFAULT_TIMEOUT = 3.0


class RobotListener(ServiceListener):
    """机器人服务监听器"""

    def __init__(self):
        self.robots: dict[str, dict[str, Any]] = {}

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """发现新服务"""
        info = zc.get_service_info(type_, name)
        if info:
            self._process_service(info)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """服务更新"""
        info = zc.get_service_info(type_, name)
        if info:
            self._process_service(info)

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """服务移除"""
        # 从名称中提取标识
        service_id = name.replace(f".{SERVICE_TYPE}", "")
        if service_id in self.robots:
            del self.robots[service_id]

    def _process_service(self, info) -> None:
        """处理服务信息"""
        # 解析 TXT 记录中的属性
        properties: dict[str, str] = {}
        if info.properties:
            for key, value in info.properties.items():
                if isinstance(key, bytes):
                    key = key.decode("utf-8", errors="ignore")
                if isinstance(value, bytes):
                    value = value.decode("utf-8", errors="ignore")
                properties[key] = value

        # 获取 IP 地址
        addresses = []
        if info.addresses:
            import socket
            for addr in info.addresses:
                try:
                    ip = socket.inet_ntoa(addr)
                    addresses.append(ip)
                except Exception:
                    pass

        # 优先使用属性中的 IP，否则使用解析的地址
        ip = properties.get("ip") or (addresses[0] if addresses else "")
        port = int(properties.get("port", info.port or 8080))

        robot_uuid = properties.get("uuid", "")
        if not robot_uuid:
            return

        robot_data = {
            "uuid": robot_uuid,
            "name": properties.get("name", f"机器狗-{robot_uuid[:4]}"),
            "model": properties.get("model", "agibot-d1"),
            "version": properties.get("version", "0.0.0"),
            "ip": ip,
            "port": port,
            "service_name": info.name,
        }

        self.robots[robot_uuid] = robot_data


def discover_robots(timeout: float = DEFAULT_TIMEOUT) -> list[dict[str, Any]]:
    """
    发现局域网内的机器人

    Args:
        timeout: 扫描超时时间（秒）

    Returns:
        发现的机器人列表
    """
    zeroconf = Zeroconf()
    listener = RobotListener()

    try:
        ServiceBrowser(zeroconf, SERVICE_TYPE, listener)
        time.sleep(timeout)
        return list(listener.robots.values())
    finally:
        zeroconf.close()


def main():
    """主函数 - 命令行入口"""
    # 解析参数
    timeout = DEFAULT_TIMEOUT
    if len(sys.argv) > 1:
        try:
            timeout = float(sys.argv[1])
        except ValueError:
            pass

    # 发现机器人
    robots = discover_robots(timeout)

    # 输出 JSON 结果
    result = {
        "success": True,
        "robots": robots,
        "count": len(robots),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
