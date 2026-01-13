#!/bin/bash

# 机器狗控制系统 - 统一启动工具

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

ACTION="restart"
APP="all"  # all, dance, chat

if [ $# -gt 0 ]; then
  case "$1" in
    --start|-s)    ACTION="start"   ;;
    --stop|-x)     ACTION="stop"    ;;
    --restart|-r)  ACTION="restart" ;;
    --test|-t)     ACTION="test"    ;;
    --help|-h)     ACTION="help"    ;;
    *)
      echo "未知参数: $1"
      ACTION="help"
      ;;
  esac
fi

# 解析应用参数
if [ $# -gt 1 ]; then
  case "$2" in
    --all|-a)      APP="all"   ;;
    --dance|-d)    APP="dance" ;;
    --chat|-c)     APP="chat"  ;;
    *)
      echo "未知应用参数: $2"
      echo "支持: --all (默认), --dance, --chat"
      exit 1
      ;;
  esac
fi

print_header() {
  local title="$1"
  case "$APP" in
    all)   title="$title (编舞系统 + 对话系统)" ;;
    dance) title="$title (编舞系统)" ;;
    chat)  title="$title (对话系统)" ;;
  esac
  echo "========================================"
  echo "  机器狗控制系统 - $title"
  echo "========================================"
  echo ""
}

check_env() {
  if ! command -v node &> /dev/null; then
      echo "❌ 未检测到 Node.js，请先安装 Node.js 24+"
      exit 1
  fi
  if ! command -v python3 &> /dev/null; then
      echo "❌ 未检测到 Python3，请先安装 Python 3.10+"
      exit 1
  fi
  echo "✅ Node.js 版本: $(node --version)"
  echo "✅ Python 版本: $(python3 --version)"
  echo ""
}

do_start() {
  print_header "启动脚本"
  check_env

  # 启动编舞系统
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    echo ""
    echo "========================================"
    echo "  📦 准备编舞系统 (Dance Choreo)"
    echo "========================================"
    
    echo "📦 检查后端依赖..."
    cd "$SCRIPT_DIR/app/dance-choreo/backend"
    if [ ! -d "node_modules" ]; then
        echo "   安装后端依赖..."
        npm install
    else
        echo "   后端依赖已安装"
    fi

    echo "📦 检查前端依赖..."
    cd "$SCRIPT_DIR/app/dance-choreo/frontend"
    if [ ! -d "node_modules" ]; then
        echo "   安装前端依赖..."
        npm install
    else
        echo "   前端依赖已安装"
    fi

    echo "🗄️  初始化数据库..."
    cd "$SCRIPT_DIR/app/dance-choreo/backend"
    if [ ! -f "dist/database/init.js" ]; then
        echo "   编译 TypeScript..."
        npm run build
    fi
    npm run init-db
  fi

  # 启动对话系统
  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    echo ""
    echo "========================================"
    echo "  📦 准备对话系统 (Robot Chat)"
    echo "========================================"
    
    echo "📦 检查后端依赖..."
    cd "$SCRIPT_DIR/app/robot-chat/backend"
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        echo "⚠️  .env 文件不存在，从示例创建..."
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请编辑配置后重新运行"
        exit 0
    fi
    
    if [ ! -d "node_modules" ]; then
        echo "   安装后端依赖..."
        npm install
    else
        echo "   后端依赖已安装"
    fi

    echo "📦 检查前端依赖..."
    cd "$SCRIPT_DIR/app/robot-chat/frontend"
    if [ ! -d "node_modules" ]; then
        echo "   安装前端依赖..."
        npm install
    else
        echo "   前端依赖已安装"
    fi
  fi

  echo ""
  echo "========================================"
  echo "  准备完成，正在启动服务..."
  echo "========================================"
  echo ""

  mkdir -p "$SCRIPT_DIR/logs/dance-choreo" "$SCRIPT_DIR/logs/robot-chat" "$SCRIPT_DIR/logs/pid"

  # 启动编舞系统服务
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    echo "🚀 启动编舞系统后端..."
    cd "$SCRIPT_DIR/app/dance-choreo/backend"
    npm run dev > "$SCRIPT_DIR/logs/dance-choreo/backend.log" 2>&1 &
    DANCE_BACKEND_PID=$!
    echo "   编舞系统后端 PID: $DANCE_BACKEND_PID"
    echo "$DANCE_BACKEND_PID" > "$SCRIPT_DIR/logs/pid/dance-backend.pid"

    sleep 2

    echo "🚀 启动编舞系统前端..."
    cd "$SCRIPT_DIR/app/dance-choreo/frontend"
    npm run dev > "$SCRIPT_DIR/logs/dance-choreo/frontend.log" 2>&1 &
    DANCE_FRONTEND_PID=$!
    echo "   编舞系统前端 PID: $DANCE_FRONTEND_PID"
    echo "$DANCE_FRONTEND_PID" > "$SCRIPT_DIR/logs/pid/dance-frontend.pid"
  fi

  # 启动对话系统服务
  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    echo "🚀 启动对话系统后端..."
    cd "$SCRIPT_DIR/app/robot-chat/backend"
    npm run dev > "$SCRIPT_DIR/logs/robot-chat/backend.log" 2>&1 &
    CHAT_BACKEND_PID=$!
    echo "   对话系统后端 PID: $CHAT_BACKEND_PID"
    echo "$CHAT_BACKEND_PID" > "$SCRIPT_DIR/logs/pid/chat-backend.pid"

    sleep 2

    echo "🚀 启动对话系统前端..."
    cd "$SCRIPT_DIR/app/robot-chat/frontend"
    npm run dev -- --port 5174 > "$SCRIPT_DIR/logs/robot-chat/frontend.log" 2>&1 &
    CHAT_FRONTEND_PID=$!
    echo "   对话系统前端 PID: $CHAT_FRONTEND_PID"
    echo "$CHAT_FRONTEND_PID" > "$SCRIPT_DIR/logs/pid/chat-frontend.pid"
  fi

  echo ""
  echo "========================================"
  echo "  ✅ 系统启动成功！"
  echo "========================================"
  echo ""

  # 显示服务信息
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    echo "📱 编舞系统 (Dance Choreo):"
    echo "  前端界面: http://localhost:5173"
    echo "  后端API:  http://localhost:3000"
    echo "  WebSocket: ws://localhost:3000"
    echo "  日志目录: logs/dance-choreo/"
    echo "  后端进程 PID: $DANCE_BACKEND_PID"
    echo "  前端进程 PID: $DANCE_FRONTEND_PID"
    echo ""
  fi

  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    echo "💬 对话系统 (Robot Chat):"
    echo "  前端界面: http://localhost:5174"
    echo "  后端API:  http://localhost:3001"
    echo "  WebSocket: ws://localhost:3001"
    echo "  日志目录: logs/robot-chat/"
    echo "  后端进程 PID: $CHAT_BACKEND_PID"
    echo "  前端进程 PID: $CHAT_FRONTEND_PID"
    echo ""
  fi

  echo "  按 Ctrl+C 停止所有服务"
  echo "========================================"
  echo ""

  # 收集所有PID用于监控
  ALL_PIDS=()
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    ALL_PIDS+=($DANCE_BACKEND_PID $DANCE_FRONTEND_PID)
  fi
  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    ALL_PIDS+=($CHAT_BACKEND_PID $CHAT_FRONTEND_PID)
  fi

  cleanup() {
    echo ""
    echo "正在停止服务..."
    if [ ${#ALL_PIDS[@]} -gt 0 ]; then
      kill "${ALL_PIDS[@]}" 2>/dev/null || true
    fi
    echo "✅ 服务已停止"
    exit 0
  }
  trap cleanup INT TERM

  # 监控进程
  while true; do
    for pid in "${ALL_PIDS[@]}"; do
      if ! kill -0 $pid 2>/dev/null; then
        echo ""
        echo "⚠️  检测到服务异常退出 (PID: $pid)，请查看日志："
        echo "   tail -f logs/dance-choreo/*.log"
        echo "   tail -f logs/robot-chat/*.log"
        exit 1
      fi
    done
    sleep 1
  done
}

do_stop() {
  print_header "停止脚本"
  echo "正在停止机器狗控制系统..."

  STOPPED_ANY=false

  # 停止编舞系统
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    if [ -f "logs/pid/dance-backend.pid" ]; then
        PID=$(cat logs/pid/dance-backend.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "✅ 编舞系统后端已停止 (PID: $PID)"
            STOPPED_ANY=true
        fi
        rm -f logs/pid/dance-backend.pid
    fi

    if [ -f "logs/pid/dance-frontend.pid" ]; then
        PID=$(cat logs/pid/dance-frontend.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "✅ 编舞系统前端已停止 (PID: $PID)"
            STOPPED_ANY=true
        fi
        rm -f logs/pid/dance-frontend.pid
    fi
  fi

  # 停止对话系统
  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    if [ -f "logs/pid/chat-backend.pid" ]; then
        PID=$(cat logs/pid/chat-backend.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "✅ 对话系统后端已停止 (PID: $PID)"
            STOPPED_ANY=true
        fi
        rm -f logs/pid/chat-backend.pid
    fi

    if [ -f "logs/pid/chat-frontend.pid" ]; then
        PID=$(cat logs/pid/chat-frontend.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "✅ 对话系统前端已停止 (PID: $PID)"
            STOPPED_ANY=true
        fi
        rm -f logs/pid/chat-frontend.pid
    fi
  fi

  # 兼容旧的PID文件
  if [ -f "logs/dance-choreo/backend.pid" ]; then
      PID=$(cat logs/dance-choreo/backend.pid)
      if kill -0 $PID 2>/dev/null; then
          kill $PID
          STOPPED_ANY=true
      fi
      rm -f logs/dance-choreo/backend.pid
  fi

  if [ -f "logs/frontend.pid" ]; then
      PID=$(cat logs/frontend.pid)
      if kill -0 $PID 2>/dev/null; then
          kill $PID
          STOPPED_ANY=true
      fi
      rm -f logs/frontend.pid
  fi

  # 清理残留进程
  pkill -f "vite" || true
  pkill -f "ts-node-dev" || true

  if [ "$STOPPED_ANY" = true ]; then
    echo "✅ 所有服务已停止"
  else
    echo "ℹ️  没有运行中的服务"
  fi
}

do_restart() {
  print_header "重启脚本"
  echo "正在重启机器狗控制系统..."
  do_stop
  sleep 2
  do_start
}



do_test() {
  print_header "系统测试"

  # 测试编舞系统
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    echo "🧪 测试编舞系统 (Dance Choreo)..."
    echo ""
    
    echo "1. 测试后端健康检查..."
    HEALTH_RESPONSE=$(curl -s http://localhost:3000/health || true)
    if [ -n "$HEALTH_RESPONSE" ]; then
        echo "   ✅ 后端服务正常: $HEALTH_RESPONSE"
    else
        echo "   ❌ 后端服务异常"
        exit 1
    fi

    echo "2. 测试获取项目列表..."
    PROJECTS_RESPONSE=$(curl -s http://localhost:3000/api/projects || true)
    if [ -n "$PROJECTS_RESPONSE" ]; then
        echo "   ✅ 项目列表 API 正常"
    else
        echo "   ❌ 项目列表 API 异常"
        exit 1
    fi

    echo "3. 测试前端服务..."
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 || true)
    if [ "$FRONTEND_RESPONSE" = "200" ]; then
        echo "   ✅ 前端服务正常"
    else
        echo "   ❌ 前端服务异常 (HTTP $FRONTEND_RESPONSE)"
        exit 1
    fi
    echo ""
  fi

  # 测试对话系统
  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    echo "🧪 测试对话系统 (Robot Chat)..."
    echo ""
    
    echo "1. 测试后端健康检查..."
    HEALTH_RESPONSE=$(curl -s http://localhost:3001/health || true)
    if [ -n "$HEALTH_RESPONSE" ]; then
        echo "   ✅ 后端服务正常: $HEALTH_RESPONSE"
    else
        echo "   ❌ 后端服务异常"
        exit 1
    fi

    echo "2. 测试前端服务..."
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5174 || true)
    if [ "$FRONTEND_RESPONSE" = "200" ]; then
        echo "   ✅ 前端服务正常"
    else
        echo "   ❌ 前端服务异常 (HTTP $FRONTEND_RESPONSE)"
        exit 1
    fi
    echo ""
  fi

  echo ""
  echo "========================================="
  echo "  ✅ 所有测试通过！"
  echo "========================================="
  echo ""
  echo "系统运行正常，可以开始使用："
  
  if [ "$APP" = "all" ] || [ "$APP" = "dance" ]; then
    echo "  编舞系统: http://localhost:5173 (后端: http://localhost:3000)"
  fi
  if [ "$APP" = "all" ] || [ "$APP" = "chat" ]; then
    echo "  对话系统: http://localhost:5174 (后端: http://localhost:3001)"
  fi
  echo ""
}

show_help() {
  echo "机器狗控制系统 - 统一启动脚本"
  echo ""
  echo "用法："
  echo "  ./start.sh [ACTION] [APP]"
  echo ""
  echo "操作参数 (ACTION):"
  echo "  --start, -s       启动服务（默认）"
  echo "  --stop, -x        停止服务"
  echo "  --restart, -r     重启服务"
  echo "  --test, -t        运行系统自检"
  echo "  --help, -h        显示帮助"
  echo ""
  echo "应用参数 (可选):"
  echo "  --all, -a         启动所有系统 (默认)"
  echo "  --dance, -d       只启动编舞系统 (端口: 3000/5173)"
  echo "  --chat, -c        只启动对话系统 (端口: 3001/5174)"
  echo ""
  echo "使用示例："
  echo "  ./start.sh                     # 启动所有系统"
  echo "  ./start.sh --start             # 启动所有系统"
  echo "  ./start.sh --start --dance     # 只启动编舞系统"
  echo "  ./start.sh --start --chat      # 只启动对话系统"
  echo "  ./start.sh --stop --all        # 停止所有服务"
  echo "  ./start.sh --stop --dance      # 只停止编舞系统"
  echo "  ./start.sh --test --dance      # 测试编舞系统"
  echo "  ./start.sh --restart --chat    # 重启对话系统"
  echo ""
  echo "应用选择："
  echo "  --all   或 -a    启动所有系统 (默认)"
  echo "  --dance 或 -d    只启动编舞系统"
  echo "  --chat  或 -c    只启动对话系统"
  echo ""
}

case "$ACTION" in
  start) do_start ;;
  stop)  do_stop ;;
  restart) do_restart ;;
  test)  do_test ;;
  help)  show_help ;;
esac
