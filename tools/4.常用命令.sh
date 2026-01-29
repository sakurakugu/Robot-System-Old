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

ensure_rsync() {
    if ! command -v rsync &> /dev/null; then
        print_info "未检测到 rsync，正在尝试安装..."
        if [ -f /etc/debian_version ]; then
            sudo apt-get update && sudo apt-get install -y rsync
        elif [ -f /etc/redhat-release ]; then
            sudo yum install -y rsync
        else
            echo "无法自动安装 rsync，请手动安装: rsync"
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

iso_now() {
    timestamp=$(date '+%Y-%m-%dT%H:%M:%S%:z')
    echo ${timestamp//Z/+00:00}
}

get_project_root() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$script_dir/.." && pwd
}

backup_all() {
    local root="$1"
    local dest="$2"
    ensure_rsync
    rsync -a "$root/" "$dest/"
}

backup_exclude_common() {
    local root="$1"
    local dest="$2"
    ensure_rsync
    rsync -a \
        --exclude 'node_modules/' \
        --exclude 'build/' \
        --exclude '__pycache__/' \
        --exclude 'dist/' \
        --exclude '.venv/' \
        --exclude 'venv/' \
        --exclude '.pytest_cache/' \
        "$root/" "$dest/"
}

backup_exclude_gitignore() {
    local root="$1"
    local dest="$2"
    ensure_rsync
    if [ -d "$root/.git" ] && command -v git &> /dev/null; then
        local tmp_exclude
        tmp_exclude="$(mktemp)"
        git -C "$root" ls-files -i --exclude-standard --directory > "$tmp_exclude"
        rsync -a --exclude-from="$tmp_exclude" "$root/" "$dest/"
        rm -f "$tmp_exclude"
    else
        print_info ".git 或 git 未检测到，回退为完整备份"
        rsync -a "$root/" "$dest/"
    fi
}

backup_menu() {
    local root
    root="$(get_project_root)"
    local default_name
    default_name="$(basename "$root")"
    echo ""
    echo "------------------------------------------"
    echo "备份选项:"
    echo "  1) 备份全部"
    echo "  2) 排除常见目录"
    echo "  3) 按 .gitignore 排除"
    echo "------------------------------------------"
    read -p "请选择备份类型: " btype
    case "$btype" in
        1)
            read -p "备份目录名(回车使用默认: $default_name): " bname
            bname="${bname:-$default_name}"
            local timestamp
            timestamp="$(iso_now)"
            local dest_base
            dest_base="$root/../backups/$bname/$timestamp"
            mkdir -p "$dest_base"
            print_info "目标: $dest_base"
            backup_all "$root" "$dest_base"
            ;;
        2)
            read -p "备份目录名(回车使用默认: $default_name): " bname
            bname="${bname:-$default_name}"
            local timestamp
            timestamp="$(iso_now)"
            local dest_base
            dest_base="$root/../backups/$bname/$timestamp"
            mkdir -p "$dest_base"
            print_info "目标: $dest_base"
            backup_exclude_common "$root" "$dest_base"
            ;;
        3)
            read -p "备份目录名(回车使用默认: $default_name): " bname
            bname="${bname:-$default_name}"
            local timestamp
            timestamp="$(iso_now)"
            local dest_base
            dest_base="$root/../backups/$bname/$timestamp"
            mkdir -p "$dest_base"
            print_info "目标: $dest_base"
            backup_exclude_gitignore "$root" "$dest_base"
            ;;
        *)
            echo "无效选项"
            return
            ;;
    esac
    print_success "备份完成"
}

fix_common_errors() {
    local root
    root="$(get_project_root)"
    echo ""
    echo "------------------------------------------"
    echo "修复常见错误:"
    echo "  1) 修复 Git refs/heads/main:Zone.Identifier"
    echo "  2) 修改 Git 上次提交日志"
    echo "  0) 返回"
    echo "------------------------------------------"
    read -p "请选择修复项: " ftype
    case "$ftype" in
        1)
            if [ -d "$root/.git" ]; then
                rm -f "$root/.git/refs/heads/main:Zone.Identifier"
                if [ -f "$root/.git/packed-refs" ]; then
                    sed -i '/refs\/heads\/main:Zone.Identifier/d' "$root/.git/packed-refs"
                fi
                git -C "$root" fetch --prune --tags origin
                print_success "已尝试修复 Git 引用损坏"
            else
                echo "未检测到 .git 目录"
            fi
            ;;
        2)
            git_amend_commit
            ;;
        0)
            return
            ;;
        *)
            echo "无效选项"
            ;;
    esac
}

# Git 相关功能
git_amend_commit() {
    local root
    root="$(get_project_root)"
    if [ -d "$root/.git" ]; then
        print_info "当前分支: $(git -C "$root" branch --show-current)"
        read -p "按回车开始修改（ “i” 插入，“Esc + :wq” 保存）: "
        git -C "$root" commit --amend
        print_success "已更新上次提交日志"
            
        read -p "是否需要安全推送 (git push --force-with-lease)? (y/N): " push_choice
        if [ "$push_choice" = "y" ] || [ "$push_choice" = "Y" ]; then
            git -C "$root" push --force-with-lease
            if [ $? -eq 0 ]; then
                print_success "已安全推送更新"
            else
                echo "推送失败，请检查网络连接或权限"
            fi
        fi
    else
        echo "未检测到 .git 目录，不是 Git 仓库"
    fi
}

# 显示菜单
show_menu() {
    echo ""
    echo "=========================================="
    echo "    机器狗项目 - 常用命令"
    echo "=========================================="
    echo ""
    echo "  1) SSH 连接机器狗 (firefly@$ROBOT_IP)"
    echo "  2) 备份当前项目文件夹"
    echo "  3) 修复常见错误"
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
        2)
            backup_menu
            ;;
        3)
            fix_common_errors
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
