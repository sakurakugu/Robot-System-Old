#!/bin/bash

# 依赖检查脚本
# 检查项目所需的所有依赖是否已安装

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[信息]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# 统计
PASSED=0
FAILED=0
WARNINGS=0

# 检查命令是否存在
check_command() {
    local cmd=$1
    local name=$2
    local required=$3
    
    if command -v $cmd &> /dev/null; then
        local version=$($cmd --version 2>&1 | head -n 1)
        print_success "$name: $version"
        PASSED=$((PASSED + 1))
        return 0
    else
        if [ "$required" = "true" ]; then
            print_error "$name 未安装 (必需)"
            FAILED=$((FAILED + 1))
        else
            print_warning "$name 未安装 (可选)"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

# 检查Python版本
check_python_version() {
    if command -v python3 &> /dev/null; then
        local version=$(python3 --version 2>&1 | awk '{print $2}')
        local major_minor=$(echo $version | cut -d. -f1,2)
        
        if [ "$major_minor" = "3.10" ]; then
            print_success "Python: $version (推荐版本)"
            PASSED=$((PASSED + 1))
        else
            print_warning "Python: $version (推荐 3.10.x)"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        print_error "Python 未安装"
        FAILED=$((FAILED + 1))
    fi
}

# 检查Node.js版本
check_nodejs_version() {
    if command -v node &> /dev/null; then
        local version=$(node --version | cut -d'v' -f2)
        local major=$(echo $version | cut -d'.' -f1)
        
        if [ "$major" -ge 24 ]; then
            print_success "Node.js: v$version"
            PASSED=$((PASSED + 1))
        else
            print_warning "Node.js: v$version (推荐 >= 24.x)"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        print_error "Node.js 未安装"
        FAILED=$((FAILED + 1))
    fi
}

# 检查npm包
check_npm_packages() {
    local dir=$1
    local name=$2
    
    if [ -d "$dir/node_modules" ]; then
        print_success "$name: 依赖已安装"
        PASSED=$((PASSED + 1))
    else
        print_warning "$name: 需要运行 npm install"
        WARNINGS=$((WARNINGS + 1))
    fi
}

# 检查Python包
check_python_package() {
    local package=$1
    local name=$2
    local required=$3
    
    if python3 -c "import $package" 2>/dev/null; then
        print_success "$name: 已安装"
        PASSED=$((PASSED + 1))
    else
        if [ "$required" = "true" ]; then
            print_error "$name: 未安装 (必需)"
            FAILED=$((FAILED + 1))
        else
            print_warning "$name: 未安装 (可选)"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
}

# 检查文件/目录
check_path() {
    local path=$1
    local name=$2
    local required=$3
    
    if [ -e "$path" ]; then
        print_success "$name: 存在"
        PASSED=$((PASSED + 1))
    else
        if [ "$required" = "true" ]; then
            print_error "$name: 不存在 (必需)"
            FAILED=$((FAILED + 1))
        else
            print_warning "$name: 不存在 (可选)"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
}

# 检查端口
check_port() {
    local port=$1
    local name=$2
    
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            print_warning "$name (端口 $port): 已被占用"
            WARNINGS=$((WARNINGS + 1))
        else
            print_success "$name (端口 $port): 可用"
            PASSED=$((PASSED + 1))
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            print_warning "$name (端口 $port): 已被占用"
            WARNINGS=$((WARNINGS + 1))
        else
            print_success "$name (端口 $port): 可用"
            PASSED=$((PASSED + 1))
        fi
    else
        print_info "$name (端口 $port): 无法检查"
    fi
}

# 检查系统环境
check_system_env() {
    echo ""
    echo "=========================================="
    echo "  系统环境检查"
    echo "=========================================="
    
    # 操作系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_info "操作系统: $NAME $VERSION"
    fi
    
    # WSL检测
    if grep -qi microsoft /proc/version 2>/dev/null; then
        print_info "环境: WSL"
    else
        print_info "环境: 物理机/虚拟机"
    fi
    
    # 内核
    print_info "内核: $(uname -r)"
    
    # 架构
    print_info "架构: $(uname -m)"
    
    echo ""
}

# 检查基础工具
check_basic_tools() {
    echo "=========================================="
    echo "  基础工具"
    echo "=========================================="
    
    check_command "bash" "Bash" true
    check_command "git" "Git" true
    check_command "curl" "curl" true
    check_command "wget" "wget" false
    
    echo ""
}

# 检查编程语言环境
check_programming_env() {
    echo "=========================================="
    echo "  编程语言环境"
    echo "=========================================="
    
    check_python_version
    check_command "pip" "pip" true
    check_nodejs_version
    check_command "npm" "npm" true
    
    echo ""
}

# 检查项目依赖
check_project_deps() {
    echo "=========================================="
    echo "  项目依赖"
    echo "=========================================="
    
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
    
    # Node.js项目依赖
    check_npm_packages "$PROJECT_ROOT/app/dance-choreo/backend" "后端 - Dance Chore"
    check_npm_packages "$PROJECT_ROOT/app/dance-choreo/frontend" "前端 - Dance Chore"
    check_npm_packages "$PROJECT_ROOT/app/robot-chat/cloud/backend" "后端 - Robot Chat"
    check_npm_packages "$PROJECT_ROOT/app/robot-chat/cloud/frontend" "前端 - Robot Chat"
    
    # Python包
    check_python_package "numpy" "NumPy" false
    check_python_package "requests" "Requests" false
    
    echo ""
}

# 检查项目文件
check_project_files() {
    echo "=========================================="
    echo "  项目文件"
    echo "=========================================="
    
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
    SCRIPT_DIR="$PROJECT_ROOT/tools/scripts/setup"
    
    check_path "$PROJECT_ROOT/app/dance-choreo/backend/src/index.ts" "机器人编舞后端入口文件" true
    check_path "$PROJECT_ROOT/app/dance-choreo/frontend/src/main.ts" "机器人编舞前端入口文件" true
    check_path "$PROJECT_ROOT/app/robot-chat/cloud/backend/src/server.ts" "机器人聊天后端入口文件" true
    check_path "$PROJECT_ROOT/app/robot-chat/cloud/frontend/src/main.ts" "机器人聊天前端入口文件" true
    # check_path "$PROJECT_ROOT/app/robot-control" "机器狗控制目录" true
    check_path "$PROJECT_ROOT/start.sh" "启动脚本" true
    
    echo ""
}

# 检查端口占用
check_ports() {
    echo "=========================================="
    echo "  端口检查"
    echo "=========================================="
    
    check_port 3000 "后端端口"
    check_port 5173 "前端端口"
    check_port 8080 "可选端口"
    
    echo ""
}

# 检查网络连接
check_network() {
    echo "=========================================="
    echo "  网络连接"
    echo "=========================================="
    
    if ping -c 1 -W 2 8.8.8.8 &> /dev/null; then
        print_success "外网连接: 正常"
        PASSED=$((PASSED + 1))
    else
        print_warning "外网连接: 失败"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if ping -c 1 -W 2 baidu.com &> /dev/null; then
        print_success "DNS 解析: 正常"
        PASSED=$((PASSED + 1))
    else
        print_warning "DNS 解析: 失败"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    echo ""
}

# 显示摘要
show_summary() {
    echo "=========================================="
    echo "  检查摘要"
    echo "=========================================="
    echo ""
    
    echo -e "${GREEN}通过: $PASSED${NC}"
    echo -e "${YELLOW}警告: $WARNINGS${NC}"
    echo -e "${RED}失败: $FAILED${NC}"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            print_success "所有检查通过！环境已就绪。"
        else
            print_warning "环境基本就绪，但有 $WARNINGS 个警告项。"
        fi
        echo ""
        print_info "可以运行: ./start.sh 启动项目"
    else
        print_error "有 $FAILED 个必需项未满足，请先安装缺失的依赖。"
        echo ""
        print_info "运行安装脚本: ./setup.sh"
    fi
    
    echo ""
}

# 主函数
main() {
    clear
    echo ""
    echo "=========================================="
    echo "  机器狗项目 - 依赖检查"
    echo "=========================================="
    echo ""
    
    check_system_env
    check_basic_tools
    check_programming_env
    check_project_deps
    check_project_files
    check_ports
    check_network
    show_summary
}

main
