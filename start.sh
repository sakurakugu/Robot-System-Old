#!/bin/bash

# 机器狗控制系统 - 一键启动脚本

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  机器狗控制系统 - 启动脚本"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 24+"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未检测到 Python3，请先安装 Python 3.10+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo "✅ Python 版本: $(python3 --version)"
echo ""

# 安装后端依赖
echo "📦 检查后端依赖..."
cd app/backend
if [ ! -d "node_modules" ]; then
    echo "   安装后端依赖..."
    npm install
else
    echo "   后端依赖已安装"
fi
cd ../..

# 安装前端依赖
echo "📦 检查前端依赖..."
cd app/frontend
if [ ! -d "node_modules" ]; then
    echo "   安装前端依赖..."
    npm install
else
    echo "   前端依赖已安装"
fi
cd ../..

# 初始化数据库
echo "🗄️  初始化数据库..."
cd app/backend
if [ ! -f "dist/database/init.js" ]; then
    echo "   编译 TypeScript..."
    npm run build
fi
npm run init-db
cd ../..

echo ""
echo "========================================"
echo "  准备完成，正在启动服务..."
echo "========================================"
echo ""

# 创建日志目录
mkdir -p logs

# 启动后端服务
echo "🚀 启动后端服务..."
cd app/backend
npm run dev > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   后端服务 PID: $BACKEND_PID"
cd ../..

# 等待后端启动
sleep 3

# 启动前端服务
echo "🚀 启动前端服务..."
cd app/frontend
npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   前端服务 PID: $FRONTEND_PID"
cd ../..

echo ""
echo "========================================"
echo "  ✅ 系统启动成功！"
echo "========================================"
echo ""
echo "  前端界面: http://localhost:5173"
echo "  后端API:  http://localhost:3000"
echo "  WebSocket: ws://localhost:3000"
echo "  健康检查: http://localhost:3000/health"
echo ""
echo "  后端日志: logs/backend.log"
echo "  前端日志: logs/frontend.log"
echo ""
echo "  后端进程 PID: $BACKEND_PID"
echo "  前端进程 PID: $FRONTEND_PID"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "========================================"
echo ""

# 保存 PID 到文件
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

# 等待用户中断
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 服务已停止'; exit 0" INT TERM

# 监控进程
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
    sleep 1
done

echo ""
echo "⚠️  检测到服务异常退出，请查看日志："
echo "   tail -f logs/backend.log"
echo "   tail -f logs/frontend.log"
