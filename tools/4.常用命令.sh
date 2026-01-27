#!/bin/bash

# 机器狗项目 - 常用命令快捷方式

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

# 检查并安装 sshpass
check_sshpass() {
    if ! command -v sshpass &> /dev/null; then
        print_info "未检测到 sshpass，正在尝试安装..."
        if [ -f /etc/debian_version ]; then
            sudo apt-get update && sudo apt-get install -y sshpass
        elif [ -f /etc/redhat-release ]; then
            sudo yum install -y sshpass
        else
            echo "无法自动安装 sshpass，请手动安装: sshpass"
            exit 1
        fi
    fi
}

# 连接机器狗
export ROBOT_IP=192.168.0.85
connect_robot() {
    check_sshpass
    print_info "正在连接机器狗 (firefly@$ROBOT_IP)..."
    # 使用 -o StrictHostKeyChecking=no 可以跳过首次连接的指纹确认，但为了安全起见，这里不强制添加
    # 如果是第一次连接，可能需要手动输入 yes，随后 sshpass 会自动输入密码
    sshpass -p 'firefly' ssh firefly@$ROBOT_IP
}

# 显示菜单
show_menu() {
    echo ""
    echo "=========================================="
    echo "    机器狗项目 - 常用命令"
    echo "=========================================="
    echo ""
    echo "  1) SSH 连接机器狗 (firefly@$ROBOT_IP)"
    echo "  0) 退出"
    echo ""
    echo "=========================================="
}

# 主循环
while true; do
    show_menu
    read -p "请输入选项编号: " choice
    
    case $choice in
        1)
            connect_robot
            ;;
        0)
            print_success "退出脚本"
            exit 0
            ;;
        *)
            echo "无效选项，请重新选择"
            ;;
    esac
    
    echo ""
    read -p "按回车键继续..."
done
