#!/bin/bash

# Python 3.10 环境配置脚本
# 适用于非Ubuntu 22.04的系统

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

PYTHON_VERSION="3.10.19"

# 检查是否已安装pyenv
check_pyenv() {
    if command -v pyenv &> /dev/null; then
        print_success "pyenv 已安装"
        return 0
    fi
    return 1
}

# 检查Python版本
check_python_version() {
    if command -v python3 &> /dev/null; then
        CURRENT_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        MAJOR_MINOR=$(echo $CURRENT_VERSION | cut -d. -f1,2)

        if [ "$MAJOR_MINOR" = "3.10" ]; then
            print_success "已安装 Python $CURRENT_VERSION"

            read -p "是否继续安装 pyenv 版本管理工具？(y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "跳过 Python 环境配置"
                exit 0
            fi
        fi
    fi
}

# 安装编译依赖
install_dependencies() {
    print_info "安装编译 Python 所需的依赖..."

    sudo apt update
    sudo apt install -y \
        build-essential \
        libssl-dev \
        zlib1g-dev \
        libncurses5-dev \
        libncursesw5-dev \
        libreadline-dev \
        libsqlite3-dev \
        libgdbm-dev \
        libdb5.3-dev \
        libbz2-dev \
        libexpat1-dev \
        liblzma-dev \
        tk-dev \
        libffi-dev \
        wget \
        curl \
        git \
        python-is-python3

    print_success "依赖安装完成"
}

# 安装pyenv
install_pyenv() {
    print_info "安装 pyenv..."

    # 尝试使用官方安装脚本
    if curl -fsSL https://pyenv.run | bash; then
        print_success "使用官方脚本安装成功"
    else
        print_warning "官方脚本安装失败，尝试从 GitHub 克隆..."

        # 从 GitHub 直接克隆
        if [ -d "$HOME/.pyenv" ]; then
            print_warning "~/.pyenv 目录已存在，正在删除..."
            rm -rf "$HOME/.pyenv"
        fi

        git clone https://github.com/pyenv/pyenv.git ~/.pyenv || {
            print_error "pyenv 安装失败，请检查网络连接"
            exit 1
        }

        # 编译动态 bash 扩展以加速 pyenv（可选）
        cd ~/.pyenv && src/configure && make -C src || true

        # 安装 pyenv-virtualenv 插件
        git clone https://github.com/pyenv/pyenv-virtualenv.git ~/.pyenv/plugins/pyenv-virtualenv || true

        print_success "从 GitHub 克隆安装成功"
    fi

    # 配置shell
    SHELL_CONFIG=""
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_CONFIG="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        SHELL_CONFIG="$HOME/.bashrc"
    fi

    if [ -n "$SHELL_CONFIG" ]; then
        # 检查是否已经配置
        if ! grep -q "pyenv init" "$SHELL_CONFIG"; then
            print_info "配置 $SHELL_CONFIG..."
            cat >> "$SHELL_CONFIG" << 'EOF'

# pyenv 配置
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv virtualenv-init -)"
EOF
            print_success "已配置 $SHELL_CONFIG"
        else
            print_info "pyenv 配置已存在"
        fi
    fi

    # 立即加载配置
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init --path)"
    eval "$(pyenv virtualenv-init -)" 2>/dev/null || true

    # 验证安装
    if ! command -v pyenv &> /dev/null; then
        print_error "pyenv 安装失败，无法找到 pyenv 命令"
        exit 1
    fi

    print_success "pyenv 安装完成，版本: $(pyenv --version)"
}

# 确保pyenv环境已加载
ensure_pyenv() {
    if ! command -v pyenv &> /dev/null; then
        export PYENV_ROOT="$HOME/.pyenv"
        export PATH="$PYENV_ROOT/bin:$PATH"

        if [ -f "$PYENV_ROOT/bin/pyenv" ]; then
            eval "$(pyenv init --path)"
            eval "$(pyenv virtualenv-init -)" 2>/dev/null || true
        else
            print_error "找不到 pyenv，请先运行安装"
            exit 1
        fi
    fi
}

# 安装Python 3.10
install_python() {
    ensure_pyenv

    print_info "安装 Python $PYTHON_VERSION..."
    print_warning "这可能需要 2-6 分钟，请耐心等待..."

    # 检查缓存目录
    mkdir -p ~/.pyenv/cache

    # 检查是否需要手动下载
    PYTHON_TAR="Python-${PYTHON_VERSION}.tgz"
    CACHE_FILE="$HOME/.pyenv/cache/$PYTHON_TAR"

    if [ ! -f "$CACHE_FILE" ]; then
        print_info "下载 Python 源码..."
        wget "https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_TAR}" \
             -O "$CACHE_FILE" || {
            print_warning "下载失败，尝试从镜像下载..."
            wget "https://npm.taobao.org/mirrors/python/${PYTHON_VERSION}/${PYTHON_TAR}" \
                 -O "$CACHE_FILE"
        }
    fi

    # 更新pyenv
    pyenv update

    # 安装Python
    pyenv install $PYTHON_VERSION

    print_success "Python $PYTHON_VERSION 安装完成"
}

# 配置Python版本
configure_python() {
    ensure_pyenv

    print_info "配置 Python 版本..."

    echo ""
    echo "请选择配置方式："
    echo "  1) 全局配置 (系统所有终端生效)"
    echo "  2) 项目配置 (仅当前项目目录生效)"
    echo ""
    read -p "请选择 (1/2): " -n 1 -r
    echo ""

    case $REPLY in
        1)
            pyenv global $PYTHON_VERSION
            print_success "已设置全局 Python 版本为 $PYTHON_VERSION"
            ;;
        2)
            PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
            cd "$PROJECT_ROOT"
            pyenv local $PYTHON_VERSION
            print_success "已为项目设置 Python 版本为 $PYTHON_VERSION"
            ;;
        *)
            print_warning "未配置 Python 版本"
            ;;
    esac

    # 验证Python版本
    print_info "当前 Python 版本:"
    python --version
}

# 提示创建虚拟环境
suggest_virtualenv() {
    echo ""
    print_info "提示: 你可以创建虚拟环境来隔离项目依赖"
    print_info "命令: pyenv virtualenv $PYTHON_VERSION robot-workspace-env"
    print_info "激活: pyenv activate robot-workspace-env"
    print_info "退出: pyenv deactivate"
    echo ""
}

# 主函数
main() {
    print_info "开始配置 Python 环境..."

    # 检查当前Python版本
    check_python_version

    # 检查pyenv
    if ! check_pyenv; then
        print_info "未检测到 pyenv"

        # 安装依赖
        install_dependencies

        # 安装pyenv
        install_pyenv
    fi

    # 检查是否已安装目标Python版本
    ensure_pyenv
    if pyenv versions | grep -q "$PYTHON_VERSION"; then
        print_success "Python $PYTHON_VERSION 已安装"
    else
        # 安装Python
        install_python
    fi

    # 配置Python版本
    configure_python

    # 提示虚拟环境
    suggest_virtualenv

    print_success "Python 环境配置完成！"
    print_warning "请重新加载 shell 或打开新终端以使配置生效"
    print_info "运行命令: source ~/.bashrc  或  source ~/.zshrc"
}

main
