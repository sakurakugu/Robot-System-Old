import json

from ai_client import 解析动作


def main() -> None:
    print("机器狗 AI 命令行助手")
    print("输入 exit 退出")

    while True:
        text = input("请输入命令: ").strip()
        if not text:
            continue
        if text.lower() == "exit":
            print("程序结束。")
            break

        try:
            result = 解析动作(text)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:
            print(f"调用失败: {e}")


if __name__ == "__main__":
    main()
