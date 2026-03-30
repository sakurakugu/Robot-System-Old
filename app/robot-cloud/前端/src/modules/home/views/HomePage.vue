<template>
  <div class="home-page">
    <!-- 顶栏 -->
    <div class="header">
      <div class="header-left">
        <Bot
          :size="24"
          class="logo-icon"
        />
        <span class="title">首页</span>
      </div>
      <!-- 头像框 -->
      <div class="header-right">
        <el-dropdown
          trigger="click"
          @command="handleCommand"
        >
          <div class="avatar-wrapper">
            <el-avatar
              :size="40"
              class="user-avatar"
            >
              {{ displayName }}
            </el-avatar>
            <span class="username">{{ userName }}</span>
            <el-icon class="dropdown-icon">
              <ArrowDown />
            </el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="controlPanel">
                <el-icon><User /></el-icon>
                <span>控制面板</span>
              </el-dropdown-item>
              <el-dropdown-item
                v-if="!isAuthenticated"
                command="login"
              >
                <el-icon><Key /></el-icon>
                <span>登录 / 注册</span>
              </el-dropdown-item>
              <el-dropdown-item
                v-if="isAuthenticated"
                command="logout"
                divided
              >
                <el-icon><SwitchButton /></el-icon>
                <span>退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 中间内容区域 -->
    <div class="content">
      <el-empty description="内容区域" />
    </div>

    <!-- 底栏 -->
    <div class="footer">
      <div class="footer-content">
        <span>© 2026 我是测试</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/modules/auth/store'
import { ArrowDown, Key, SwitchButton, User } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const userName = computed(() => authStore.user?.username || '游客')
const displayName = computed(() => {
  if (authStore.user?.username) {
    return authStore.user.username.charAt(0).toUpperCase()
  }
  return '客'
})

const handleCommand = async (command: string) => {
  switch (command) {
    case 'controlPanel':
      // 已登录进入控制面板，未登录也进入控制面板页面（会提示登录）
      router.push('/personal')
      break
    case 'login':
      router.push('/auth')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })
        await authStore.logout()
        ElMessage.success('已退出登录')
        router.push('/auth')
      } catch {
        // 用户取消
      }
      break
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

/* 顶栏样式 */
.header {
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.logo-icon {
  font-size: 24px;
}

.title {
  font-size: 20px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
}

.avatar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background-color 0.3s;
}

.avatar-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.user-avatar {
  background-color: white;
  color: #667eea;
  font-weight: 600;
  font-size: 16px;
}

.username {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.dropdown-icon {
  color: white;
  font-size: 12px;
}

/* 中间内容区域 */
.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

/* 底栏样式 */
.footer {
  height: 50px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-content {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
</style>
