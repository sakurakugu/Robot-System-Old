#!/bin/bash

# GUI页面启动工具

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

ACTION="restart"
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

print_header() {
  echo "========================================"
  echo "  机器狗控制系统 - $1"
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

  echo "📦 检查后端依赖..."
  cd app/backend
  if [ ! -d "node_modules" ]; then
      echo "   安装后端依赖..."
      npm install
  else
      echo "   后端依赖已安装"
  fi
  cd ../..

  echo "📦 检查前端依赖..."
  cd app/frontend-choreo
  if [ ! -d "node_modules" ]; then
      echo "   安装前端依赖..."
      npm install
  else
      echo "   前端依赖已安装"
  fi
  cd ../..

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

  mkdir -p logs

  echo "🚀 启动后端服务..."
  cd app/backend
  npm run dev > ../../logs/backend.log 2>&1 &
  BACKEND_PID=$!
  echo "   后端服务 PID: $BACKEND_PID"
  cd ../..

  sleep 3

  echo "🚀 启动前端服务..."
  cd app/frontend-choreo
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

  trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 服务已停止'; exit 0" INT TERM

  # 监控进程
  while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
      sleep 1
  done

  echo ""
  echo "⚠️  检测到服务异常退出，请查看日志："
  echo "   tail -f logs/backend.log"
  echo "   tail -f logs/frontend.log"
}

do_stop() {
  print_header "停止脚本"
  echo "正在停止机器狗控制系统..."

  if [ -f "logs/backend.pid" ]; then
      BACKEND_PID=$(cat logs/backend.pid)
      if kill -0 $BACKEND_PID 2>/dev/null; then
          kill $BACKEND_PID
          echo "✅ 后端服务已停止 (PID: $BACKEND_PID)"
      fi
      rm -f logs/backend.pid
  fi

  if [ -f "logs/frontend.pid" ]; then
      FRONTEND_PID=$(cat logs/frontend.pid)
      if kill -0 $FRONTEND_PID 2>/dev/null; then
          kill $FRONTEND_PID
          echo "✅ 前端服务已停止 (PID: $FRONTEND_PID)"
      fi
      rm -f logs/frontend.pid
  fi

  pkill -f "vite" || true
  pkill -f "ts-node-dev" || true

  echo "✅ 所有服务已停止"
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
  echo "========================================="
  echo "  ✅ 所有测试通过！"
  echo "========================================="
  echo ""
  echo "系统运行正常，可以开始使用："
  echo "  前端: http://localhost:5173"
  echo "  后端: http://localhost:3000"
  echo ""
}

show_help() {
  echo "用法："
  echo "  ./start.sh            默认启动（与 --start 等效）"
  echo "  ./start.sh --start    启动前后端服务"
  echo "  ./start.sh --stop     停止所有服务"
  echo "  ./start.sh --restart  重启所有服务"
  echo "  ./start.sh --test     运行系统自检"
  echo "  ./start.sh --help     显示帮助"
}

case "$ACTION" in
  start) do_start ;;
  stop)  do_stop ;;
  restart) do_restart ;;
  test)  do_test ;;
  help)  show_help ;;
esac
