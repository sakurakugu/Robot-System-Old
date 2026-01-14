#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
机器人连接测试脚本
用于验证机器人配置是否正确
"""

from lib.api import CrazyRobotDog
import sys

def test_robot_connection(name, robot_ip, local_port):
    """
    测试单个机器人连接
    
    Args:
        name: 机器人名称
        robot_ip: 机器人IP地址
        local_port: 本地端口
        
    Returns:
        bool: 连接是否成功
    """
    try:
        print(f"正在测试机器人: {name}")
        print(f"  机器人IP: {robot_ip}")
        print(f"  本地端口: {local_port}")
        
        dog = CrazyRobotDog(
            name=name,
            robot_ip=robot_ip,
            local_port=local_port
        )
        
        print(f"✓ 机器人 {name} 连接成功!")
        return True
        
    except Exception as e:
        print(f"✗ 机器人 {name} 连接失败: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    # 示例配置
    test_configs = [
        {
            "name": "131",
            "robot_ip": "192.168.1.110",
            "local_port": 10131
        },
        {
            "name": "47",
            "robot_ip": "192.168.1.116",
            "local_port": 10047
        }
    ]
    
    print("=" * 50)
    print("机器人连接测试")
    print("=" * 50)
    
    success_count = 0
    for config in test_configs:
        if test_robot_connection(**config):
            success_count += 1
        print()
    
    print("=" * 50)
    print(f"测试完成: {success_count}/{len(test_configs)} 台机器人连接成功")
    print("=" * 50)
    
    sys.exit(0 if success_count == len(test_configs) else 1)
