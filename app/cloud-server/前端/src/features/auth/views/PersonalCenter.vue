<template>
  <div class="page">
    <PageHeader
      title="个人资料"
      :icon="User"
      @back="goHome"
    >
      <template #extra>
        <el-button
          type="primary"
          :icon="HomeFilled"
          @click="goHome"
        >
          首页
        </el-button>
      </template>
    </PageHeader>

    <el-row :gutter="20">
      <el-col
        :span="8"
        :xs="24"
      >
        <el-card
          shadow="hover"
          class="profile-card"
        >
          <div class="avatar-container">
            <el-avatar
              :size="100"
              class="user-avatar"
            >
              {{ userInfo?.username?.charAt(0)?.toUpperCase() }}
            </el-avatar>
            <h2 class="username">
              {{ userInfo?.username }}
            </h2>
            <el-tag
              :type="roleType"
              effect="dark"
              round
            >
              {{ roleName }}
            </el-tag>
          </div>
          <div class="user-stats">
            <div class="stat-item">
              <span class="label">注册时间</span>
              <span class="value">{{ userInfo?.createdAt ? formatDate(userInfo.createdAt) : '-' }}</span>
            </div>
            <div class="stat-item">
              <span class="label">最后更新</span>
              <span class="value">{{ userInfo?.updatedAt ? formatDate(userInfo.updatedAt) : '-' }}</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="16"
        :xs="24"
      >
        <el-card
          shadow="hover"
          header="基本信息"
          class="info-card"
        >
          <el-descriptions
            :column="1"
            border
          >
            <el-descriptions-item label="用户ID">
              {{ userInfo?.id }}
            </el-descriptions-item>
            <el-descriptions-item label="用户名">
              {{ userInfo?.username }}
            </el-descriptions-item>
            <el-descriptions-item label="角色权限">
              <el-tag
                :type="roleType"
                size="small"
              >
                {{ roleName }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="最近登录">
              {{ userInfo?.lastLoginAt ? formatDateTime(userInfo.lastLoginAt) : '从未登录' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/features/auth/store'
import PageHeader from '@/share/components/PageHeader.vue'
import { formatDate, formatDateTime } from '@/share/utils/date'
import { HomeFilled, User } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()
const userInfo = computed(() => authStore.user)

const roleName = computed(() => {
  const role = userInfo.value?.role
  switch (role) {
    case 'super_admin':
      return '超级管理员'
    case 'admin':
      return '管理员'
    case 'user':
      return '普通用户'
    default:
      return role
  }
})

const roleType = computed(() => {
  const role = userInfo.value?.role
  switch (role) {
    case 'super_admin':
      return 'danger'
    case 'admin':
      return 'warning'
    case 'user':
      return 'primary'
    default:
      return 'info'
  }
})

const goHome = () => {
  router.push('/home')
}
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.profile-card {
  text-align: center;
  margin-bottom: 20px;
}

.info-card {
  margin-bottom: 20px;
}

.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.user-avatar {
  font-size: 32px;
  background-color: var(--el-color-primary);
}

.username {
  margin: 16px 0 8px;
  font-size: 24px;
  color: var(--el-text-color-primary);
}

.user-stats {
  margin-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 24px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-item .label {
  color: var(--el-text-color-secondary);
}

.stat-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}
</style>
