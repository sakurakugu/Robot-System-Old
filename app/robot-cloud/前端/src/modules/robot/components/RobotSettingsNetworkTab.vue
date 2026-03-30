<template>
  <div class="pane-content">
    <h3 class="section-title">
      网络配置
    </h3>
    <el-form
      :model="props.formData"
      label-width="100px"
    >
      <el-form-item label="机器人IP">
        <el-input
          v-model="robotIp"
          placeholder="例如：192.168.1.110"
          @change="emit('auto-save', 'ip')"
        >
          <template #append>
            <el-button
              :disabled="!props.formData.ip"
              @click="copyText(props.formData.ip)"
            >
              复制
            </el-button>
          </template>
        </el-input>
        <el-text
          v-if="props.formData.ip && !isValidIP(props.formData.ip)"
          type="danger"
          size="small"
        >
          IP格式不正确
        </el-text>
      </el-form-item>
      <el-form-item label="本地IP">
        <el-input
          :model-value="props.formData.local_ip"
          disabled
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :loading="testingNetwork"
          @click="testConnection"
        >
          测试连接
        </el-button>
        <el-button
          type="success"
          :disabled="!canOpenWifi"
          @click="openWifiSettings"
        >
          修改WiFi
        </el-button>
        <span
          v-if="networkResult"
          :class="['network-result', networkResult.success ? 'success' : 'error']"
        >
          {{ networkResult.message }}
        </span>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { isValidIP } from '@/utils/validator'
import { testRobotConnection as runRobotConnectionTest } from '../api'
import { getRobotErrorMessage } from '../settings'
import type { RobotSettingsField, RobotSettingsFormData } from '../settings'

const props = defineProps<{
  formData: RobotSettingsFormData
  robotUuid?: string
  connected: boolean
}>()

const emit = defineEmits<{
  'auto-save': [field: RobotSettingsField]
  'connection-tested': [connected: boolean]
  'update-field': [field: keyof RobotSettingsFormData, value: RobotSettingsFormData[keyof RobotSettingsFormData]]
}>()

const testingNetwork = ref(false)
const networkResult = ref<{ success: boolean; message: string } | null>(null)
const canOpenWifi = computed(() => props.connected && isValidIP(props.formData.ip))
const robotIp = computed({
  get: () => props.formData.ip,
  set: (value: string) => emit('update-field', 'ip', value),
})

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch (error) {
    ElMessage.error(getRobotErrorMessage(error, '复制失败'))
  }
}

const testConnection = async () => {
  if (!props.robotUuid) {
    ElMessage.warning('请先选择机器人')
    return
  }

  testingNetwork.value = true
  networkResult.value = null
  try {
    const result = await runRobotConnectionTest(props.robotUuid)
    emit('connection-tested', result.connected)
    networkResult.value = {
      success: result.connected,
      message: result.message || (result.connected ? '连接成功' : '连接失败'),
    }
  } catch (error) {
    networkResult.value = {
      success: false,
      message: getRobotErrorMessage(error, '测试失败'),
    }
  } finally {
    testingNetwork.value = false
  }
}

const openWifiSettings = () => {
  if (!props.connected) {
    ElMessage.warning('机器人未连接')
    return
  }
  if (!props.formData.ip || !isValidIP(props.formData.ip)) {
    ElMessage.warning('IP格式不正确')
    return
  }
  const url = `http://${props.formData.ip}:8080`
  window.open(url, '_blank')
}
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

.network-result {
  margin-left: 10px;
  font-size: 13px;
}

.network-result.success {
  color: #67c23a;
}

.network-result.error {
  color: #f56c6c;
}
</style>
