import json
import os

from ai_client import 解析动作
from dog_controller import 机器狗控制器


def 预处理动作(actions: list[dict]) -> list[dict]:
    sanitized: list[dict] = []
    for item in actions:
        action = str(item.get("action", "")).strip()
        if not action:
            continue
        clean_item = {"action": action}
        if "steps" in item:
            clean_item["steps"] = item.get("steps", 1)
        if "angle" in item:
            clean_item["angle"] = item.get("angle", 30)
        sanitized.append(clean_item)
    return sanitized


def main() -> None:
    mode = os.getenv("DOG_CONTROL_MODE", "dry_run").strip() or "dry_run"
    confirm_before_run = os.getenv("DOG_CONFIRM_BEFORE_RUN", "false").strip().lower() in {"1", "true", "yes", "y"}
    controller = 机器狗控制器(mode=mode)
    controller.初始化()

    print("AI 控制机器狗示例")
    print("输入 exit 退出")
    print(f"当前控制模式: {mode}")
    print(f"执行前确认: {confirm_before_run}")

    try:
        while True:
            text = input("请输入命令: ").strip()
            if not text:
                continue
            if text.lower() == "exit":
                print("程序结束。")
                break

            try:
                result = 解析动作(text)
                print("AI 返回结果:")
                print(json.dumps(result, ensure_ascii=False, indent=2))
                actions = 预处理动作(result.get("actions", []))
                if not actions:
                    print("没有可执行动作，已跳过。")
                    continue
                print("准备执行动作列表:")
                print(json.dumps(actions, ensure_ascii=False, indent=2))
                if confirm_before_run:
                    answer = input("确认执行吗？输入 y 继续: ").strip().lower()
                    if answer != "y":
                        print("已取消本次执行。")
                        continue
                controller.执行动作列表(actions)
                print("执行完成。")
            except Exception as e:
                print(f"执行失败: {e}")
    finally:
        controller.关闭()


if __name__ == "__main__":
    main()
