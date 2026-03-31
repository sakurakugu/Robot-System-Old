#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


REPO_CONFIG = {
    "cloud": {
        "label": "云端",
        "scope_order": ["前端", "后端", "文档", "工具", "部署", "旧编舞", "仓库"],
        "scope_map": [
            ("前端/", "前端"),
            ("后端/", "后端"),
            ("docs/", "文档"),
            ("tools/", "工具"),
            ("nginx/", "部署"),
            ("legacy-dance-choreo/", "旧编舞"),
            ("docker-compose.yml", "部署"),
            ("README.md", "仓库"),
            ("AGENTS.md", "仓库"),
            (".gitignore", "仓库"),
        ],
        "summary_overrides": {
            "新增: 添加前端和后端基础架构": "新增: 初始化云端前后端基础架构",
            "新增: 添加机器狗对话系统前端和后端基础结构": "新增: 初始化云端对话系统前后端结构",
            "新增: 初始化React Native机器狗控制应用并调整相关配置": "新增: 调整云端 WebSocket 与语音参数以配合 React Native 手机端接入",
            "新增: 添加uni-app x手机端项目基础结构": "新增: 预留 uni-app 手机端接入所需的云端配置调整",
            "新增: 机器人手机端": "新增: 调整云端接口以支持手机端接入",
            "新增: 更新大模型列表并添加手机端启动脚本": "新增: 更新云端大模型配置并补充配套启动脚本",
            "新增: 将机器人发现功能从后端迁移到手机端": "新增: 从云端移除机器人发现逻辑并迁移到手机端",
            "新增: 实现手机端应用自更新功能": "新增: 提供手机端版本分发与更新管理能力",
            "新增: 实现四轴摇杆控制并提升移动速度范围": "新增: 扩展云端控制指令以支持四轴摇杆参数",
            "新增: 实现目标识别与自动接近功能": "新增: 接入目标识别与自动接近的云端控制链路",
            "新增: 添加视觉模块和音量控制功能": "新增: 补充机器人视觉与音量管理接口",
        },
    },
    "onboard": {
        "label": "本体端",
        "scope_order": ["robot-agent", "robot-server", "sparkrobot-common", "client", "文档", "工具", "旧工具", "仓库"],
        "scope_map": [
            ("robot-agent/", "robot-agent"),
            ("robot-server/", "robot-server"),
            ("sparkrobot-common/", "sparkrobot-common"),
            ("client/", "client"),
            ("docs/", "文档"),
            ("tools/", "工具"),
            ("legacy-tools/", "旧工具"),
            ("README.md", "仓库"),
            ("AGENTS.md", "仓库"),
            (".gitignore", "仓库"),
        ],
        "summary_overrides": {
            "新增: 添加前端和后端基础架构": "新增: 引入早期机器人控制脚本与连接测试",
            "新增: 添加机器狗对话系统前端和后端基础结构": "新增: 初始化机器人对话客户端",
            "新增: 添加大模型支持并优化机器人控制功能": "新增: 接入大模型驱动的本体控制客户端",
            "新增: 初始化React Native机器狗控制应用并调整相关配置": "新增: 为 React Native 手机端接入调整本体常量与停止脚本",
            "新增: 机器人手机端": "新增: 调整本体代理与手机端对接流程",
            "新增: 为手机端添加 WebRTC/WHEP 视频播放支持": "新增: 补充本体视频推流与播放链路适配",
        },
    },
    "phone": {
        "label": "手机端",
        "scope_order": ["应用", "Android", "iOS", "文档", "工具", "旧版 uni-app", "旧工具", "工程"],
        "scope_map": [
            ("src/", "应用"),
            ("__tests__/", "应用"),
            ("android/", "Android"),
            ("ios/", "iOS"),
            ("docs/", "文档"),
            ("tools/", "工具"),
            ("legacy-uni-app/", "旧版 uni-app"),
            ("legacy-tools/", "旧工具"),
            ("App.tsx", "工程"),
            ("app.json", "工程"),
            ("babel.config.js", "工程"),
            ("Gemfile", "工程"),
            ("index.js", "工程"),
            ("jest.config.js", "工程"),
            ("metro.config.js", "工程"),
            ("package-lock.json", "工程"),
            ("package.json", "工程"),
            ("README.md", "工程"),
            ("tsconfig.json", "工程"),
            (".bundle/", "工程"),
            (".eslintrc.js", "工程"),
            (".gitignore", "工程"),
            (".prettierrc.js", "工程"),
            (".watchmanconfig", "工程"),
            ("AGENTS.md", "工程"),
        ],
        "summary_overrides": {
            "删除: 移除机器人手机端相关文件和目录": "删除: 移除早期 uni-app 手机端目录",
            "新增: 机器人手机端": "新增: 扩展 React Native 手机端基础功能",
            "新增: 更新大模型列表并添加手机端启动脚本": "新增: 更新手机端启动脚本并同步模型列表",
        },
    },
    "root": {
        "label": "根仓库",
        "scope_order": ["文档", "工具", "开发环境", "仓库"],
        "scope_map": [
            ("docs/", "文档"),
            ("tools/", "工具"),
            (".devcontainer/", "开发环境"),
            (".githooks/", "开发环境"),
            ("README.md", "仓库"),
            ("AGENTS.md", "仓库"),
            ("TODO.md", "仓库"),
            (".gitignore", "仓库"),
        ],
        "summary_overrides": {
            "初始化仓库": "初始化仓库: 建立项目基础目录与版本控制骨架",
            "新增: 添加前端和后端基础架构": "新增: 补充前后端基础架构相关文档与开发环境配置",
            "新增: 添加机器狗对话系统前端和后端基础结构": "新增: 补充机器狗对话系统相关文档与脚本",
            "新增: 集成编舞系统到机器人云平台": "新增: 同步编舞系统集成所需文档与启动脚本",
            "新增: 更新大模型列表并添加手机端启动脚本": "新增: 更新模型配置说明并补充手机端启动脚本",
            "新增: 添加机器狗配置工具和文档更新": "新增: 补充机器狗配置脚本与说明文档",
            "新增: 机器人手机端": "新增: 同步手机端接入所需文档与配套脚本",
            "删除: 移除机器人手机端相关文件和目录": "删除: 清理早期手机端相关说明与残留目录引用",
        },
    },
}


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout


def list_commits() -> list[str]:
    return [line.strip() for line in run_git("rev-list", "--reverse", "HEAD").splitlines() if line.strip()]


def get_message(sha: str) -> str:
    return run_git("show", "-s", "--format=%s%n%b", sha).rstrip("\n")


def get_paths(sha: str) -> list[str]:
    return [line.strip() for line in run_git("diff-tree", "--root", "--no-commit-id", "--name-only", "-r", sha).splitlines() if line.strip()]


def split_prefix(subject: str, label: str) -> str:
    scoped_prefix = re.compile(rf"^\[{re.escape(label)}\]\[[^\]]+\]\s+")
    plain_prefix = f"[{label}] "
    if scoped_prefix.match(subject):
        return scoped_prefix.sub("", subject, count=1)
    if subject.startswith(plain_prefix):
        return subject[len(plain_prefix):]
    return subject


def classify_scopes(paths: list[str], config: dict[str, object]) -> tuple[list[str], list[str]]:
    scope_map: list[tuple[str, str]] = config["scope_map"]  # type: ignore[assignment]
    ordered_scopes: list[str] = []
    top_paths: list[str] = []
    for path in paths:
        top = path.split("/", 1)[0] if "/" in path else path
        if top not in top_paths:
            top_paths.append(top)
        matched = None
        for prefix, label in scope_map:
            if path == prefix or path.startswith(prefix):
                matched = label
                break
        if matched is None:
            matched = "仓库"
        if matched not in ordered_scopes:
            ordered_scopes.append(matched)
    scope_order: list[str] = config["scope_order"]  # type: ignore[assignment]
    ordered_scopes.sort(key=lambda item: scope_order.index(item) if item in scope_order else len(scope_order))
    return ordered_scopes, top_paths


def normalize_subject(base_subject: str, config: dict[str, object], scopes: list[str]) -> str:
    overrides: dict[str, str] = config["summary_overrides"]  # type: ignore[assignment]
    normalized = overrides.get(base_subject, base_subject)
    scope_text = "/".join(scopes) if scopes else "仓库"
    match = re.match(r"^([^:]+:\s*)(.*)$", normalized)
    if match:
        prefix, summary = match.groups()
        return f"{prefix}[{scope_text}] {summary}"
    return f"[{scope_text}] {normalized}"


def extract_original_footer(body: str) -> list[str]:
    lines = [line.rstrip() for line in body.splitlines()]
    return [line for line in lines if line.startswith("[原 monorepo 提交:")]


def build_message(current_message: str, config: dict[str, object], scopes: list[str], top_paths: list[str]) -> str:
    lines = current_message.splitlines()
    current_subject = lines[0].strip()
    label: str = config["label"]  # type: ignore[assignment]
    base_subject = split_prefix(current_subject, label)
    new_subject = normalize_subject(base_subject, config, scopes)

    footer_lines = extract_original_footer(current_message)
    body_lines = [
        f"影响范围: {', '.join(scopes) if scopes else '仓库'}",
        f"变更路径: {', '.join(top_paths) if top_paths else '仓库根目录'}",
    ]
    body_lines.extend(footer_lines)
    return new_subject + "\n\n" + "\n".join(body_lines) + "\n"


def generate_mapping(repo_kind: str) -> dict[str, str]:
    config = REPO_CONFIG[repo_kind]
    mapping: dict[str, str] = {}
    for sha in list_commits():
        current_message = get_message(sha)
        paths = get_paths(sha)
        scopes, top_paths = classify_scopes(paths, config)
        mapping[sha] = build_message(current_message, config, scopes, top_paths)
    return mapping


def write_mapping(mapping: dict[str, str], path: Path) -> None:
    path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_mapping(mapping_path: Path) -> None:
    callback = (
        "import json\n"
        f"MAP = json.load(open(r'''{mapping_path}''', 'r', encoding='utf-8'))\n"
        "new_message = MAP.get(commit.original_id.decode('ascii'))\n"
        "if new_message is not None:\n"
        "    commit.message = new_message.encode('utf-8')\n"
    )
    subprocess.run(
        ["git", "filter-repo", "--force", "--commit-callback", callback],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="细化拆分仓库中的提交消息")
    parser.add_argument("--repo-kind", choices=sorted(REPO_CONFIG.keys()), required=True)
    parser.add_argument("--mapping-file", default="refined-message-map.json")
    parser.add_argument("--preview", type=int, default=5)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    mapping = generate_mapping(args.repo_kind)
    mapping_path = Path(args.mapping_file).resolve()
    write_mapping(mapping, mapping_path)

    preview_count = max(args.preview, 0)
    if preview_count:
        for sha in list(mapping.keys())[:preview_count]:
            sys.stdout.write(f"{sha}\n{mapping[sha]}---\n")

    if args.apply:
        apply_mapping(mapping_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
