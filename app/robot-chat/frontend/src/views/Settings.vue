<template>
  <div class="page">
    <el-page-header @back="() => {}" class="page-header">
      <template #content>
        <div class="header-content">
          <el-icon :size="24"><Tools /></el-icon>
          <span class="title">系统设置</span>
        </div>
      </template>
    </el-page-header>

    <div class="content">
      <el-card shadow="hover">
        <el-form :model="formData" label-width="140px" label-position="left">
          <el-form-item label="后端地址">
            <el-input v-model="serverUrl" placeholder="http://localhost:3000" />
          </el-form-item>
          <el-form-item label="WebSocket路径">
            <el-input v-model="wsPath" placeholder="/api/conversation/connect" />
          </el-form-item>
          <el-form-item label="主题">
            <el-radio-group v-model="theme">
              <el-radio value="system">跟随系统</el-radio>
              <el-radio value="dark">深色</el-radio>
              <el-radio value="light">浅色</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="save" :icon="Select">
              保存
            </el-button>
            <el-text v-if="saved" type="success" style="margin-left: 12px">
              已保存
            </el-text>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Tools, Select } from '@element-plus/icons-vue'

const formData = ref({})
const serverUrl = ref('')
const wsPath = ref('/api/conversation/connect')
const theme = ref<'system' | 'dark' | 'light'>('system')
const saved = ref(false)

onMounted(() => {
  serverUrl.value = localStorage.getItem('rc_server_url') || ''
  wsPath.value = localStorage.getItem('rc_ws_path') || '/api/conversation/connect'
  theme.value = (localStorage.getItem('rc_theme') as any) || 'system'
})

const save = () => {
  localStorage.setItem('rc_server_url', serverUrl.value)
  localStorage.setItem('rc_ws_path', wsPath.value)
  localStorage.setItem('rc_theme', theme.value)
  saved.value = true
  setTimeout(() => (saved.value = false), 1200)
}
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.page-header {
  margin-bottom: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.content {
  max-width: 800px;
}

:deep(.el-card__body) {
  padding: 30px;
}
</style>
