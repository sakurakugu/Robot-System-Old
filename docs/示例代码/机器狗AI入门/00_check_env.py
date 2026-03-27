import os
from pathlib import Path


def 打印(title: str) -> None:
    print()
    print(f"== {title} ==")


def 检查文件(path: Path) -> bool:
    ok = path.exists()
    print(f"[{'OK' if ok else 'NO'}] {path}")
    return ok


def 检查环境变量(name: str, required: bool = False) -> bool:
    value = os.getenv(name, "").strip()
    ok = bool(value)
    if ok:
        print(f"[OK] {name}={value}")
        return True
    print(f"[{'NO' if required else '--'}] {name} 未设置")
    return not required


def main() -> None:
    current_dir = Path(__file__).resolve().parent
    repo_root = current_dir.parents[3]

    打印("示例文件检查")
    检查文件(current_dir / "01_ai_cli.py")
    检查文件(current_dir / "02_dog_demo.py")
    检查文件(current_dir / "03_ai_control_dog.py")
    检查文件(current_dir / "prompts.py")
    检查文件(current_dir / ".env.example")

    打印("环境变量检查")
    检查环境变量("OPENAI_API_KEY", required=False)
    检查环境变量("OPENAI_BASE_URL", required=False)
    检查环境变量("OPENAI_MODEL", required=False)
    检查环境变量("DOG_CONTROL_MODE", required=False)
    检查环境变量("DOG_CONFIRM_BEFORE_RUN", required=False)

    打印("项目执行链路检查")
    executor_path = repo_root / "app" / "robot-agent" / "robot-agent" / "src" / "modules" / "actions" / "executor.py"
    sdk_path = repo_root / "app" / "robot-agent" / "robot-agent" / "src" / "core" / "dog" / "sdk.py"
    检查文件(executor_path)
    检查文件(sdk_path)

    print()
    print("说明：")
    print("1. 如果只做课堂演示，看到示例文件存在即可。")
    print("2. 如果要接真实机器狗，至少还需要 Linux、SDK 动态库和正确的网络配置。")
    print("3. 如果要调用 AI，请确保 OPENAI_API_KEY 已配置。")


if __name__ == "__main__":
    main()
