import os
import re
import sys
import subprocess

# 匹配中文字符的正则表达式
CHINESE_REGEX = re.compile(r'[\u4e00-\u9fa5]')
# 匹配英文字母的正则表达式
ENGLISH_REGEX = re.compile(r'[a-zA-Z]')

# 忽略模式（功能性注释或指令）
IGNORE_PATTERNS = [
    r'^\s*#!',              # Shebang
    r'^\s*#\s*coding[:=]',  # Python 编码声明
    r'^\s*eslint-',         # ESLint 指令
    r'^\s*prettier-',       # Prettier 指令
    r'^\s*@ts-',            # TypeScript 指令
    r'^\s*@flow',           # Flow 类型检查
    r'^\s*@jest',           # Jest 测试
    r'^\s*@type',           # JSDoc 类型
    r'^\s*@param',          # JSDoc 参数
    r'^\s*@returns',        # JSDoc 返回值
    r'^\s*@format',         # @format
    r'copyright',           # 版权 (放宽匹配)
    r'license',             # 许可证 (放宽匹配)
    r'^\s*http[s]?://',     # URL链接
    r'^\s*TODO',            # TODO
    r'^\s*FIXME',           # FIXME
    r'^\s*type:\s*ignore',  # Python 类型检查忽略
    r'^\s*noqa',            # Flake8 检查忽略
    r'^\s*pylint',          # Pylint 检查忽略
]

def has_chinese(text):
    """判断是否包含中文字符"""
    return bool(CHINESE_REGEX.search(text))

def is_pure_english(text):
    """
    判断是否为纯英文注释
    规则：包含英文字母且不包含中文字符
    """
    text = text.strip()
    if not text:
        return False

    # 检查忽略模式
    for pattern in IGNORE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return False

    return bool(ENGLISH_REGEX.search(text)) and not has_chinese(text)

def get_staged_files():
    """获取暂存区的文件列表"""
    try:
        # 获取暂存区文件列表
        result = subprocess.run(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], capture_output=True, text=True, encoding='utf-8')
        if result.returncode != 0:
            return []
        return [f.strip() for f in result.stdout.splitlines() if f.strip()]
    except Exception as e:
        print(f"执行 git 命令出错: {e}")
        return []

def get_all_files(root_dir):
    """
    获取项目下所有相关文件
    优先使用 git ls-files 获取文件列表，以自动处理 .gitignore
    如果 git 命令失败，则回退到 os.walk
    """
    # 尝试使用 git ls-files
    try:
        # 获取已跟踪的文件 (cached) 和未跟踪但未被忽略的文件 (others --exclude-standard)
        # -c: cached (已跟踪)
        # -o: others (未跟踪)
        # --exclude-standard: 使用标准 git 排除规则 (.gitignore 等)
        result = subprocess.run(
            ['git', 'ls-files', '-c', '-o', '--exclude-standard'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            cwd=root_dir # 确保在指定目录下运行
        )

        if result.returncode == 0:
            files = []
            for f in result.stdout.splitlines():
                f = f.strip()
                if not f:
                    continue
                full_path = os.path.join(root_dir, f)
                if os.path.isfile(full_path):
                    files.append(full_path)
            return files
    except Exception as e:
        print(f"尝试使用 git ls-files 失败: {e}，将回退到普通扫描模式")

    # 回退到 os.walk
    files = []
    # 需要排除的目录
    exclude_dirs = {
        'node_modules', 'dist', 'build', '__pycache__', 'venv', 'env',
        '.git', '.idea', '.vscode', 'coverage', 'android', 'ios'
    }

    for root, dirs, filenames in os.walk(root_dir):
        # 修改 dirs 列表以跳过排除的目录
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in exclude_dirs]

        for filename in filenames:
            files.append(os.path.join(root, filename))
    return files

def check_file(filepath):
    """检查单个文件是否存在纯英文注释"""
    ext = os.path.splitext(filepath)[1].lower()

    # 根据扩展名定义注释风格
    single_line_comment = None
    multi_line_start = None
    multi_line_end = None

    # C风格注释
    if ext in ['.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.swift', '.kt', '.php', '.scala', '.dart', '.css', '.scss', '.less']:
        single_line_comment = '//'
        multi_line_start = '/*'
        multi_line_end = '*/'
    # 脚本风格注释
    elif ext in ['.py', '.rb', '.pl', '.sh', '.yaml', '.yml', '.dockerfile']:
        single_line_comment = '#'
    # HTML风格注释
    elif ext in ['.html', '.xml', '.vue']:
        multi_line_start = '<!--'
        multi_line_end = '-->'
        single_line_comment = '//' # 简单处理脚本标签内的注释
    else:
        return [] # 跳过不支持的文件类型

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except UnicodeDecodeError:
        return [] # 跳过二进制或非UTF-8文件
    except Exception as e:
        print(f"读取文件出错 {filepath}: {e}")
        return []

    errors = []
    in_multi_line = False

    # 新增：用于存储多行注释块
    multi_line_block = []

    # 新增：用于存储连续的单行注释块
    comment_block = []

    def process_comment_block(block):
        """
        处理收集到的注释块
        block: list of (line_num, content)
        返回: list of errors (line_num, content)
        """
        if not block:
            return []

        # 合并整个块的内容进行检查
        full_text = " ".join([item[1] for item in block])

        # 如果整个块中包含中文，则整个块通过，不报错
        if has_chinese(full_text):
            return []

        # 如果整个块都是纯英文，则每一行都报错
        block_errors = []
        for ln, txt in block:
            if is_pure_english(txt):
                block_errors.append((ln, txt))
        return block_errors

    for i, line in enumerate(lines):
        content = line.strip()

        # 如果是空行，先不打断注释块，继续（允许空行连接注释）
        if not content:
            continue

        # 忽略 Shebang 和 encoding
        if i == 0 and (content.startswith('#!') or 'coding:' in content):
            continue
        if i == 1 and 'coding:' in content:
            continue

        is_comment_line = False
        current_comment_content = ""

        # 多行注释处理
        if multi_line_start and multi_line_end:
            if in_multi_line:
                if multi_line_end in content:
                    # 多行注释结束
                    parts = content.split(multi_line_end)
                    part = parts[0]

                    multi_line_block.append((i + 1, part.strip()))
                    errors.extend(process_comment_block(multi_line_block))
                    multi_line_block = []

                    in_multi_line = False
                else:
                    # 仍在多行注释中
                    multi_line_block.append((i + 1, content.strip()))
                continue

            if multi_line_start in content:
                # 检查是否是单行注释里的多行注释符号
                s_idx = content.find(single_line_comment) if single_line_comment else -1
                m_idx = content.find(multi_line_start)

                if s_idx != -1 and s_idx < m_idx:
                    # 单行注释在先，按单行处理，往下走
                    pass
                else:
                    # 提交之前的单行注释块
                    errors.extend(process_comment_block(comment_block))
                    comment_block = []

                    # 检查是否在引号内
                    parts = content.split(multi_line_start, 1)
                    prefix = parts[0]
                    if prefix.count('"') % 2 != 0 or prefix.count("'") % 2 != 0:
                        # 在字符串内，不是注释，清空块（因为被代码隔开了）
                        continue

                    after_start = parts[1] if len(parts) > 1 else ""

                    if multi_line_end in after_start:
                        # 同一行结束
                        comment_content = after_start.split(multi_line_end)[0]
                        if is_pure_english(comment_content):
                            errors.append((i + 1, comment_content.strip()))
                    else:
                        # 跨行开始
                        in_multi_line = True
                        multi_line_block = []
                        multi_line_block.append((i + 1, after_start.strip()))
                    continue

        # 单行注释处理
        if single_line_comment and single_line_comment in content:
            # 简单过滤 URL
            is_url = False
            if '://' in content and single_line_comment == '//':
                idx = content.find(single_line_comment)
                if idx > 0 and content[idx-1] == ':':
                    is_url = True

            if not is_url:
                parts = content.split(single_line_comment, 1)
                prefix = parts[0]

                # 检查是否是转义的注释符 (例如正则表达式中的 \//)
                if prefix.endswith('\\'):
                    is_comment_line = False
                else:
                    # 简单检查是否在引号内
                    if not (prefix.count('"') % 2 != 0 or prefix.count("'") % 2 != 0):
                        # 是单行注释
                        comment_content = parts[1].strip()
                        is_comment_line = True
                        current_comment_content = comment_content

        if is_comment_line:
            comment_block.append((i + 1, current_comment_content))
        else:
            # 遇到非空行且非注释行，说明注释块中断
            errors.extend(process_comment_block(comment_block))
            comment_block = []

    # 处理文件末尾的注释块
    errors.extend(process_comment_block(comment_block))

    return errors

def main():
    scan_all = False
    # 如果带有 --all 参数，则扫描所有文件
    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        scan_all = True

    if scan_all:
        print("正在扫描项目中的所有文件...")
        files_to_check = get_all_files('.')
    else:
        if not os.path.exists('.git'):
             print("未找到 .git 目录。使用 --all 参数扫描所有文件。")
             sys.exit(0)
        files_to_check = get_staged_files()

    if not files_to_check:
        if scan_all:
             print("未找到需要检查的文件。")
        else:
             print("暂存区中没有文件，跳过检查。")
             print("如果你想扫描所有文件，请使用: python scripts/check_comments.py --all")
        sys.exit(0)

    has_error = False
    error_count = 0

    print(f"正在检查 {len(files_to_check)} 个文件...")

    for filepath in files_to_check:
        if not os.path.exists(filepath):
            continue

        errors = check_file(filepath)
        if errors:
            # 使用蓝色分隔符
            print(f"\n\033[94m{'='*60}\033[0m")
            # print(f"文件: {filepath}")
            for line_num, content in errors:
                display_content = (content[:75] + '..') if len(content) > 75 else content
                # 绿色显示文件路径和行号
                print(f"\033[92m{filepath}:{line_num}\033[0m {display_content}")
                error_count += 1
            has_error = True

    if has_error:
        print(f"\n检查失败: 发现 {error_count} 个纯英文注释。")
        print("请将其翻译为中文或添加中文说明，然后重新提交。")
        sys.exit(1)
    else:
        print("\n检查通过: 未发现纯英文注释。")
        sys.exit(0)

if __name__ == '__main__':
    # 启用 Windows 终端 ANSI 颜色支持
    # os.system("")
    main()
