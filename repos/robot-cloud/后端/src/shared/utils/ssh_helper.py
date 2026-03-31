#!/usr/bin/env python3
"""
SSH连接辅助工具 - 自动处理机器狗的SSH连接和文件传输
"""
import sys
import json
import paramiko
import os
import io

# 默认SSH配置
SSH_USER = 'firefly'
SSH_PASSWORD = 'firefly'
SSH_PORT = 22

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

def test_ssh_connection(robot_ip):
    """测试SSH连接"""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=robot_ip,
            port=SSH_PORT,
            username=SSH_USER,
            password=SSH_PASSWORD,
            timeout=5,
            look_for_keys=False,
            allow_agent=False
        )
        client.close()
        return True
    except Exception as e:
        print(f"SSH连接失败: {str(e)}", file=sys.stderr)
        return False

def execute_remote_command(robot_ip, command):
    """在远程机器上执行命令并返回输出"""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=robot_ip,
            port=SSH_PORT,
            username=SSH_USER,
            password=SSH_PASSWORD,
            timeout=10,
            look_for_keys=False,
            allow_agent=False
        )
        
        stdin, stdout, stderr = client.exec_command(command)
        output = stdout.read().decode('utf-8').strip()
        error = stderr.read().decode('utf-8').strip()
        exit_code = stdout.channel.recv_exit_status()
        
        client.close()
        
        if exit_code != 0 and error:
            raise Exception(error)
        
        return output
    except Exception as e:
        raise Exception(f"执行远程命令失败: {str(e)}")

def write_remote_file(robot_ip, remote_path, content):
    """写入远程文件"""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=robot_ip,
            port=SSH_PORT,
            username=SSH_USER,
            password=SSH_PASSWORD,
            timeout=10,
            look_for_keys=False,
            allow_agent=False
        )
        
        sftp = client.open_sftp()
        
        # 确保目录存在
        remote_dir = os.path.dirname(remote_path)
        if remote_dir:
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                # 递归创建目录
                parts = remote_dir.split('/')
                current = ''
                for part in parts:
                    if not part:
                        continue
                    current = current + '/' + part if current else '/' + part
                    try:
                        sftp.stat(current)
                    except FileNotFoundError:
                        sftp.mkdir(current)
        
        # 写入文件
        with sftp.file(remote_path, 'w') as f:
            f.write(content)
        
        sftp.close()
        client.close()
        return True
    except Exception as e:
        raise Exception(f"写入远程文件失败: {str(e)}")

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': '参数不足'
        }))
        sys.exit(1)
    
    action = sys.argv[1]
    
    try:
        if action == 'test':
            # 测试SSH连接
            # python ssh_helper.py test <robot_ip>
            if len(sys.argv) < 3:
                raise Exception('缺少robot_ip参数')
            robot_ip = sys.argv[2]
            result = test_ssh_connection(robot_ip)
            print(json.dumps({
                'success': True,
                'connected': result
            }))
        
        elif action == 'exec':
            # 执行远程命令
            # python ssh_helper.py exec <robot_ip> <command>
            if len(sys.argv) < 4:
                raise Exception('缺少参数')
            robot_ip = sys.argv[2]
            command = sys.argv[3]
            output = execute_remote_command(robot_ip, command)
            print(json.dumps({
                'success': True,
                'output': output
            }))
        
        elif action == 'write':
            # 写入远程文件
            # python ssh_helper.py write <robot_ip> <remote_path> <content>
            if len(sys.argv) < 5:
                raise Exception('缺少参数')
            robot_ip = sys.argv[2]
            remote_path = sys.argv[3]
            content = sys.argv[4]
            write_remote_file(robot_ip, remote_path, content)
            print(json.dumps({
                'success': True
            }))
        
        else:
            raise Exception(f'未知操作: {action}')
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
