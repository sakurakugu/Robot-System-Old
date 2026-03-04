<template>
  <div class="auth-page">
    <div class="auth-wrapper">
      <div class="brand">
        <div class="brand-icon-wrap">
          <Bot
            :size="36"
            color="white"
          />
        </div>
        <h1 class="brand-title">
          机器狗管理系统
        </h1>
        <p class="brand-sub">
          登录以访问机器人操控与管理功能
        </p>
      </div>

      <el-card
        class="auth-card"
        shadow="hover"
      >
        <el-tabs
          v-model="activeTab"
          class="auth-tabs"
        >
          <el-tab-pane
            label="登录"
            name="login"
          >
            <el-form class="auth-form">
              <el-form-item>
                <el-input
                  v-model="loginForm.username"
                  placeholder="用户名"
                  :prefix-icon="User"
                  size="large"
                  autocomplete="username"
                />
              </el-form-item>
              <el-form-item>
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  show-password
                  placeholder="密码"
                  :prefix-icon="Lock"
                  size="large"
                  autocomplete="current-password"
                  @keyup.enter="doLogin"
                />
              </el-form-item>
              <el-button
                type="primary"
                size="large"
                class="full-btn"
                :loading="loading"
                @click="doLogin"
              >
                登录
              </el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane
            label="注册"
            name="register"
          >
            <el-form class="auth-form">
              <el-form-item>
                <el-input
                  v-model="registerForm.username"
                  placeholder="用户名"
                  :prefix-icon="User"
                  size="large"
                  autocomplete="username"
                />
              </el-form-item>
              <el-form-item>
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  show-password
                  placeholder="密码（至少6位）"
                  :prefix-icon="Lock"
                  size="large"
                  autocomplete="new-password"
                  @keyup.enter="doRegister"
                />
              </el-form-item>
              <el-button
                type="primary"
                size="large"
                class="full-btn"
                :loading="loading"
                @click="doRegister"
              >
                注册并登录
              </el-button>
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <el-divider>
          <span class="divider-text">或者</span>
        </el-divider>

        <el-button
          plain
          size="large"
          class="full-btn guest-btn"
          @click="enterGuest"
        >
          <el-icon class="guest-icon">
            <UserFilled />
          </el-icon>
          游客模式继续使用
        </el-button>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/modules/auth/store'
import { Lock, User, UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'login' | 'register'>('login')
const loading = ref(false)

const loginForm = reactive({ username: '', password: '' })
const registerForm = reactive({ username: '', password: '' })

const doLogin = async () => {
  try {
    loading.value = true
    await authStore.login(loginForm.username, loginForm.password)
    ElMessage.success('登录成功')
    router.replace('/robots')
  } finally {
    loading.value = false
  }
}

const doRegister = async () => {
  try {
    loading.value = true
    const data = await authStore.register(registerForm.username, registerForm.password)
    ElMessage.success(data.user.role === 'super_admin' ? '注册成功，你是首个用户，已设为主管理员' : '注册成功')
    router.replace('/robots')
  } finally {
    loading.value = false
  }
}

const enterGuest = () => {
  authStore.enterGuestMode()
  router.replace('/robots')
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-wrapper {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.brand {
  text-align: center;
  color: white;
}

.brand-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  margin-bottom: 16px;
  backdrop-filter: blur(10px);
}

.brand-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.brand-sub {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

.auth-card {
  width: 100%;
  border-radius: 16px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.auth-form .el-form-item {
  margin-bottom: 12px;
}

.full-btn {
  width: 100%;
  margin-top: 4px;
}

.guest-btn {
  margin-top: 0;
}

.guest-icon {
  margin-right: 4px;
}

.divider-text {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

:deep(.auth-tabs .el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.auth-tabs .el-tabs__item) {
  font-size: 15px;
  font-weight: 600;
  padding: 0 20px;
}

:deep(.auth-tabs .el-tabs__active-bar) {
  height: 3px;
  border-radius: 2px;
}
</style>
