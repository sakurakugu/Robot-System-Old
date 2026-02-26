<template>
  <div class="robot-add">
    <PageHeader
      title="新增机器人"
      :icon="Bot"
      @back="goBack"
    />

    <el-card class="section-card">
      <template #header>
        <div class="section-header">
          <el-text
            type="info"
            size="small"
          >
            自动发现局域网内的机器人
          </el-text>
          <el-button
            type="primary"
            size="small"
            :icon="Refresh"
            :loading="discovering"
            @click="discoverRobots"
          >
            {{ discovering ? '扫描中...' : '扫描' }}
          </el-button>
        </div>
      </template>

      <div
        v-if="discoveredRobots.length > 0"
        class="discovered-list"
      >
        <el-card
          v-for="robot in discoveredRobots"
          :key="robot.uuid"
          shadow="hover"
          class="discovered-robot"
          :class="{ selected: selectedDiscoveredRobot?.uuid === robot.uuid }"
          @click="selectDiscoveredRobot(robot)"
        >
          <div class="robot-info">
            <div class="robot-main">
              <el-icon
                :size="20"
                color="var(--el-color-primary)"
              >
                <Bot />
              </el-icon>
              <div class="robot-details">
                <span class="robot-name">{{ robot.name }}</span>
                <span class="robot-model">{{ robot.model }} · {{ robot.version }}</span>
              </div>
            </div>
            <div class="robot-ip">
              <el-tag
                size="small"
                type="success"
              >
                {{ robot.ip }}:{{ robot.port }}
              </el-tag>
            </div>
          </div>
          <div class="robot-uuid">
            <el-text
              class="mono"
              size="small"
              type="info"
            >
              {{ robot.uuid }}
            </el-text>
          </div>
        </el-card>
      </div>

      <el-empty
        v-else-if="!discovering && hasScanned"
        description="未发现机器人"
        :image-size="60"
      />
    </el-card>

    <el-card class="section-card">
      <template #header>
        <el-text
          type="info"
          size="small"
        >
          或手动输入
        </el-text>
      </template>

      <el-form
        :model="formData"
        label-width="100px"
      >
        <el-form-item
          label="名称"
          required
        >
          <el-input
            v-model="formData.name"
            placeholder="例如：机器狗1"
          />
        </el-form-item>
        <el-form-item label="机器人IP">
          <el-input
            v-model="formData.robot_ip"
            placeholder="例如：192.168.1.110"
          />
          <el-text
            v-if="formData.robot_ip && !isValidIp(formData.robot_ip)"
            type="danger"
            size="small"
          >
            IP格式不正确
          </el-text>
        </el-form-item>
        <el-form-item label="分组">
          <el-select
            v-model="formData.group_name"
            placeholder="选择分组"
            allow-create
            filterable
            default-first-option
          >
            <el-option
              label="默认分组"
              value="Default"
            />
            <el-option
              label="开发测试"
              value="Dev"
            />
            <el-option
              label="演示展厅"
              value="Demo"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="goBack">
            取消
          </el-button>
          <el-button
            v-if="selectedDiscoveredRobot"
            type="success"
            :loading="adding"
            @click="addDiscoveredRobot"
          >
            添加已发现的机器人
          </el-button>
          <el-button
            v-else
            type="primary"
            :disabled="!isFormValid"
            :loading="adding"
            @click="saveRobot"
          >
            手动添加
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type Robot = {
  uuid: string
  name?: string | null
  model?: string | null
  status: 'online' | 'offline' | 'connecting' | 'error'
  last_connected?: string | null
  robot_ip?: string | null
  local_ip?: string | null
  local_port?: number
  group_name?: string | null
}

type DiscoveredRobot = {
  uuid: string
  name: string
  model: string
  version: string
  ip: string
  port: number
}

type FormData = {
  name: string
  robot_ip: string
  group_name: string
}

const router = useRouter()

const robots = ref<Robot[]>([])
const discovering = ref(false)
const hasScanned = ref(false)
const discoveredRobots = ref<DiscoveredRobot[]>([])
const selectedDiscoveredRobot = ref<DiscoveredRobot | null>(null)
const adding = ref(false)

const formData = ref<FormData>({
  name: '',
  robot_ip: '',
  group_name: ''
})

const isValidIp = (ip: string) => {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/
  return ipv4.test(ip)
}

const isFormValid = computed(() => {
  return Boolean(
    formData.value.name &&
    (!formData.value.robot_ip || isValidIp(formData.value.robot_ip))
  )
})

function goBack() {
  router.push('/robots')
}

function notifyRobotsUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('robots_updated'))
  } catch (e: any) {
    ElMessage.error(e?.message || '通知失败')
  }
}

async function loadRobots() {
  try {
    const res = await fetch('/api/v1/robots')
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }
    let json: any
    try {
      json = await res.json()
    } catch {
      const text = await res.text()
      throw new Error(text || '接口返回空内容')
    }
    if (!json.success) throw new Error(json.error || '加载失败')
    const list: any[] = json.data.robots || []
    robots.value = list.map((r) => {
      let meta: any = {}
      try {
        meta = r.metadata ? JSON.parse(r.metadata) : {}
      } catch {
        meta = {}
      }
      return {
        uuid: r.uuid,
        name: r.name || '',
        model: r.model || '',
        status: r.status || 'offline',
        last_connected: r.last_connected || null,
        robot_ip: r.robot_ip ?? meta.robot_ip ?? '',
        local_ip: r.local_ip ?? meta.local_ip ?? '',
        local_port: r.local_port ?? meta.local_port ?? 10000,
        group_name: r.group_name ?? meta.group_name ?? ''
      }
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  }
}

async function discoverRobots() {
  discovering.value = true
  hasScanned.value = true
  discoveredRobots.value = []
  selectedDiscoveredRobot.value = null

  try {
    const res = await fetch('/api/v1/robots/discover?timeout=3')
    const json = await res.json().catch(() => ({}))

    if (res.ok && json.success) {
      const existingUuids = new Set(robots.value.map(r => r.uuid))
      discoveredRobots.value = (json.data?.robots || []).filter(
        (r: DiscoveredRobot) => !existingUuids.has(r.uuid)
      )

      if (discoveredRobots.value.length === 0 && json.data?.robots?.length > 0) {
        ElMessage.info('所有发现的机器人都已添加')
      } else if (discoveredRobots.value.length > 0) {
        ElMessage.success(`发现 ${discoveredRobots.value.length} 个新机器人`)
      }
    } else {
      ElMessage.warning(json.error || '扫描失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '扫描失败')
  } finally {
    discovering.value = false
  }
}

function selectDiscoveredRobot(robot: DiscoveredRobot) {
  if (selectedDiscoveredRobot.value?.uuid === robot.uuid) {
    selectedDiscoveredRobot.value = null
  } else {
    selectedDiscoveredRobot.value = robot
    formData.value.name = robot.name
    formData.value.robot_ip = robot.ip
  }
}

async function addDiscoveredRobot() {
  if (!selectedDiscoveredRobot.value) return

  adding.value = true
  const robot = selectedDiscoveredRobot.value

  try {
    const payload = {
      name: robot.name,
      robot_ip: robot.ip,
      group_name: formData.value.group_name || ''
    }

    const res = await fetch('/api/v1/robots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)

    notifyRobotsUpdated()
    ElMessage.success(`机器人 "${robot.name}" 添加成功`)
    goBack()
  } catch (e: any) {
    ElMessage.error(e?.message || '添加失败')
  } finally {
    adding.value = false
  }
}

async function saveRobot() {
  const payload = {
    name: formData.value.name,
    robot_ip: formData.value.robot_ip,
    group_name: formData.value.group_name || ''
  }
  try {
    const res = await fetch('/api/v1/robots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
    notifyRobotsUpdated()
    ElMessage.success('添加成功')
    goBack()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

onMounted(async () => {
  await loadRobots()
  discoverRobots()
})
</script>

<style scoped>
.robot-add {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  border-radius: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.discovered-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discovered-robot {
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.discovered-robot.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.robot-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.robot-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.robot-details {
  display: flex;
  flex-direction: column;
}

.robot-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.robot-model {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.robot-ip {
  display: flex;
  align-items: center;
}

.robot-uuid {
  margin-top: 8px;
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
</style>
