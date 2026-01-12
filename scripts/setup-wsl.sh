#!/bin/bash

# WSL2 环境配置脚本
# 适用于 Windows Subsystem for Linux 2

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

# 检查是否在WSL环境
check_wsl() {
    if ! grep -qi microsoft /proc/version; then
        print_error "此脚本仅适用于 WSL 环境"
        exit 1
    fi
    
    print_success "确认 WSL 环境"
    
    # 显示WSL版本信息
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_info "发行版: $NAME $VERSION"
    fi
}

# 检查镜像网络模式
check_network_mode() {
    print_info "检查网络模式..."
    
    # 获取IP地址
    WSL_IP=$(hostname -I | awk '{print $1}')
    print_info "WSL IP: $WSL_IP"
    
    # 提示用户检查镜像模式
    echo ""
    print_warning "如果您使用 Windows 11，建议启用镜像网络模式"
    print_info "这样可以让局域网设备直接访问 WSL 中的服务"
    echo ""
    echo "启用方法："
    echo "  1. 在 Windows 中搜索 'wsl settings'"
    echo "  2. 开启 '镜像网络' 选项"
    echo "  3. 在 PowerShell 中运行: wsl --shutdown"
    echo "  4. 重新打开 WSL"
    echo ""
    
    read -p "已经配置好镜像网络模式了吗？(y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_success "已确认镜像网络模式"
    else
        print_warning "建议配置镜像网络模式后再继续"
        read -p "是否继续安装？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
}

# 安装基础工具
install_basic_tools() {
    print_info "更新软件包列表..."
    sudo apt update
    
    print_info "安装基础工具..."
    sudo apt install -y \
        curl \
        wget \
        git \
        build-essential \
        python-is-python3 \
        python3-pip \
        net-tools \
        iputils-ping
    
    print_success "基础工具安装完成"
}

# 配置WSL特定设置
configure_wsl_settings() {
    print_info "配置 WSL 设置..."
    
    # 创建或更新 .wslconfig (在Windows用户目录下)
    print_info "WSL 配置文件位置: /mnt/c/Users/<用户名>/.wslconfig"
    print_info "建议配置内容："
    echo ""
    echo "[wsl2]"
    echo "memory=4GB"
    echo "processors=2"
    echo "networkingMode=mirrored"
    echo ""
    
    # 创建 wsl.conf (在WSL内部)
    if [ ! -f /etc/wsl.conf ]; then
        print_info "创建 /etc/wsl.conf..."
        sudo tee /etc/wsl.conf > /dev/null << 'EOF'
[boot]
systemd=true

[network]
generateResolvConf=true

[interop]
enabled=true
appendWindowsPath=true
EOF
        print_success "已创建 /etc/wsl.conf"
        print_warning "需要重启 WSL 才能生效 (在 PowerShell 运行: wsl --shutdown)"
    else
        print_info "/etc/wsl.conf 已存在"
    fi
}

# 检查Windows互操作性
check_windows_interop() {
    print_info "检查 Windows 互操作性..."
    
    # 测试是否能执行Windows命令
    if command -v cmd.exe &> /dev/null; then
        print_success "Windows 互操作性正常"
        
        # 获取Windows用户名
        WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
        print_info "Windows 用户: $WIN_USER"
    else
        print_warning "无法访问 Windows 命令"
    fi
}

# 配置防火墙提示
show_firewall_info() {
    echo ""
    print_info "防火墙配置提示:"
    echo "----------------------------------------"
    echo "如果局域网设备无法访问 WSL 服务，可能需要在 Windows 中配置防火墙："
    echo ""
    echo "在 PowerShell (管理员) 中运行:"
    echo ""
    echo "# 允许特定端口 (例如 3000, 5173)"
    echo "New-NetFirewallRule -DisplayName \"WSL Port 3000\" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow"
    echo "New-NetFirewallRule -DisplayName \"WSL Port 5173\" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow"
    echo ""
    echo "或者，允许整个端口范围 (3000-9000):"
    echo "New-NetFirewallRule -DisplayName \"WSL Ports\" -Direction Inbound -LocalPort 3000-9000 -Protocol TCP -Action Allow"
    echo "----------------------------------------"
    echo ""
}

# 显示网络信息
show_network_info() {
    print_info "网络信息:"
    echo "----------------------------------------"
    
    # WSL IP
    WSL_IP=$(hostname -I | awk '{print $1}')
    echo "WSL IP: $WSL_IP"
    
    # Windows IP (通过默认网关)
    WIN_IP=$(ip route | grep default | awk '{print $3}')
    echo "Windows IP: $WIN_IP"
    
    # 测试网络连接
    if ping -c 1 -W 1 8.8.8.8 &> /dev/null; then
        echo "外网连接: ✓"
    else
        echo "外网连接: ✗"
    fi
    
    echo "----------------------------------------"
    echo ""
    
    print_info "访问 WSL 服务的方式:"
    echo "  • WSL 内部: http://localhost:端口"
    echo "  • Windows: http://localhost:端口 或 http://$WSL_IP:端口"
    echo "  • 局域网: http://$WIN_IP:端口 (需要镜像模式)"
    echo ""
}

# 安装常用开发工具
install_dev_tools() {
    print_info "安装开发工具..."
    
    # 检查并安装 Node.js
    if ! command -v node &> /dev/null; then
        print_info "安装 Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    print_success "Node.js: $(node --version)"
    print_success "npm: $(npm --version)"
    
    # 升级 pip
    print_info "升级 pip..."
    python3 -m pip install --upgrade pip
    
    print_success "Python: $(python --version 2>&1)"
    print_success "pip: $(pip --version | awk '{print $2}')"
}

# 创建快捷命令
create_shortcuts() {
    print_info "创建便捷命令..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    # 添加到 .bashrc
    if [ -f ~/.bashrc ]; then
        if ! grep -q "robot-dog aliases" ~/.bashrc; then
            cat >> ~/.bashrc << EOF

# robot-dog aliases
alias robot-start='cd "$SCRIPT_DIR" && ./start.sh'
alias robot-stop='cd "$SCRIPT_DIR" && ./stop.sh'
alias robot-log='cd "$SCRIPT_DIR" && tail -f logs/*.log'
EOF
            print_success "已添加快捷命令到 ~/.bashrc"
            print_info "运行 'source ~/.bashrc' 或重新打开终端后生效"
        fi
    fi
}

# 主函数
main() {
    print_info "开始 WSL 环境配置..."
    
    # 检查WSL
    check_wsl
    
    # 检查网络模式
    check_network_mode
    
    # 安装基础工具
    install_basic_tools
    
    # 配置WSL设置
    configure_wsl_settings
    
    # 检查Windows互操作
    check_windows_interop
    
    # 安装开发工具
    install_dev_tools
    
    # 创建快捷命令
    create_shortcuts
    
    # 显示网络信息
    show_network_info
    
    # 显示防火墙信息
    show_firewall_info
    
    print_success "WSL 环境配置完成！"
    echo ""
    print_warning "建议步骤："
    print_info "1. 在 Windows PowerShell 中运行: wsl --shutdown"
    print_info "2. 重新打开 WSL"
    print_info "3. 运行: source ~/.bashrc"
    print_info "4. 继续执行项目安装"
    echo ""
}

main
