#!/bin/bash

# 机器狗项目 - 一键安装脚本
# 自动检测环境并执行相应的安装步骤

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR=$ROOT_DIR/tools/scripts

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        OS=$(uname -s)
    fi
    
    print_info "检测到操作系统: $OS $VER"
}

# 检测是否在WSL环境
is_wsl() {
    if grep -qi microsoft /proc/version; then
        return 0
    fi
    return 1
}

# 显示菜单
show_menu() {
    echo ""
    echo "=========================================="
    echo "    机器狗项目 - 环境安装向导"
    echo "=========================================="
    echo ""
    echo "请选择你的环境类型："
    echo ""
    echo "  1) Ubuntu 22.04 (推荐，无需配置Python)"
    echo "  2) Ubuntu 其他版本 (需要配置Python 3.10)"
    echo "  3) WSL2 (Windows子系统)"
    echo "  4) 仅安装项目依赖 (已有Python 3.10环境)"
    echo "  5) 检查依赖项"
    echo "  6) 更新项目依赖"
    echo "  0) 退出"
    echo ""
    echo "=========================================="
}

# 安装项目依赖
install_project_dependencies() {
    print_info "安装项目依赖..."
    
    # 安装Node.js依赖
    if [ -f "$ROOT_DIR/app/dance-choreo/backend/package.json" ]; then
        print_info "安装后端依赖..."
        cd "$ROOT_DIR/app/dance-choreo/backend"
        npm install
        print_success "后端依赖安装完成"
    fi
    
    if [ -f "$ROOT_DIR/app/dance-choreo/frontend/package.json" ]; then
        print_info "安装前端依赖..."
        cd "$ROOT_DIR/app/dance-choreo/frontend"
        npm install
        print_success "前端依赖安装完成"
    fi

        # 安装Node.js依赖
    if [ -f "$ROOT_DIR/app/robot-chat/cloud/backend/package.json" ]; then
        print_info "安装后端依赖..."
        cd "$ROOT_DIR/app/robot-chat/cloud/backend"
        npm install
        print_success "后端依赖安装完成"
    fi
    
    if [ -f "$ROOT_DIR/app/robot-chat/cloud/frontend/package.json" ]; then
        print_info "安装前端依赖..."
        cd "$ROOT_DIR/app/robot-chat/cloud/frontend"
        npm install
        print_success "前端依赖安装完成"
    fi
    
    # 安装Python依赖（如果有requirements.txt）
    if [ -f "$ROOT_DIR/requirements.txt" ]; then
        print_info "安装Python依赖..."
        cd "$ROOT_DIR"
        pip install -r requirements.txt
        print_success "Python依赖安装完成"
    fi
    
    cd "$ROOT_DIR"
}

# 更新项目依赖
update_project_dependencies() {
    print_info "更新项目依赖..."
    
    # 更新后端依赖
    if [ -f "$ROOT_DIR/app/dance-choreo/backend/package.json" ]; then
        print_info "更新后端依赖..."
        cd "$ROOT_DIR/app/dance-choreo/backend"
        npx ncu
        npx ncu -u
        npm install
        print_success "后端依赖更新完成"
    fi
    
    # 更新前端依赖
    if [ -f "$ROOT_DIR/app/dance-choreo/frontend/package.json" ]; then
        print_info "更新前端依赖..."
        cd "$ROOT_DIR/app/dance-choreo/frontend"
        npx ncu
        npx ncu -u
        npm install
        print_success "前端依赖更新完成"
    fi
    
    # 更新 robot-chat 依赖
    if [ -f "$ROOT_DIR/app/robot-chat/cloud/backend/package.json" ]; then
        print_info "更新 robot-chat 后端依赖..."
        cd "$ROOT_DIR/app/robot-chat/cloud/backend"
        npx ncu
        npx ncu -u
        npm install
        print_success "robot-chat 后端依赖更新完成"
    fi

    if [ -f "$ROOT_DIR/app/robot-chat/cloud/frontend/package.json" ]; then
        print_info "更新 robot-chat 前端依赖..."
        cd "$ROOT_DIR/app/robot-chat/cloud/frontend"
        npx ncu
        npx ncu -u
        npm install
        print_success "robot-chat 前端依赖更新完成"
    fi
    
    cd "$ROOT_DIR"
}

# 主函数
main() {
    print_info "开始环境配置..."
    detect_os
    
    # 自动检测环境
    if [ "$OS" = "ubuntu" ] && [ "$VER" = "22.04" ]; then
        print_info "检测到Ubuntu 22.04，可以直接安装"
        if is_wsl; then
            print_info "检测到WSL环境"
            AUTO_CHOICE="3"
        else
            AUTO_CHOICE="1"
        fi
    elif [ "$OS" = "ubuntu" ]; then
        print_warning "检测到Ubuntu $VER，需要配置Python环境"
        AUTO_CHOICE="2"
    elif is_wsl; then
        print_info "检测到WSL环境"
        AUTO_CHOICE="3"
    fi
    
    # 显示菜单
    show_menu
    
    # 如果有自动检测的选择，提示用户
    if [ ! -z "$AUTO_CHOICE" ]; then
        echo -n "当前已自动选择 [$AUTO_CHOICE]，请输入选项 (直接回车使用建议): "
    else
        echo -n "请输入选项: "
    fi
    
    read choice
    
    # 如果用户直接回车且有建议选项，使用建议选项
    if [ -z "$choice" ] && [ ! -z "$AUTO_CHOICE" ]; then
        choice=$AUTO_CHOICE
    fi
    
    case $choice in
        1)
            print_info "执行 Ubuntu 22.04 快速安装..."
            bash "$SCRIPT_DIR/setup/setup-ubuntu.sh"
            install_project_dependencies
            ;;
        2)
            print_info "执行 Ubuntu Python 环境配置..."
            bash "$SCRIPT_DIR/setup/setup-python.sh"
            bash "$SCRIPT_DIR/setup/setup-ubuntu.sh"
            install_project_dependencies
            ;;
        3)
            print_info "执行 WSL 环境配置..."
            bash "$SCRIPT_DIR/setup/setup-wsl.sh"
            install_project_dependencies
            ;;
        4)
            print_info "仅安装项目依赖..."
            install_project_dependencies
            ;;
        5)
            print_info "检查依赖项..."
            bash "$SCRIPT_DIR/setup/check-dependencies.sh"
            ;;
        6)
            print_info "更新项目依赖..."
            update_project_dependencies
            ;;
        0)
            print_info "退出安装"
            exit 0
            ;;
        *)
            print_error "无效的选项"
            exit 1
            ;;
    esac
    
    echo ""
    print_success "安装完成！"
    echo ""
    print_info "接下来的步骤："
    print_info "1. 运行 ./start.sh 启动项目"
    print_info "2. 查看 docs/2. 连接机器狗.md 了解如何连接机器狗"
    echo ""
}

# 执行主函数
main
