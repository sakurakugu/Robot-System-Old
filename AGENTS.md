## 项目概览

机器狗控制系统，包含以下子项目：

| 目录                                   | 技术栈                                     | 说明               |
| -------------------------------------- | ------------------------------------------ | ------------------ |
| `app/phone-app/RobotPhone`             | React Native 0.84 + TypeScript             | 手机端 App         |
| `app/cloud-server/前端/`               | Vue 3 + TypeScript + Vite                  | 云端管理前端       |
| `app/cloud-server/后端/`               | Node.js + TypeScript + Express + WebSocket | 云端后端服务       |
| `app/robot-onboard/robot-agent/`       | Python 3.10+                               | 机器狗本体代理程序 |
| `app/robot-onboard/robot-server/`      | Python 3.10+ + FastAPI                     | 机器狗配置服务器   |
| `app/robot-onboard/sparkrobot-common/` | Python 3.10+                               | 公共库             |

---

## 约定

- Python 使用 mypy 和 ruff
- Node 使用 lint 和 typecheck
- 开发阶段页面均为热更新，修改代码后无需重启服务，直接刷新即可验证
- 如需安装库，直接安装
- 所有注释一律使用中文，回复也使用中文
- 该项目为自用项目，可以重构不用向前兼容
