import json
import os
import time
from typing import Any

from project_executor_adapter import 项目动作执行适配器


class 机器狗控制器:
    def __init__(self, mode: str = "dry_run") -> None:
        self.mode = mode
        self.adapter: 项目动作执行适配器 | None = None
        self.forward_speed = self._读取浮点环境变量("DOG_FORWARD_SPEED", 0.2, 0.05, 0.3)
        self.backward_speed = self._读取浮点环境变量("DOG_BACKWARD_SPEED", 0.2, 0.05, 0.3)
        self.turn_yaw_rate = self._读取浮点环境变量("DOG_TURN_YAW_RATE", 0.5, 0.2, 1.0)
        self.step_seconds = self._读取浮点环境变量("DOG_STEP_SECONDS", 1.0, 0.5, 3.0)
        self.max_steps = self._读取整数环境变量("DOG_MAX_STEPS", 3, 1, 5)
        self.max_angle = self._读取整数环境变量("DOG_MAX_ANGLE", 90, 10, 180)
        self.action_interval = self._读取浮点环境变量("DOG_ACTION_INTERVAL", 1.0, 0.0, 3.0)

    def 初始化(self) -> None:
        if self.mode == "dry_run":
            print("当前为 dry_run 模式，只打印动作，不连接真实机器狗。")
            self.打印配置()
            return

        if self.mode == "project_executor":
            self.adapter = 项目动作执行适配器()
            self.adapter.启动()
            print("已连接项目动作执行器。")
            self.打印配置()
            return

        raise ValueError(f"不支持的控制模式: {self.mode}")

    def 关闭(self) -> None:
        if self.adapter:
            self.adapter.关闭()
            self.adapter = None

    def 执行动作列表(self, actions: list[dict[str, Any]]) -> None:
        for item in actions:
            self.执行单个动作(item)

    def 执行单个动作(self, item: dict[str, Any]) -> None:
        action = str(item.get("action", "")).strip()
        if action == "stand":
            self.站立()
        elif action == "sit":
            self.坐下()
        elif action == "forward":
            self.前进(int(item.get("steps", 1) or 1))
        elif action == "backward":
            self.后退(int(item.get("steps", 1) or 1))
        elif action == "turn_left":
            self.左转(int(item.get("angle", 30) or 30))
        elif action == "turn_right":
            self.右转(int(item.get("angle", 30) or 30))
        else:
            raise ValueError(f"不支持的动作: {action}")

    def 站立(self) -> None:
        print("执行动作: stand -> 内部映射为 stand_up")
        if self.adapter:
            self.adapter.发送命令("stand_up")
        time.sleep(1)

    def 坐下(self) -> None:
        print("执行动作: sit -> 内部映射为 sit_down")
        if self.adapter:
            self.adapter.发送命令("sit_down")
        time.sleep(1)

    def 前进(self, steps: int) -> None:
        safe_steps = self._限制步数(steps)
        duration = round(safe_steps * self.step_seconds, 2)
        print(f"执行动作: forward, steps={safe_steps}, duration={duration}")
        if self.adapter:
            self._发送_ai_move(vx=self.forward_speed, vy=0.0, yaw_rate=0.0, duration=duration)
        time.sleep(self.action_interval)

    def 后退(self, steps: int) -> None:
        safe_steps = self._限制步数(steps)
        duration = round(safe_steps * self.step_seconds, 2)
        print(f"执行动作: backward, steps={safe_steps}, duration={duration}")
        if self.adapter:
            self._发送_ai_move(vx=-self.backward_speed, vy=0.0, yaw_rate=0.0, duration=duration)
        time.sleep(self.action_interval)

    def 左转(self, angle: int) -> None:
        safe_angle = self._限制角度(angle)
        duration = round(self._角度转时长(safe_angle), 2)
        print(f"执行动作: turn_left, angle={safe_angle}, duration={duration}")
        if self.adapter:
            self._发送_ai_move(vx=0.0, vy=0.0, yaw_rate=self.turn_yaw_rate, duration=duration)
        time.sleep(self.action_interval)

    def 右转(self, angle: int) -> None:
        safe_angle = self._限制角度(angle)
        duration = round(self._角度转时长(safe_angle), 2)
        print(f"执行动作: turn_right, angle={safe_angle}, duration={duration}")
        if self.adapter:
            self._发送_ai_move(vx=0.0, vy=0.0, yaw_rate=-self.turn_yaw_rate, duration=duration)
        time.sleep(self.action_interval)

    def 打印配置(self) -> None:
        print("当前控制参数:")
        print(
            json.dumps(
                {
                    "mode": self.mode,
                    "forward_speed": self.forward_speed,
                    "backward_speed": self.backward_speed,
                    "turn_yaw_rate": self.turn_yaw_rate,
                    "step_seconds": self.step_seconds,
                    "max_steps": self.max_steps,
                    "max_angle": self.max_angle,
                    "action_interval": self.action_interval,
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    def _发送_ai_move(self, vx: float, vy: float, yaw_rate: float, duration: float) -> None:
        if not self.adapter:
            return
        payload = {
            "type": "ai_move",
            "vx": round(vx, 4),
            "vy": round(vy, 4),
            "yaw_rate": round(yaw_rate, 4),
            "duration": round(duration, 4),
        }
        self.adapter.发送命令(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

    def _限制步数(self, steps: int) -> int:
        return max(1, min(int(steps or 1), self.max_steps))

    def _限制角度(self, angle: int) -> int:
        return max(1, min(abs(int(angle or 30)), self.max_angle))

    def _角度转时长(self, angle: int) -> float:
        return (angle * 3.1415926 / 180.0) / self.turn_yaw_rate

    def _读取浮点环境变量(self, key: str, default: float, min_value: float, max_value: float) -> float:
        raw = os.getenv(key, "").strip()
        if not raw:
            return default
        try:
            value = float(raw)
        except ValueError:
            return default
        return max(min_value, min(value, max_value))

    def _读取整数环境变量(self, key: str, default: int, min_value: int, max_value: int) -> int:
        raw = os.getenv(key, "").strip()
        if not raw:
            return default
        try:
            value = int(raw)
        except ValueError:
            return default
        return max(min_value, min(value, max_value))
