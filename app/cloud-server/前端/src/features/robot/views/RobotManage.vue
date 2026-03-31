<template>
  <div class="robot-manager">
    <PageHeader
      title="机器人管理"
      :icon="Bot"
    >
      <template #extra>
        <div class="header-actions">
          <el-radio-group
            v-model="viewMode"
            size="default"
          >
            <el-radio-button value="card">
              <el-icon>
                <Grid />
              </el-icon>
              卡片
            </el-radio-button>
            <el-radio-button value="list">
              <el-icon>
                <List />
              </el-icon>
              列表
            </el-radio-button>
          </el-radio-group>
          <el-button
            type="primary"
            :icon="Plus"
            @click="goAddRobot"
          >
            添加机器人
          </el-button>
        </div>
      </template>
    </PageHeader>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      style="margin: 20px 20px 0"
    />

    <!-- 卡片视图 -->
    <div
      v-if="viewMode === 'card'"
      v-loading="loading"
      class="robot-cards"
    >
      <el-card
        v-for="robot in robots"
        :key="robot.uuid"
        shadow="hover"
        class="robot-card"
      >
        <template #header>
          <div class="card-header-content">
            <div class="card-title">
              <el-icon :size="20">
                <Bot />
              </el-icon>
              <el-tooltip
                :content="robot.uuid"
                placement="top"
              >
                <span>{{ robot.name || '未命名' }}</span>
              </el-tooltip>
            </div>
            <el-tag
              :type="getStatusType(robot.status)"
              size="small"
              effect="dark"
            >
              {{ statusText(robot.status) }}
            </el-tag>
          </div>
        </template>

        <el-descriptions
          :column="1"
          size="small"
          border
        >
          <el-descriptions-item label="电量">
            {{ formatBattery(robot.battery) }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="hoveredLastConnectedUuid === robot.uuid ? '最后连接时间' : '最后IP'"
            @mouseenter="hoveredLastConnectedUuid = robot.uuid"
            @mouseleave="hoveredLastConnectedUuid = null"
          >
            {{ hoveredLastConnectedUuid === robot.uuid ? formatTime(robot.last_connected) : (robot.ip || '-') }}
          </el-descriptions-item>
          <el-descriptions-item label="分组">
            {{ robot.group_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="标签">
            {{ formatTags(robot.tags) }}
          </el-descriptions-item>
        </el-descriptions>

        <template #footer>
          <el-space wrap>
            <el-button
              size="small"
              :icon="Upload"
              :loading="updating[robot.uuid]"
              title="推送最新安装包到机器人"
              @click="updateFirmware(robot)"
            >
              {{ updating[robot.uuid] ? '推送中' : '推送更新' }}
            </el-button>
            <el-button
              size="small"
              :icon="ChatLineSquare"
              @click="openChat(robot)"
            >
              对话
            </el-button>
            <el-button
              size="small"
              :icon="Edit"
              @click="editRobot(robot)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              :icon="Delete"
              type="danger"
              @click="deleteRobotConfirm(robot)"
            >
              删除
            </el-button>
          </el-space>
        </template>
      </el-card>

      <el-empty
        v-if="!loading && robots.length === 0"
        description="暂无机器人"
      >
        <el-button
          type="primary"
          @click="goAddRobot"
        >
          添加第一个机器人
        </el-button>
      </el-empty>
    </div>

    <!-- 列表视图 -->
    <div
      v-else
      v-loading="loading"
      class="robot-list"
    >
      <el-table
        :data="robots"
        stripe
        style="width: 100%"
      >
        <el-table-column
          prop="name"
          label="名称"
          width="150"
        >
          <template #default="{ row }">
            <div class="name-cell">
              <el-icon>
                <Bot />
              </el-icon>
              <span>{{ row.name || '未命名' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              :type="getStatusType(row.status)"
              size="small"
            >
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="model"
          label="型号"
          width="150"
        />
        <el-table-column
          prop="version"
          label="Agent版本"
          width="120"
        />
        <el-table-column
          prop="motion_control_version"
          label="运控版本"
          width="120"
        />
        <el-table-column
          prop="server_version"
          label="Server版本"
          width="120"
        />
        <el-table-column
          prop="uuid"
          label="UUID"
          min-width="200"
        >
          <template #default="{ row }">
            <el-text
              class="mono"
              size="small"
            >
              {{ row.uuid }}
            </el-text>
          </template>
        </el-table-column>
        <el-table-column
          prop="last_connected"
          label="最近连接"
          width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.last_connected) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="350"
          fixed="right"
        >
          <template #default="{ row }">
            <el-space>
              <el-button
                size="small"
                :loading="updating[row.uuid]"
                title="推送更新"
                @click="updateFirmware(row)"
              >
                {{ updating[row.uuid] ? '推送中' : '推送更新' }}
              </el-button>
              <el-button
                size="small"
                @click="openChat(row)"
              >
                对话
              </el-button>
              <el-button
                size="small"
                @click="editRobot(row)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="deleteRobotConfirm(row)"
              >
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && robots.length === 0"
        description="暂无机器人"
      >
        <el-button
          type="primary"
          @click="goAddRobot"
        >
          添加第一个机器人
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/share/components/PageHeader.vue'
import {
  ChatLineSquare,
  Delete,
  Edit,
  Grid, List,
  Plus,
  Upload
} from '@element-plus/icons-vue'
import type { TagProps } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { updateRobotFirmware } from '../api'
import { useRobotStore } from '../store'
import type { Robot } from '../types'

const router = useRouter()
const robotStore = useRobotStore()
const { loading, robots } = storeToRefs(robotStore)
const viewMode = ref<'card' | 'list'>('card')
const updating = ref<Record<string, boolean>>({})
const error = ref('')
const hoveredLastConnectedUuid = ref<string | null>(null)

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '加载失败'
}

function isConfirmCancelled(error: unknown): boolean {
  return error === 'cancel' || error === 'close'
}

function statusText(status: Robot['status']): string {
  const map: Record<Robot['status'], string> = {
    online: '在线',
    offline: '离线',
    connecting: '连接中',
    error: '异常'
  }
  return map[status] || status
}

function getStatusType(status: Robot['status']): TagProps['type'] {
  const map: Record<Robot['status'], TagProps['type']> = {
    online: 'success',
    offline: 'info',
    connecting: 'warning',
    error: 'danger'
  }
  return map[status] || 'info'
}

function formatTime(val?: string | null) {
  if (!val) return '-'
  const d = new Date(val)
  const t = d.getTime()
  if (isNaN(t)) return typeof val === 'string' ? val : '-'
  return d.toLocaleString('zh-CN')
}

function formatBattery(val?: number | null) {
  if (typeof val !== 'number' || Number.isNaN(val)) return '-'
  return `${Math.round(val)}%`
}

function formatTags(tags?: Robot['tags']) {
  if (!Array.isArray(tags) || tags.length === 0) return '-'
  return tags.join('、')
}

async function loadRobots() {
  error.value = ''
  try {
    await robotStore.fetchRobots()
  } catch (err) {
    error.value = getErrorMessage(err)
  }
}

// 顶部本机IP及相关逻辑已移除

function editRobot(robot: Robot) {
  router.push(`/robots/${robot.uuid}`)
}

function goAddRobot() {
  router.push('/robots/add')
}

async function updateFirmware(robot: Robot) {
  try {
    await ElMessageBox.confirm(
      `确定要更新机器人"${robot.name || robot.uuid}"的客户端代码吗？\n\n这将把最新的客户端代码复制到机器人。`,
      '更新固件',
      {
        type: 'warning',
        confirmButtonText: '确定更新',
        cancelButtonText: '取消'
      }
    )

    updating.value[robot.uuid] = true

    await updateRobotFirmware(robot.uuid)
  } catch (err) {
    if (isConfirmCancelled(err)) {
      return
    }
  } finally {
    updating.value[robot.uuid] = false
  }
}

function openChat(robot: Robot) {
  router.push(`/chat/${robot.uuid}`)
}

async function deleteRobotConfirm(robot: Robot) {
  try {
    await ElMessageBox.confirm(
      `确定要删除机器人"${robot.name || robot.uuid}"吗？`,
      '提示',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await robotStore.deleteRobot(robot.uuid)
  } catch (err) {
    if (isConfirmCancelled(err)) {
      return
    }
  }
}

function handleRobotsUpdated() {
  loadRobots()
}

onMounted(() => {
  loadRobots()
  window.addEventListener('robots_updated', handleRobotsUpdated)
})

onUnmounted(() => {
  window.removeEventListener('robots_updated', handleRobotsUpdated)
})
</script>

<style scoped>
.robot-manager {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-actions .el-radio-group {
  margin-right: 20px;
}

.header-actions :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
  height: 32px;
  padding: 0 12px;
}

.header-actions :deep(.el-radio-button__inner .el-icon) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.header-actions .el-button .el-icon {
  margin-right: 8px;
}

.robot-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  padding: 4px;
}

.robot-card {
  transition: transform 0.2s;
}

.robot-card:hover {
  transform: translateY(-4px);
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.robot-list {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mono {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 12px;
}
</style>
