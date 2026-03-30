<template>
  <div class="pane-content">
    <h3 class="section-title">
      系统升级
    </h3>

    <div class="upgrade-card">
      <div class="upgrade-header">
        <h4>版本信息</h4>
        <el-tag
          size="small"
          type="info"
        >
          当前
        </el-tag>
      </div>
      <div class="version-list">
        <div class="version-item">
          <span>Agent版本</span>
          <el-text>{{ props.formData.version || '-' }}</el-text>
        </div>
        <div class="version-item">
          <span>运控版本</span>
          <el-text>{{ props.formData.motion_control_version || '-' }}</el-text>
        </div>
        <div class="version-item">
          <span>Server版本</span>
          <el-text>{{ props.formData.server_version || '-' }}</el-text>
        </div>
      </div>
    </div>

    <div class="upgrade-card">
      <div class="upgrade-header">
        <h4>机器狗固件</h4>
        <el-tag
          size="small"
          type="info"
        >
          当前版本 {{ props.formData.server_version || '-' }}
        </el-tag>
      </div>
      <div class="upgrade-body">
        <p v-if="props.firmwareUpdateAvailable">
          发现新版本 v2.4.0 (2025-01-18)
        </p>
        <p v-else>
          当前已是最新版本
        </p>
        <el-button
          type="primary"
          size="small"
          :disabled="!props.firmwareUpdateAvailable"
          @click="emit('upgrade', 'firmware')"
        >
          {{ props.firmwareUpdateAvailable ? '立即升级' : '检查更新' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RobotSettingsFormData } from '../settings'

const props = defineProps<{
  formData: RobotSettingsFormData
  firmwareUpdateAvailable: boolean
}>()

const emit = defineEmits<{
  upgrade: [type: 'firmware']
}>()
</script>

<style scoped>
.pane-content {
  padding-right: 10px;
}

.section-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.upgrade-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.upgrade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.upgrade-header h4 {
  margin: 0;
}

.upgrade-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upgrade-body p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
