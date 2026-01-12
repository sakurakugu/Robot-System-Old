<template>
  <div class="robot-manager">
    <div class="header">
      <h2>机器人管理</h2>
      <div class="header-center">
        <div class="local-ip-config">
          <label>本机IP:</label>
          <div class="ip-input-group">
            <input 
              v-model="unifiedLocalIp" 
              type="text" 
              placeholder="自动获取中..." 
              @change="updateAllRobotsLocalIp"
            />
            <button class="btn-icon" @click="fetchLocalIp" title="刷新本机IP">
              <el-icon><Refresh /></el-icon>
            </button>
            <button class="btn-icon" @click="overwriteAllRobotsLocalIp" title="一键覆盖所有机器人的本地IP">
              <el-icon><Download /></el-icon>
            </button>
          </div>
        </div>
      </div>
      <div class="actions">
        <el-radio-group v-model="viewMode" size="default">
          <el-radio-button value="card">
            <el-icon><Menu /></el-icon>
            卡片视图
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><List /></el-icon>
            列表视图
          </el-radio-button>
        </el-radio-group>
        <button class="btn-primary" @click="openAddDialog">
          + 添加机器人
        </button>
      </div>
    </div>

    <!-- 卡片视图 -->
    <div v-if="viewMode === 'card'" class="robot-cards">
      <div v-for="robot in robots" :key="robot.uuid" class="robot-card">
        <div class="card-header">
          <h3>{{ robot.name }}</h3>
          <span class="status-badge" :class="robot.status">
            {{ statusText(robot.status) }}
          </span>
        </div>
        
        <div class="card-body">
          <div class="info-row">
            <span class="label">机器人IP:</span>
            <span class="value">{{ robot.robot_ip }}</span>
          </div>
          <div class="info-row">
            <span class="label">本地IP:</span>
            <span class="value">{{ robot.local_ip }}</span>
          </div>
          <div class="info-row">
            <span class="label">本地端口:</span>
            <span class="value">{{ robot.local_port }}</span>
          </div>
          <div v-if="robot.group_name" class="info-row">
            <span class="label">分组:</span>
            <span class="value">{{ robot.group_name }}</span>
          </div>
          
          <!-- 连接错误信息 -->
          <div v-if="robot.status === 'offline' && connectionErrors[robot.uuid]" class="error-message">
            <span class="error-icon">⚠</span>
            <span>{{ connectionErrors[robot.uuid] }}</span>
          </div>
        </div>
        
        <div class="card-footer">
          <button 
            class="btn-test" 
            @click="testConnection(robot)" 
            :disabled="testing[robot.uuid] || (robot.status === 'online' && connectReady[robot.uuid] === false)"

            >
            {{ testing[robot.uuid] ? '测试中...' : (robot.status === 'online' ? '连接' : '测试连接') }}
          </button>
          <button class="btn-edit" @click="editRobot(robot)">编辑</button>
          <button class="btn-delete" @click="deleteRobotConfirm(robot)">删除</button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="robots.length === 0" class="empty-state">
        <p>暂无机器人</p>
        <button class="btn-primary" @click="openAddDialog">添加第一个机器人</button>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-else class="robot-list">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>状态</th>
            <th>机器人IP</th>
            <th>本地IP</th>
            <th>端口</th>
            <th>分组</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="robot in robots" :key="robot.uuid">
            <td>{{ robot.name }}</td>
            <td>
              <span class="status-badge" :class="robot.status">
                {{ statusText(robot.status) }}
              </span>
            </td>
            <td>{{ robot.robot_ip }}</td>
            <td>{{ robot.local_ip }}</td>
            <td>{{ robot.local_port }}</td>
            <td>{{ robot.group_name || '-' }}</td>
            <td class="actions-cell">
              <button 
                class="btn-small" 
                @click="testConnection(robot)"
                :disabled="testing[robot.uuid] || (robot.status === 'online' && connectReady[robot.uuid] === false)"
              >
                {{ testing[robot.uuid] ? '测试中' : (robot.status === 'online' ? '连接' : '测试') }}
              </button>
              <button class="btn-small" @click="editRobot(robot)">编辑</button>
              <button class="btn-small btn-danger" @click="deleteRobotConfirm(robot)">删除</button>
              
              <!-- 错误提示 -->
              <div v-if="robot.status === 'offline' && connectionErrors[robot.uuid]" class="error-tooltip">
                {{ connectionErrors[robot.uuid] }}
              </div>
            </td>
          </tr>
          <tr v-if="robots.length === 0">
            <td colspan="7" class="empty-cell">
              暂无机器人，<a @click="openAddDialog">添加一个</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- 添加/编辑对话框 -->
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
            <label>机器人IP *</label>
            <input v-model="formData.robot_ip" type="text" placeholder="例如：192.168.1.110" />
            <div v-if="formData.robot_ip && !isValidIp(formData.robot_ip)" class="input-error">IP格式不正确</div>
          </div>
          
          <div class="form-group">
            <label>本地IP *</label>
            <input v-model="formData.local_ip" type="text" placeholder="例如：192.168.1.105" />
            <div v-if="formData.local_ip && !isValidIp(formData.local_ip)" class="input-error">IP格式不正确</div>
          </div>
          
          <div class="form-group">
            <label>本地端口 *</label>
            <input 
              v-model="localPortInput" 
              type="text" 
              inputmode="numeric" 
              placeholder="例如：10131" 
            />
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
  
  <!-- 重启运控确认对话框 -->
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getRobots, addRobot, updateRobot, deleteRobot, testRobotConnection, connectRobot, restartMotion, type Robot, type RobotCreateData } from '../api/robot'
import api from '../api/index'
import { wsClient } from '../services/websocket'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const projectUuid = computed(() => route.params.uuid as string)

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

const formData = ref<RobotCreateData>({
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
    isValidIp(formData.value.robot_ip) &&
    isValidIp(formData.value.local_ip) &&
    isValidPort(localPortInput.value)
  )
})

function statusText(status: string): string {
  const map: Record<string, string> = {
    online: '在线',
    offline: '离线',
    connecting: '连接中'
  }
  return map[status] || status
}

async function loadRobots() {
  try {
    const result: any = await getRobots(projectUuid.value)
    if (result.success) {
      robots.value = result.data
    }
  } catch (error) {
    console.error('加载机器人列表失败:', error)
  }
}

async function fetchLocalIp() {
  try {
    const result: any = await api.get('/network/local-ip')
    if (result.success && result.data.ip) {
      unifiedLocalIp.value = result.data.ip
    }
  } catch (error) {
    console.error('获取本机IP失败:', error)
  }
}

async function updateAllRobotsLocalIp() {
  if (!unifiedLocalIp.value) return
  if (!isValidIp(unifiedLocalIp.value)) {
    ElMessage.warning('请输入有效的本机IP')
    return
  }
  
  // 批量更新所有机器人的本地IP（这里只是前端更新，如果需要保存到后端需要循环调用API）
  // 暂时只在添加新机器人时使用该IP作为默认值
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
  } catch {
    return
  }

  try {
    const updatePromises = robots.value.map(robot => {
      robot.status = 'offline'
      const updatedData = {
        name: robot.name,
        robot_ip: robot.robot_ip,
        local_ip: unifiedLocalIp.value,
        local_port: robot.local_port,
        group_name: robot.group_name,
        status: 'offline'
      }
      return updateRobot(projectUuid.value, robot.uuid, updatedData)
    })

    await Promise.all(updatePromises)
    await loadRobots()
    ElMessage.success('更新成功')
  } catch (error) {
    console.error('批量更新IP失败:', error)
    ElMessage.error('批量更新失败，请重试')
  }
}

// 自动分配端口
function getNextAvailablePort() {
  if (robots.value.length === 0) return 10000
  
  const ports = robots.value.map(r => r.local_port).sort((a, b) => a - b)
  return ports[ports.length - 1] + 1
}

async function testConnection(robot: Robot) {
  if (robot.status === 'online') {
    return connectNow(robot)
  }
  testing.value[robot.uuid] = true
  connectionErrors.value[robot.uuid] = ''
  try {
    const result: any = await testRobotConnection(projectUuid.value, robot.uuid)
    if (result.success && result.connected) {
      robot.status = 'online'
      connectReady.value[robot.uuid] = false
      setTimeout(() => {
        connectReady.value[robot.uuid] = true
      }, 1000)
      ElMessage.success(result.message || '测试通过，请点击连接')
    } else {
      robot.status = 'offline'
      const errMsg = result?.message || result?.error || '测试失败'
      connectionErrors.value[robot.uuid] = errMsg
      ElMessage.error(errMsg)
    }
  } catch (error: any) {
    robot.status = 'offline'
    const axiosMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      '连接测试失败'
    connectionErrors.value[robot.uuid] = axiosMsg
    ElMessage.error(axiosMsg)
  } finally {
    testing.value[robot.uuid] = false
  }
}

async function connectNow(robot: Robot) {
  if (connectReady.value[robot.uuid] === false) {
    return
  }
  testing.value[robot.uuid] = true
  connectionErrors.value[robot.uuid] = ''
  try {
    const result: any = await connectRobot(projectUuid.value, robot.uuid)
    if (result.success && result.connected) {
      ElMessage.success(result.message || '连接成功')
      restartRobot.value = robot
      countdown.value = 3
      showRestartDialog.value = true
    } else {
      robot.status = 'offline'
      const errMsg = result?.message || result?.error || '连接失败'
      connectionErrors.value[robot.uuid] = errMsg
      ElMessage.error(errMsg)
    }
  } catch (error: any) {
    robot.status = 'offline'
    const axiosMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      '连接失败'
    connectionErrors.value[robot.uuid] = axiosMsg
    ElMessage.error(axiosMsg)
  } finally {
    testing.value[robot.uuid] = false
  }
}

function editRobot(robot: Robot) {
  editingRobot.value = robot
  formData.value = {
    name: robot.name,
    robot_ip: robot.robot_ip,
    local_ip: robot.local_ip,
    local_port: robot.local_port,
    group_name: robot.group_name || ''
  }
  localPortInput.value = String(robot.local_port)
}

async function saveRobot() {
  try {
    const payload: RobotCreateData = {
      name: formData.value.name,
      robot_ip: formData.value.robot_ip,
      local_ip: formData.value.local_ip,
      local_port: Number(localPortInput.value),
      group_name: formData.value.group_name || ''
    }

    if (editingRobot.value) {
      const payloadUpdate = { ...payload, status: 'offline' }
      const result: any = await updateRobot(projectUuid.value, editingRobot.value.uuid, payloadUpdate)
      if (result.success) {
        editingRobot.value.status = 'offline'
        await loadRobots()
        closeDialog()
      }
    } else {
      const result: any = await addRobot(projectUuid.value, payload)
      if (result.success) {
        await loadRobots()
        closeDialog()
      }
    }
  } catch (error) {
    console.error('保存机器人失败:', error)
    ElMessage.error('保存失败，请检查输入')
  }
}

async function deleteRobotConfirm(robot: Robot) {
  try {
    await ElMessageBox.confirm(
      `确定要删除机器人“${robot.name}”吗？`,
      '提示',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  
  try {
    const result: any = await deleteRobot(projectUuid.value, robot.uuid)
    if (result.success) {
      await loadRobots()
    }
  } catch (error) {
    console.error('删除机器人失败:', error)
    ElMessage.error('删除失败')
  }
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

// 监听添加对话框打开
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

// WebSocket事件监听
wsClient.on('robot_status_update', (data: any) => {
  const robot = robots.value.find(r => r.uuid === data.robotUuid)
  if (robot) {
    robot.status = data.status
  }
})

onMounted(() => {
    loadRobots()
    fetchLocalIp()
  wsClient.joinProject(projectUuid.value)
  })

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
      try {
        const res: any = await restartMotion(projectUuid.value, restartRobot.value.uuid)
        if (res.success) {
          ElMessage.success('运控已重启')
        } else {
          ElMessage.error(res.message || '重启失败')
        }
      } catch (e: any) {
        ElMessage.error(e?.message || '重启失败')
      } finally {
        closeRestartDialog()
      }
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

.input-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.btn-view {
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-view.active {
  background: var(--el-color-primary);
  color: white;
  border-color: var(--el-color-primary);
}

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

.btn-primary:hover {
  background: var(--el-color-primary);
}

.btn-primary:disabled {
  background: var(--el-border-color);
  cursor: not-allowed;
}

/* 卡片视图 */
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  transition: box-shadow 0.2s;
}

.robot-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.5);
  border-color: #007acc;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.online {
  background: rgba(78, 201, 176, 0.2);
  color: #4ec9b0;
}

.status-badge.offline {
  background: rgba(244, 135, 113, 0.2);
  color: #f48771;
}

.status-badge.connecting {
  background: rgba(206, 145, 120, 0.2);
  color: #ce9178;
}

.card-body {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-row .label {
  color: var(--el-text-color-secondary);
}

.info-row .value {
  font-weight: 500;
  color: var(--el-text-color-primary);
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
}

.error-icon {
  font-size: 16px;
}

.card-footer {
  display: flex;
  gap: 8px;
}

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

.btn-test:hover {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.btn-edit:hover {
  background: var(--el-fill-color-light);
}

.btn-delete {
  color: #f48771;
}

.btn-delete:hover {
  background: rgba(244, 135, 113, 0.2);
  border-color: #f48771;
}

.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 列表视图 */
.robot-list {
  background: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  border: 1px solid var(--el-border-color);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--el-fill-color);
}

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
}

.actions-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  position: relative;
}

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

.btn-small:hover {
  background: var(--el-fill-color-light);
}

.btn-small.btn-danger {
  color: #f48771;
}

.btn-small.btn-danger:hover {
  background: rgba(244, 135, 113, 0.2);
  border-color: #f48771;
}

.btn-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  padding: 6px 10px;
  background: rgba(206, 145, 120, 0.2);
  border: 1px solid #ce9178;
  border-radius: 4px;
  font-size: 12px;
  color: #ce9178;
  white-space: nowrap;
  z-index: 10;
}

.empty-cell {
  text-align: center;
  color: var(--el-text-color-secondary);
}

.empty-cell a {
  color: #4fc1ff;
  cursor: pointer;
  text-decoration: underline;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.empty-state p {
  margin-bottom: 16px;
  font-size: 16px;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
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
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  border: 1px solid var(--el-border-color);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #858585;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--el-text-color-primary);
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

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
  box-shadow: 0 0 0 0.2rem rgba(0,122,204,0.25);
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

.btn-cancel:hover {
  background: var(--el-fill-color-light);
}
</style>
