# 机器狗控制系统

## 安装运行环境

[安装运行环境](./docs/1.%20安装运行环境.md)

## 连接机器狗

[连接机器狗](./docs/2.%20连接机器狗.md)

## 其他

.so 库文件是目前是单独放到一个git仓库中

```bash
# 克隆远程仓库到临时目录
git clone <远程仓库地址> /tmp/so_repo

# 移动需要的 .so 文件到目标目录
mkdir -p app/robot-control/lib/so
cp /tmp/so_repo/*.so app/robot-control/lib/so/

# 可选：删除临时仓库
rm -rf /tmp/so_repo
```

## GUI 部分

### 一键启动

```bash
chmod +x start.sh
./start.sh
```

### 常用命令

```bash
# 停止所有服务
./stop.sh

# 查看后端日志
tail -f logs/backend.log

# 查看前端日志
tail -f logs/frontend.log

# 重新初始化数据库
cd app/backend
npm run init-db

# 运行示例程序
cd app/robot-control
python3 dance_1dog.py
```

### 数据库重置
删除主数据库后重新初始化：
```bash
rm ~/.local/share/RobotDogControl/main.db
cd app/backend
npm run init-db
```

## 数据存储位置

- **Linux**: `~/.local/share/RobotDogControl/`
- **macOS**: `~/Library/Application Support/RobotDogControl/`
- **Windows**: `%APPDATA%\RobotDogControl\`

工程文件默认保存在：`~/Documents/RobotDogProjects/`