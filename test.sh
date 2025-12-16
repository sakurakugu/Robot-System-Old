#!/bin/bash

# 系统测试脚本

echo "========================================="
echo "  机器狗控制系统 - 系统测试"
echo "========================================="
echo ""

# 测试后端健康检查
echo "1. 测试后端健康检查..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if [ $? -eq 0 ]; then
    echo "   ✅ 后端服务正常: $HEALTH_RESPONSE"
else
    echo "   ❌ 后端服务异常"
    exit 1
fi

# 测试获取项目列表
echo "2. 测试获取项目列表..."
PROJECTS_RESPONSE=$(curl -s http://localhost:3000/api/projects)
if [ $? -eq 0 ]; then
    echo "   ✅ 项目列表 API 正常"
else
    echo "   ❌ 项目列表 API 异常"
    exit 1
fi

# 测试前端
echo "3. 测试前端服务..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
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
