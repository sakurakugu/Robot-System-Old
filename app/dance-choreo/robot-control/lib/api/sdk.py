import sys
from pathlib import Path
import platform

# 根据平台和架构选择对应的静态库的路径
machine = platform.machine().lower()
arch = "aarch64" if ("aarch64" in machine or "arm64" in machine) else "x86_64"
so_dir = Path(__file__).parent.parent / "so" / arch
sys.path.insert(0, str(so_dir))

try:
    import mc_sdk_zsl_1_py
except ImportError as e:
    raise ImportError(f"无法导入 mc_sdk_zsl_1_py，请检查 {so_dir} 下是否存在 .so 文件") from e


__all__ = ["mc_sdk_zsl_1_py"]

