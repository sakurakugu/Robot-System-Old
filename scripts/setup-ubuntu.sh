#!/bin/bash

# Ubuntu 快速安装脚本
# 适用于 Ubuntu 22.04 或已配置好 Python 3.10 的系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[信息]${NC} $1"; }
print_success() { echo -e "${GREEN}[成功]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
print_error() { echo -e "${RED}[错误]${NC} $1"; }

# 检查系统版本
check_system() {
    print_info "检查系统版本..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_info "操作系统: $NAME $VERSION"
    fi
}

# 安装基础工具
install_basic_tools() {
    print_info "安装基础工具..."
    
    sudo apt update
    sudo apt install -y \
        curl \
        wget \
        git \
        build-essential \
        python-is-python3 \
        python3-pip
    
    print_success "基础工具安装完成"
}

# 检查并安装Node.js
install_nodejs() {
    print_info "检查 Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js 已安装: $NODE_VERSION"
        
        # 检查版本是否满足要求 (>=24.0.0)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -ge 24]; then
            return 0
        else
            print_warning "Node.js 版本过低，建议升级到 24.x 或更高"
        fi
    fi
    
    print_info "安装 Node.js..."
    
    # 安装 Node.js 24.x (LTS)
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt install -y nodejs
    
    print_success "Node.js 安装完成: $(node --version)"
    print_success "npm 版本: $(npm --version)"
}

# 检查并安装Python依赖
check_python() {
    print_info "检查 Python 环境..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python 已安装: $PYTHON_VERSION"
        
        # 检查是否是 Python 3.10
        if python3 --version | grep -q "Python 3.10"; then
            print_success "Python 3.10 已就绪"
        else
            print_warning "建议使用 Python 3.10"
        fi
    else
        print_error "未找到 Python 3"
        exit 1
    fi
    
    # 升级pip
    print_info "升级 pip..."
    python3 -m pip install --upgrade pip
    
    print_success "pip 版本: $(pip --version)"
}

# 安装常用Python包
install_python_packages() {
    print_info "安装常用 Python 包..."
    
    # 安装基础包与接下来脚本需要使用的包
    pip install --user \
        numpy \
        requests \
        paramiko \
        ruamel.yaml
    
    print_success "Python 包安装完成"
}

# 配置Git（可选）
configure_git() {
    print_info "配置 Git..."
    
    if [ -z "$(git config --global user.name)" ]; then
        read -p "请输入 Git 用户名 (直接回车跳过): " git_name
        if [ -n "$git_name" ]; then
            git config --global user.name "$git_name"
        fi
    fi
    
    if [ -z "$(git config --global user.email)" ]; then
        read -p "请输入 Git 邮箱 (直接回车跳过): " git_email
        if [ -n "$git_email" ]; then
            git config --global user.email "$git_email"
        fi
    fi
    
    if [ -n "$(git config --global user.name)" ]; then
        print_success "Git 配置完成"
        print_info "用户名: $(git config --global user.name)"
        print_info "邮箱: $(git config --global user.email)"
    fi
}

# 创建必要的目录
create_directories() {
    print_info "创建必要的目录..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    mkdir -p "$SCRIPT_DIR/logs"
    mkdir -p "$SCRIPT_DIR/data"
    mkdir -p "$SCRIPT_DIR/temp"
    
    print_success "目录创建完成"
}

# 设置脚本权限
set_permissions() {
    print_info "设置脚本执行权限..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    chmod +x "$SCRIPT_DIR/start.sh"
    
    if [ -d "$SCRIPT_DIR/scripts" ]; then
        chmod +x "$SCRIPT_DIR/scripts"/*.sh 2>/dev/null || true
    fi

    if [ -d "$SCRIPT_DIR/tools" ]; then
        chmod +x "$SCRIPT_DIR/tools"/*.sh 2>/dev/null || true
        chmod +x "$SCRIPT_DIR/tools"/*.py 2>/dev/null || true
    fi
    
    print_success "权限设置完成"
}

# 显示系统信息
show_system_info() {
    echo ""
    print_info "系统信息摘要:"
    echo "----------------------------------------"
    echo "Python: $(python --version 2>&1)"
    echo "Node.js: $(node --version 2>&1)"
    echo "npm: $(npm --version 2>&1)"
    echo "Git: $(git --version 2>&1)"
    echo "----------------------------------------"
    echo ""
}

# 主函数
main() {
    print_info "开始 Ubuntu 环境配置..."
    
    # 检查系统
    check_system
    
    # 安装基础工具
    install_basic_tools
    
    # 安装Node.js
    install_nodejs
    
    # 检查Python
    check_python
    
    # 安装Python包
    install_python_packages
    
    # 配置Git
    configure_git
    
    # 创建目录
    create_directories
    
    # 设置权限
    set_permissions
    
    # 显示系统信息
    show_system_info
    
    print_success "Ubuntu 环境配置完成！"
}

main
