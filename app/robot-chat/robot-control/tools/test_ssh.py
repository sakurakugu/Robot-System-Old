#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import argparse
import subprocess


def ensure_package(pkg, import_name=None):
    if import_name is None:
        import_name = pkg
    try:
        __import__(import_name)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


def main():
    parser = argparse.ArgumentParser(description="测试 SSH 连接")
    parser.add_argument("--ip", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    ensure_package("paramiko")
    import paramiko  # noqa: E402

    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=args.ip,
            username=args.username,
            password=args.password,
            timeout=7,
        )
        client.close()
        print(f"SSH 连接成功: {args.name} ({args.ip})")
        sys.exit(0)
    except Exception as e:
        print(f"SSH 连接失败: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

