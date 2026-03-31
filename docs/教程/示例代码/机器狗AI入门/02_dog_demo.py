from dog_controller import 机器狗控制器


def main() -> None:
    controller = 机器狗控制器(mode="dry_run")
    controller.初始化()
    try:
        controller.执行动作列表(
            [
                {"action": "stand"},
                {"action": "forward", "steps": 1},
                {"action": "turn_left", "angle": 30},
                {"action": "sit"},
            ]
        )
        print("演示完成。")
    finally:
        controller.关闭()


if __name__ == "__main__":
    main()
