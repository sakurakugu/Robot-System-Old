<template>
  <div class="pane-content">
    <h3 class="section-title">
      日志管理
    </h3>

    <div class="log-mark-section">
      <h4 class="subsection-title">
        日志标记
      </h4>
      <el-form label-width="80px">
        <el-form-item label="标记内容">
          <el-input
            v-model="markMessage"
            placeholder="可选，空则使用默认标记"
            clearable
            style="max-width: 360px;"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="warning"
            :loading="markingLog"
            :disabled="!props.connected"
            @click="markLog"
          >
            打日志标记
          </el-button>
          <el-text
            v-if="!props.connected"
            type="info"
            size="small"
            style="margin-left: 8px;"
          >
            机器人未连接
          </el-text>
        </el-form-item>
      </el-form>
    </div>

    <el-divider />

    <el-form label-position="top">
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="logDateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="日志类型">
        <el-radio-group v-model="logType">
          <el-radio-button label="robot">
            机器人日志
          </el-radio-button>
          <el-radio-button label="app">
            APP日志
          </el-radio-button>
          <el-radio-button label="all">
            全部日志
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :loading="uploadingLogs"
          @click="uploadLogs"
        >
          打包上传
        </el-button>
      </el-form-item>
    </el-form>

    <div class="log-history">
      <h4>最近上传记录</h4>
      <el-table
        :data="logHistory"
        style="width: 100%"
        size="small"
      >
        <el-table-column
          prop="time"
          label="时间"
          width="160"
        />
        <el-table-column
          prop="type"
          label="类型"
          width="100"
        >
          <template #default="scope">
            {{ getLogTypeLabel(scope.row.type) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="size"
          label="大小"
        />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, ref } from 'vue'
import { markRobotLog } from '../api'
import { getRobotErrorMessage } from '../settings'

type LogType = 'robot' | 'app' | 'all'
type LogHistoryEntry = { time: string; type: LogType; size: string }

const props = defineProps<{
  robotUuid?: string
  connected: boolean
}>()

const logDateRange = ref('')
const logType = ref<LogType>('all')
const uploadingLogs = ref(false)
const markingLog = ref(false)
const markMessage = ref('')
const logHistory = ref<LogHistoryEntry[]>([])
let uploadTimer: ReturnType<typeof setTimeout> | null = null

const getLogTypeLabel = (type: string) => {
  const map: Record<string, string> = { robot: '机器人', app: 'APP', all: '全部' }
  return map[type] || type
}

const uploadLogs = () => {
  uploadingLogs.value = true
  uploadTimer = setTimeout(() => {
    uploadingLogs.value = false
    ElMessage.success('日志上传成功')
    logHistory.value.unshift({
      time: new Date().toLocaleString(),
      type: logType.value,
      size: '1.5MB',
    })
    if (logHistory.value.length > 5) {
      logHistory.value.pop()
    }
    uploadTimer = null
  }, 1500)
}

const markLog = async () => {
  if (!props.robotUuid) {
    ElMessage.warning('请先选择机器人')
    return
  }

  markingLog.value = true
  try {
    await markRobotLog(props.robotUuid, markMessage.value)
    ElMessage.success('日志标记已写入')
  } catch (error) {
    ElMessage.error(`写入标记失败: ${getRobotErrorMessage(error, '网络错误')}`)
  } finally {
    markingLog.value = false
  }
}

onBeforeUnmount(() => {
  if (uploadTimer) {
    clearTimeout(uploadTimer)
    uploadTimer = null
  }
})
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

.subsection-title {
  margin-top: 15px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.log-mark-section {
  margin-bottom: 10px;
}

.log-history {
  margin-top: 30px;
}

.log-history h4 {
  margin-bottom: 10px;
}
</style>
