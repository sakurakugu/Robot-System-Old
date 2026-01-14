<template>
  <div class="robot-manager">
    <div class="header">
      <h2>机器人管理</h2>
      <div class="header-center">
        <div class="local-ip-config">
          <label>本机IP:</label>
          <div class="ip-input-group">
            <input v-model="unifiedLocalIp" type="text" placeholder="自动获取中..." @change="updateAllRobotsLocalIp" />
            <button class="btn-icon" @click="fetchLocalIp" title="刷新本机IP">
              <el-icon><Refresh /></el-icon>
            </button>
            <button class="btn-icon" @click="overwriteAllRobotsLocalIp" title="一键覆盖所有机器人的本地IP">
              <el-icon><Download /></el-icon>
            </button>
          </div>
        </div>
      </div>
      <div class="actions" :class="[{ compact: actionsCompact }, { ultra: actionsUltra }]" ref="actionsRef">
        <el-radio-group v-model="viewMode" size="default">
          <el-radio-button value="card">
            <el-icon><Menu /></el-icon>
            <span class="view-label">卡片视图</span>
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><List /></el-icon>
            <span class="view-label">列表视图</span>
          </el-radio-button>
        </el-radio-group>
        <button class="btn-primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          <span class="btn-label">添加机器人</span>
        </button>
      </div>
    </div>

    <div v-if="error" class="error-hint">{{ error }}</div>

    <div v-if="viewMode === 'card'" class="robot-cards">
      <div v-for="robot in robots" :key="robot.uuid" class="robot-card">
        <div class="card-header">
          <h3>{{ robot.name || '-' }}</h3>
          <span class="status-badge" :class="robot.status">
            <span class="status-label">{{ statusText(robot.status) }}</span>
          </span>
        </div>

        <div class="card-body">
          <div class="info-row">
            <span class="label">UUID:</span>
            <span class="value mono">{{ robot.uuid }}</span>
          </div>
          <div class="info-row">
            <span class="label">型号:</span>
            <span class="value">{{ robot.model || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">最近连接:</span>
            <span class="value">{{ formatTime(robot.last_connected) }}</span>
          </div>

          <div v-if="robot.status === 'offline' && connectionErrors[robot.uuid]" class="error-message">
            <span class="error-icon">⚠</span>
            <span class="error-text">{{ connectionErrors[robot.uuid] }}</span>
            <button class="error-close" @click="dismissError(robot.uuid)" title="关闭">×</button>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn-test" @click="robot.status === 'online' ? connectNow(robot) : testConnection(robot)" :disabled="testing[robot.uuid]">
            {{ testing[robot.uuid] ? '测试中...' : (robot.status === 'online' ? '连接' : '测试连接') }}
          </button>
          <button class="btn-edit" @click="editRobot(robot)">编辑</button>
          <button class="btn-delete" @click="deleteRobotConfirm(robot)">删除</button>
        </div>
      </div>

      <div v-if="!loading && robots.length === 0" class="empty-state">
        <p>暂无机器人</p>
        <button class="btn-primary" @click="openAddDialog">添加第一个机器人</button>
      </div>
      <div v-if="loading" class="loading-hint">加载中...</div>
    </div>

    <div v-else class="robot-list">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>型号</th>
              <th>UUID</th>
              <th>最近连接</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="robot in robots" :key="robot.uuid">
              <td>{{ robot.name || '-' }}</td>
              <td>
                <span class="status-badge" :class="robot.status">
                  <span class="status-label">{{ statusText(robot.status) }}</span>
                </span>
              </td>
              <td>{{ robot.model || '-' }}</td>
              <td class="mono">{{ robot.uuid }}</td>
              <td>{{ formatTime(robot.last_connected) }}</td>
              <td class="actions-cell">
                <button class="btn-small" @click="robot.status === 'online' ? connectNow(robot) : testConnection(robot)" :disabled="testing[robot.uuid]">
                  {{ testing[robot.uuid] ? '测试中' : (robot.status === 'online' ? '连接' : '测试') }}
                </button>
                <button class="btn-small" @click="editRobot(robot)">编辑</button>
                <button class="btn-small btn-danger" @click="deleteRobotConfirm(robot)">删除</button>
                <span v-if="robot.status === 'offline' && connectionErrors[robot.uuid]" class="error-indicator"
                  :data-tip="connectionErrors[robot.uuid]" title="连接错误">⚠</span>
              </td>
            </tr>
            <tr v-if="!loading && robots.length === 0">
              <td colspan="6" class="empty-cell">
                暂无机器人，<a @click="openAddDialog">添加一个</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showAddDialog || editingRobot" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingRobot ? '编辑机器人' : '添加机器人' }}</h3>
          <button class="close-btn" @click="closeDialog">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>名称 *</label>
            <input v-model="formData.name" type="text" placeholder="例如：机器狗1" />
          </div>
          <div class="form-group">
            <label>机器人IP</label>
            <input v-model="formData.robot_ip" type="text" placeholder="例如：192.168.1.110" />
            <div v-if="formData.robot_ip && !isValidIp(formData.robot_ip)" class="input-error">IP格式不正确</div>
          </div>
          <div class="form-group">
            <label>本地IP</label>
            <input v-model="formData.local_ip" type="text" placeholder="例如：192.168.1.105" />
            <div v-if="formData.local_ip && !isValidIp(formData.local_ip)" class="input-error">IP格式不正确</div>
          </div>
          <div class="form-group">
            <label>本地端口</label>
            <input v-model="localPortInput" type="text" inputmode="numeric" placeholder="例如：10131" />
            <div v-if="localPortInput && !isValidPort(localPortInput)" class="input-error">端口需为1-65535的整数</div>
          </div>
          <div class="form-group">
            <label>分组</label>
            <input v-model="formData.group_name" type="text" placeholder="选填，例如：舞蹈组" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-primary" @click="saveRobot" :disabled="!isFormValid">
            {{ editingRobot ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showRestartDialog" class="dialog-overlay" @click.self="closeRestartDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>重启运控</h3>
          <button class="close-btn" @click="closeRestartDialog">×</button>
        </div>
        <div class="dialog-body">
          <p>请确认设备已卧倒，避免急停。</p>
          <p v-if="restarting">将在 {{ countdown }} 秒后执行重启，可随时取消。</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeRestartDialog">取消</button>
          <button class="btn-primary" @click="confirmRestart" :disabled="restarting">
            {{ restarting ? '倒计时中' : '确认设备已卧倒' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Menu, List, Refresh, Plus, Download } from '@element-plus/icons-vue'

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

const robots = ref<Robot[]>([])
const unifiedLocalIp = ref('')
const viewMode = ref<'card' | 'list'>('card')
const showAddDialog = ref(false)
const editingRobot = ref<Robot | null>(null)
const testing = ref<Record<string, boolean>>({})
const connectionErrors = ref<Record<string, string>>({})
const connectReady = ref<Record<string, boolean>>({})
const localPortInput = ref<string>('10000')
const showRestartDialog = ref(false)
const restartRobot = ref<Robot | null>(null)
const restarting = ref(false)
const countdown = ref(3)
let countdownTimer: any = null
const actionsRef = ref<HTMLElement | null>(null)
const actionsCompact = ref(false)
const actionsUltra = ref(false)
let actionsObserver: ResizeObserver | null = null
const error = ref('')
const loading = ref(false)

const formData = ref({
  name: '',
  robot_ip: '',
  local_ip: '',
  local_port: 10000,
  group_name: ''
})

const isValidIp = (ip: string) => {
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/
  return ipv4.test(ip)
}

const isValidPort = (portStr: string) => {
  if (!/^\d+$/.test(portStr)) return false
  const n = Number(portStr)
  return n >= 1 && n <= 65535
}

const isFormValid = computed(() => {
  return Boolean(
    formData.value.name &&
    (!formData.value.robot_ip || isValidIp(formData.value.robot_ip)) &&
    (!formData.value.local_ip || isValidIp(formData.value.local_ip)) &&
    (!localPortInput.value || isValidPort(localPortInput.value))
  )
})

function statusText(status: string): string {
  const map: Record<string, string> = {
    online: '在线',
    offline: '离线',
    connecting: '连接中',
    error: '异常'
  }
  return map[status] || status
}

function formatTime(val?: string | null) {
  if (!val) return '-'
  const d = new Date(val as any)
  const t = d.getTime()
  if (isNaN(t)) return typeof val === 'string' ? val : '-'
  return d.toLocaleString()
}

async function loadRobots() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/robots')
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
    robots.value = list.map((r) => ({
      uuid: r.uuid,
      name: r.name || '',
      model: r.model || '',
      status: r.status || 'offline',
      last_connected: r.last_connected || null,
      robot_ip: r.robot_ip || '',
      local_ip: r.local_ip || '',
      local_port: r.local_port || 10000,
      group_name: r.group_name || ''
    }))
  } catch (e: any) {
    error.value = e?.message || '加载失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

async function fetchLocalIp() {
  try {
    const res = await fetch('/api/network/local-ip')
    if (!res.ok) return
    let json: any
    try {
      json = await res.json()
    } catch {
      return
    }
    if (json.success && json.data?.ip) {
      unifiedLocalIp.value = json.data.ip
    }
  } catch {}
}

async function updateAllRobotsLocalIp() {
  if (!unifiedLocalIp.value) return
  if (!isValidIp(unifiedLocalIp.value)) {
    ElMessage.warning('请输入有效的本机IP')
    return
  }
}

async function overwriteAllRobotsLocalIp() {
  if (!unifiedLocalIp.value) {
    ElMessage.warning('请先获取或输入本机IP')
    return
  }
  if (!isValidIp(unifiedLocalIp.value)) {
    ElMessage.error('本机IP格式不正确')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要将所有机器人的本地IP更新为 ${unifiedLocalIp.value} 吗？`,
      '提示',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    robots.value = robots.value.map((r) => ({ ...r, local_ip: unifiedLocalIp.value }))
    ElMessage.success('已更新本地IP（本地状态）')
  } catch {}
}

function getNextAvailablePort() {
  const ports = robots.value.map((r) => r.local_port || 10000).sort((a, b) => a - b)
  return (ports[ports.length - 1] || 10000) + 1
}

async function testConnection(robot: Robot) {
  testing.value[robot.uuid] = true
  connectionErrors.value[robot.uuid] = ''
  try {
    await new Promise((r) => setTimeout(r, 600))
    if (robot.status !== 'online') {
      robot.status = 'online'
      connectReady.value[robot.uuid] = true
      ElMessage.success('测试通过（示例）')
    } else {
      ElMessage.success('已在线')
    }
  } catch (e: any) {
    robot.status = 'offline'
    connectionErrors.value[robot.uuid] = e?.message || '测试失败'
    ElMessage.error(connectionErrors.value[robot.uuid])
  } finally {
    testing.value[robot.uuid] = false
  }
}

async function connectNow(robot: Robot) {
  if (connectReady.value[robot.uuid] === false) return
  restartRobot.value = robot
  countdown.value = 3
  showRestartDialog.value = true
}

function editRobot(robot: Robot) {
  editingRobot.value = robot
  formData.value = {
    name: robot.name || '',
    robot_ip: robot.robot_ip || '',
    local_ip: robot.local_ip || '',
    local_port: robot.local_port || 10000,
    group_name: robot.group_name || ''
  }
  localPortInput.value = String(formData.value.local_port)
}

function notifyRobotsUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('robots_updated'))
  } catch {}
}

async function saveRobot() {
  const payload = {
    name: formData.value.name,
    robot_ip: formData.value.robot_ip,
    local_ip: formData.value.local_ip,
    local_port: Number(localPortInput.value || formData.value.local_port),
    group_name: formData.value.group_name || ''
  }
  try {
    let saved: any = null
    if (editingRobot.value) {
      const res = await fetch(`/api/robots/${editingRobot.value.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      saved = json.data
      Object.assign(editingRobot.value, saved)
    } else {
      const res = await fetch('/api/robots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      saved = json.data
      robots.value.push({
        uuid: saved.uuid,
        name: saved.name || '',
        model: saved.model || '',
        status: saved.status || 'offline',
        last_connected: saved.last_connected || null,
        robot_ip: saved.robot_ip || '',
        local_ip: saved.local_ip || '',
        local_port: saved.local_port || 10000,
        group_name: saved.group_name || ''
      })
    }
    notifyRobotsUpdated()
    closeDialog()
    ElMessage.success(editingRobot.value ? '保存成功' : '添加成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function deleteRobotConfirm(robot: Robot) {
  try {
    await ElMessageBox.confirm(
      `确定要删除机器人“${robot.name || robot.uuid}”吗？`,
      '提示',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    const res = await fetch(`/api/robots/${robot.uuid}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
    robots.value = robots.value.filter((r) => r.uuid !== robot.uuid)
    notifyRobotsUpdated()
    ElMessage.success('已删除')
  } catch {}
}

function closeDialog() {
  showAddDialog.value = false
  editingRobot.value = null
  formData.value = {
    name: '',
    robot_ip: '',
    local_ip: '',
    local_port: 10000,
    group_name: ''
  }
  localPortInput.value = '10000'
}

const openAddDialog = () => {
  showAddDialog.value = true
  formData.value = {
    name: '',
    robot_ip: '',
    local_ip: unifiedLocalIp.value || '',
    local_port: getNextAvailablePort(),
    group_name: ''
  }
  localPortInput.value = String(formData.value.local_port)
}

function dismissError(uuid: string) {
  if (connectionErrors.value[uuid]) {
    delete connectionErrors.value[uuid]
  }
}

onMounted(() => {
  loadRobots()
  fetchLocalIp()
  if (actionsRef.value) {
    actionsObserver = new ResizeObserver(() => {
      updateActionsMode()
    })
    actionsObserver.observe(actionsRef.value)
  }
  updateActionsMode()
  window.addEventListener('resize', checkActionsWidth)
})

onUnmounted(() => {
  if (actionsObserver && actionsRef.value) {
    actionsObserver.unobserve(actionsRef.value)
  }
  actionsObserver = null
  window.removeEventListener('resize', checkActionsWidth)
})

function checkActionsWidth() {
  updateActionsMode()
}

function updateActionsMode() {
  const el = actionsRef.value
  if (!el) return
  actionsCompact.value = false
  actionsUltra.value = false
  requestAnimationFrame(() => {
    const overflow1 = el.scrollWidth > el.clientWidth
    if (overflow1) {
      actionsCompact.value = true
      actionsUltra.value = false
      requestAnimationFrame(() => {
        const overflow2 = el.scrollWidth > el.clientWidth
        actionsUltra.value = overflow2
      })
    }
  })
}

function closeRestartDialog() {
  showRestartDialog.value = false
  restartRobot.value = null
  restarting.value = false
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 3
}

async function confirmRestart() {
  if (!restartRobot.value || restarting.value) return
  restarting.value = true
  countdown.value = 3
  countdownTimer = setInterval(async () => {
    countdown.value -= 1
    if (countdown.value <= 0 && restartRobot.value) {
      clearInterval(countdownTimer)
      countdownTimer = null
      ElMessage.success('已发送重启指令（示例）')
      closeRestartDialog()
    }
  }, 1000)
}
</script>

<style scoped>
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}
.local-ip-config {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--el-bg-color);
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
}
.local-ip-config label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}
.ip-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ip-input-group input {
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-primary);
  padding: 4px 8px;
  border-radius: 4px;
  width: 140px;
  text-align: center;
}
.ip-input-group input:focus {
  outline: none;
  border-color: var(--el-color-primary);
}
.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-primary);
}
.btn-icon:hover {
  background: var(--el-fill-color-light);
}
.robot-manager {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header h2 {
  margin: 0;
  font-size: 24px;
  color: var(--el-text-color-primary);
}
.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.actions .el-radio-button__inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.actions.compact .view-label { display: none; }
.actions.compact .el-radio-button__inner { justify-content: center; }
.actions.ultra .btn-primary .btn-label { display: none; }
.btn-primary .el-icon { margin-right: 6px; }
.actions.ultra .btn-primary { justify-content: center; }
.actions.ultra .btn-primary .el-icon { margin-right: 0; }
@media (max-width: 1100px) { .actions .view-label { display: none; } }
@media (max-width: 1030px) { .actions .btn-primary .btn-label { display: none; } }
.input-error { margin-top: 6px; font-size: 12px; color: var(--el-color-danger); }
.btn-primary {
  display: inline-flex;
  align-items: center;
  height: 32px;
  line-height: 32px;
  padding: 0 16px;
  background: var(--el-color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: var(--el-color-primary); }
.btn-primary:disabled { background: var(--el-border-color); cursor: not-allowed; }
.robot-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.robot-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}
.robot-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  border-color: #409eff;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}
.card-header h3 { margin: 0; font-size: 18px; color: var(--el-text-color-primary); }
.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.status-badge.online { background: rgba(78, 201, 176, 0.2); color: #4ec9b0; }
.status-badge.offline { background: rgba(244, 135, 113, 0.2); color: #f48771; }
.status-badge.connecting { background: rgba(206, 145, 120, 0.2); color: #ce9178; }
.status-badge.error { background: rgba(244, 67, 54, 0.2); color: #f44336; }
@media (max-width: 640px) { .status-label { display: none; } }
.card-body { margin-bottom: 12px; flex: 1; }
.info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
.info-row .label { color: var(--el-text-color-secondary); }
.info-row .value { font-weight: 500; color: var(--el-text-color-primary); }
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.8rem;
  color: #9ecbff;
  word-break: break-all;
}
.error-message {
  margin-top: 12px;
  padding: 8px;
  background: rgba(206, 145, 120, 0.2);
  border: 1px solid #ce9178;
  border-radius: 4px;
  font-size: 13px;
  color: #ce9178;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.error-icon { font-size: 16px; }
.error-text { flex: 0 1 auto; }
.error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #ce9178;
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
.error-message:hover .error-close { opacity: 1; }
.card-footer { display: flex; gap: 8px; margin-top: auto; }
.btn-test, .btn-edit, .btn-delete {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.2s;
}
.btn-test:hover { background: var(--el-color-primary); border-color: var(--el-color-primary); color: white; }
.btn-edit:hover { background: var(--el-fill-color-light); }
.btn-delete { color: #f48771; }
.btn-delete:hover { background: rgba(244, 135, 113, 0.2); border-color: #f48771; }
.btn-test:disabled { opacity: 0.6; cursor: not-allowed; }
.robot-list {
  background: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--el-border-color);
}
.table-wrapper { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; min-width: 800px; }
thead { background: var(--el-fill-color); }
th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: var(--el-text-color-primary);
  border-bottom: 2px solid var(--el-border-color);
}
td {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.actions-cell { display: flex; gap: 8px; align-items: center; position: relative; }
.btn-small {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}
.btn-small:hover { background: var(--el-fill-color-light); }
.btn-small.btn-danger { color: #f48771; }
.btn-small.btn-danger:hover { background: rgba(244, 135, 113, 0.2); border-color: #f48771; }
.btn-small:disabled { opacity: 0.6; cursor: not-allowed; }
.error-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #ce9178;
  line-height: 1;
  position: relative;
}
.error-indicator::after {
  content: attr(data-tip);
  display: none;
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  background: rgba(206, 145, 120, 0.2);
  border: 1px solid #ce9178;
  border-radius: 4px;
  font-size: 12px;
  color: #ce9178;
  white-space: nowrap;
  z-index: 10;
}
.error-indicator:hover::after { display: block; }
.empty-cell { text-align: center; color: var(--el-text-color-secondary); }
.empty-cell a { color: #4fc1ff; cursor: pointer; text-decoration: underline; }
.empty-state { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--el-text-color-secondary); }
.empty-state p { margin-bottom: 16px; font-size: 16px; }
.loading-hint { padding: 1rem; color: var(--el-text-color-secondary); }
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: var(--el-bg-color);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--el-border-color);
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color);
}
.dialog-header h3 { margin: 0; font-size: 18px; color: var(--el-text-color-primary); }
.close-btn {
  background: none; border: none; font-size: 24px; cursor: pointer; color: #858585; padding: 0;
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
}
.close-btn:hover { color: var(--el-text-color-primary); }
.dialog-body { padding: 20px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: var(--el-text-color-primary); }
.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  border-radius: 4px;
  font-size: 14px;
}
.form-group input:focus {
  outline: none;
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 0.2rem rgba(0, 122, 204, 0.25);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color);
}
.btn-cancel {
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}
.btn-cancel:hover { background: var(--el-fill-color-light); }
</style>
