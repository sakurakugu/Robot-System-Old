import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


class 项目动作执行适配器:
    def __init__(self) -> None:
        self.process: subprocess.Popen[str] | None = None

    def 启动(self) -> None:
        script_path = self._获取执行器脚本路径()
        src_dir = script_path.parents[2]
        python_exec = self._获取解释器路径()

        env = os.environ.copy()
        existing_pythonpath = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = f"{src_dir}{os.pathsep}{existing_pythonpath}" if existing_pythonpath else str(src_dir)

        self.process = subprocess.Popen(
            [python_exec, str(script_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )

        time.sleep(5)
        if self.process.poll() is not None:
            error = ""
            if self.process.stderr:
                error = self.process.stderr.read().strip()
            raise RuntimeError(f"项目动作执行器启动失败: {error or '未知错误'}")

    def 关闭(self) -> None:
        if not self.process or self.process.poll() is not None:
            self.process = None
            return

        if self.process.stdin:
            self.process.stdin.write("exit\n")
            self.process.stdin.flush()

        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=3)
        finally:
            self.process = None

    def 发送命令(self, command: str) -> None:
        if not self.process or self.process.poll() is not None:
            raise RuntimeError("项目动作执行器未启动")
        if not self.process.stdin:
            raise RuntimeError("项目动作执行器标准输入不可用")

        self.process.stdin.write(f"{command}\n")
        self.process.stdin.flush()

    def _获取执行器脚本路径(self) -> Path:
        current_file = Path(__file__).resolve()
        repo_root = current_file.parents[3]
        script_path = repo_root / "app" / "robot-onboard" / "robot-agent" / "src" / "modules" / "actions" / "executor.py"
        if not script_path.exists():
            raise FileNotFoundError(f"找不到项目动作执行脚本: {script_path}")
        return script_path

    def _获取解释器路径(self) -> str:
        if sys.executable:
            return sys.executable

        for candidate in ["python3", "python"]:
            path = shutil.which(candidate)
            if path:
                return path

        raise RuntimeError("找不到可用的 Python 解释器")
