<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-content">
        <el-icon
          class="logo-icon"
          :size="24"
        >
          <Bot />
        </el-icon>
        <h1>机器狗管理应用</h1>
        <el-button
          text
          class="home-btn"
          @click="goHome"
        >
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-button>
      </div>
      <div class="header-actions">
        <!-- 用户头像下拉菜单 -->
        <el-dropdown
          trigger="click"
          @command="handleCommand"
        >
          <div class="avatar-wrapper">
            <el-avatar
              :size="32"
              class="header-avatar"
            >
              {{ displayName }}
            </el-avatar>
            <span class="username-text">{{ userName }}</span>
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
                v-if="!authStore.isAuthenticated"
                command="login"
              >
                <el-icon><Key /></el-icon>
                <span>登录 / 注册</span>
              </el-dropdown-item>
              <el-dropdown-item
                v-if="authStore.isAuthenticated"
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
    </el-header>
    <el-container class="main-container">
      <el-aside
        :width="asideWidth + 'px'"
        class="layout-aside"
        :class="{ collapsed: isCollapse }"
      >
        <el-menu
          :default-active="activeMenu"
          class="el-menu-vertical"
          :collapse="isCollapse"
          :collapse-transition="false"
          router
        >
          <el-menu-item index="/robots">
            <el-icon><List /></el-icon>
            <template #title>
              机器人管理
            </template>
          </el-menu-item>
          <el-menu-item index="/roles">
            <el-icon><UserFilled /></el-icon>
            <template #title>
              角色管理
            </template>
          </el-menu-item>
          <el-menu-item index="/operation">
            <el-icon><VideoPlay /></el-icon>
            <template #title>
              机器人操作
            </template>
          </el-menu-item>
          <el-menu-item index="/choreo">
            <el-icon><Film /></el-icon>
            <template #title>
              编舞系统
            </template>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isAdmin"
            index="/params"
          >
            <el-icon><Setting /></el-icon>
            <template #title>
              参数管理
            </template>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isAdmin"
            index="/update-manage"
          >
            <el-icon><UploadFilled /></el-icon>
            <template #title>
              更新管理
            </template>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isAdmin"
            index="/kb"
          >
            <el-icon><Collection /></el-icon>
            <template #title>
              知识库
            </template>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isAdmin"
            index="/feedback-manage"
          >
            <el-icon><ChatDotRound /></el-icon>
            <template #title>
              反馈管理
            </template>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isSuperAdmin"
            index="/users"
          >
            <el-icon><UserFilled /></el-icon>
            <template #title>
              用户权限
            </template>
          </el-menu-item>
          <el-sub-menu index="personal-center">
            <template #title>
              <el-icon><User /></el-icon>
              <span>个人中心</span>
            </template>
            <el-menu-item index="/personal">
              <el-icon><User /></el-icon>
              <template #title>
                个人资料
              </template>
            </el-menu-item>
            <el-menu-item index="/sessions">
              <el-icon><Monitor /></el-icon>
              <template #title>
                登录设备
              </template>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item index="/settings">
            <el-icon><Tools /></el-icon>
            <template #title>
              系统设置
            </template>
          </el-menu-item>
        </el-menu>
        <div
          class="collapse-toggle"
          @click="toggleCollapse"
        >
          <el-icon><DArrowLeft v-if="!isCollapse" /><DArrowRight v-else /></el-icon>
        </div>
      </el-aside>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ArrowDown, ChatDotRound, Collection, DArrowLeft, DArrowRight, Film, HomeFilled, Key, List, Monitor, Setting, SwitchButton, Tools, UploadFilled, User, UserFilled, VideoPlay } from '@element-plus/icons-vue'
import { useAuthStore } from '@/modules/auth/store'
import { Bot } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isCollapse = ref(false)
const asideWidth = computed(() => isCollapse.value ? 64 : 200)

const userName = computed(() => authStore.user?.username || '游客')
const displayName = computed(() => {
  if (authStore.user?.username) {
    return authStore.user.username.charAt(0).toUpperCase()
  }
  return '客'
})

// 计算当前激活的菜单项
const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/home')) return '/home'
  if (path.startsWith('/robots')) return '/robots'
  if (path.startsWith('/roles')) return '/roles'
  if (path.startsWith('/operation')) return '/operation'
  if (path.startsWith('/choreo')) return '/choreo'
  if (path.startsWith('/params')) return '/params'
  if (path.startsWith('/update-manage')) return '/update-manage'
  if (path.startsWith('/kb')) return '/kb'
  if (path.startsWith('/feedback-manage')) return '/feedback-manage'
  if (path.startsWith('/users')) return '/users'
  if (path.startsWith('/personal')) return '/personal'
  if (path.startsWith('/sessions')) return '/sessions'
  if (path.startsWith('/settings')) return '/settings'
  return path
})

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const goHome = () => {
  router.push('/home')
}

const handleCommand = async (command: string) => {
  switch (command) {
    case 'controlPanel':
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
.layout-container {
  height: 100vh;
  width: 100%;
}

.layout-header {
  height: 60px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.logo-icon {
  font-size: 24px;
}

.layout-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.home-btn:hover {
  color: white !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

/* 头像下拉样式 */
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

.header-avatar {
  background-color: white;
  color: #667eea;
  font-weight: 600;
  font-size: 14px;
}

.username-text {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.dropdown-icon {
  color: white;
  font-size: 12px;
}

.main-container {
  height: calc(100vh - 60px);
}

.layout-aside {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  transition: width 0.3s;
  position: relative;
  display: flex;
  flex-direction: column;
}

.layout-aside.collapsed {
  overflow: hidden;
  overflow-x: hidden;
  scrollbar-width: none;
}

.el-menu-vertical {
  border: none;
  flex: 1;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 100%;
}

.layout-aside.collapsed .el-menu-vertical {
  overflow: hidden;
  overflow-x: hidden;
  min-width: 0;
  scrollbar-width: none;
}

.layout-aside.collapsed .collapse-toggle {
  overflow: hidden;
}

.layout-aside.collapsed ::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.collapse-toggle {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-top: 1px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  transition: all 0.3s;
}

.collapse-toggle:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.layout-main {
  background: var(--el-bg-color-page);
  padding: 0;
  overflow: auto;
}
</style>
