# 机器狗 AI 入门示例代码

这是一套和 `docs/教程` 对应的最小示例代码，目标只有一个：

`先跑通完整流程`

示例文件说明：

- `00_check_env.py`：课前检查示例文件、环境变量和项目执行链路
- `01_ai_cli.py`：命令行调用 AI，把中文转换成动作 JSON
- `02_dog_demo.py`：不接 AI，直接执行固定动作序列
- `03_ai_control_dog.py`：把 AI 输出和机器狗执行连接起来
- `prompts.py`：统一放提示词
- `dog_controller.py`：教学用动作封装
- `project_executor_adapter.py`：复用仓库现有动作执行器的适配层
- `requirements.txt`：示例依赖

## 使用说明

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，然后填入你自己的密钥。

机器狗控制相关环境变量也可以一起放在 `.env` 里。

### 3. 先运行第一个示例

```bash
python 00_check_env.py
```

如果检查没有明显问题，再运行：

```bash
python 01_ai_cli.py
```

## 控制模式

`dog_controller.py` 当前支持两种模式：

- `dry_run`：只打印动作，适合课堂演示和无设备环境
- `project_executor`：复用当前仓库的 `robot-agent` 动作执行链路

### 默认模式

默认是 `dry_run`。

### 切换到项目动作执行器

运行前先设置环境变量：

```bash
set DOG_CONTROL_MODE=project_executor
python 03_ai_control_dog.py
```

如果是在 PowerShell 中：

```powershell
$env:DOG_CONTROL_MODE="project_executor"
python .\03_ai_control_dog.py
```

## 建议的安全配置

第一次接真实机器狗时，建议把参数调保守一些：

```text
DOG_CONFIRM_BEFORE_RUN=true
DOG_FORWARD_SPEED=0.15
DOG_BACKWARD_SPEED=0.15
DOG_TURN_YAW_RATE=0.4
DOG_STEP_SECONDS=0.8
DOG_MAX_STEPS=2
DOG_MAX_ANGLE=45
```

这样即使 AI 输出了比较积极的动作，执行层也会做截断。

## 参数说明

- `DOG_CONTROL_MODE`：`dry_run` 或 `project_executor`
- `DOG_CONFIRM_BEFORE_RUN`：每次执行前是否手动确认
- `DOG_FORWARD_SPEED`：前进速度
- `DOG_BACKWARD_SPEED`：后退速度
- `DOG_TURN_YAW_RATE`：转向角速度
- `DOG_STEP_SECONDS`：每一步换算成多少秒
- `DOG_MAX_STEPS`：一次最多允许几步
- `DOG_MAX_ANGLE`：一次最多允许转多少度
- `DOG_ACTION_INTERVAL`：动作之间的间隔

## 重要说明

这套代码是教学骨架。`project_executor` 模式已经接到了当前仓库里的动作执行子进程，但是否能真正控制真实机器狗，还取决于本机是否满足这些条件：

- 运行环境是 Linux
- SDK 动态库可用
- 机器狗网络配置正确
- `robot-agent` 相关 Python 依赖可导入

但整体结构已经和教程对应好了，后续继续补会比较顺。
