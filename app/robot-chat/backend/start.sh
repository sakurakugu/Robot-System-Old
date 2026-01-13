#!/bin/bash

# 机器狗对话系统启动脚本

echo "================================"
echo "机器狗对话系统 - 启动脚本"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✓ npm 版本: $(npm --version)"

# 进入后端目录
cd "$(dirname "$0")"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从示例创建..."
    cp .env.example .env
    echo "✓ 已创建 .env 文件，请编辑配置后重新运行"
    exit 0
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 构建项目（生产环境）
if [ "$1" = "build" ]; then
    echo "🔨 构建项目..."
    npm run build
    echo "✓ 构建完成"
    exit 0
fi

# 启动服务
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    # 生产模式
    echo "🚀 启动生产服务..."
    if [ ! -d "dist" ]; then
        echo "📦 首次运行，先构建..."
        npm run build
    fi
    npm start
else
    # 开发模式
    echo "🚀 启动开发服务..."
    npm run dev
fi
