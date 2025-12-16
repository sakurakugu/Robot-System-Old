<template>
  <div class="robot-manager">
    <div class="header">
      <h2>机器人管理</h2>
      <div class="actions">
        <button class="btn-view" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">
          卡片视图
        </button>
        <button class="btn-view" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
          列表视图
        </button>
        <button class="btn-primary" @click="showAddDialog = true">
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
            :disabled="testing[robot.uuid]"
          >
            {{ testing[robot.uuid] ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn-edit" @click="editRobot(robot)">编辑</button>
          <button class="btn-delete" @click="deleteRobotConfirm(robot)">删除</button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="robots.length === 0" class="empty-state">
        <p>暂无机器人</p>
        <button class="btn-primary" @click="showAddDialog = true">添加第一个机器人</button>
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
                :disabled="testing[robot.uuid]"
              >
                {{ testing[robot.uuid] ? '测试中' : '测试' }}
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
              暂无机器人，<a @click="showAddDialog = true">添加一个</a>
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
          </div>
          
          <div class="form-group">
            <label>本地IP *</label>
            <input v-model="formData.local_ip" type="text" placeholder="例如：192.168.1.105" />
          </div>
          
          <div class="form-group">
            <label>本地端口 *</label>
            <input v-model.number="formData.local_port" type="number" placeholder="例如：10131" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getRobots, addRobot, updateRobot, deleteRobot, testRobotConnection, type Robot, type RobotCreateData } from '../api/robot'
import { wsClient } from '../services/websocket'

const route = useRoute()
const projectUuid = computed(() => route.params.uuid as string)

const robots = ref<Robot[]>([])
const viewMode = ref<'card' | 'list'>('card')
const showAddDialog = ref(false)
const editingRobot = ref<Robot | null>(null)
const testing = ref<Record<string, boolean>>({})
const connectionErrors = ref<Record<string, string>>({})

const formData = ref<RobotCreateData>({
  name: '',
  robot_ip: '',
  local_ip: '',
  local_port: 10000,
  group_name: ''
})

const isFormValid = computed(() => {
  return formData.value.name && 
         formData.value.robot_ip && 
         formData.value.local_ip && 
         formData.value.local_port > 0
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

async function testConnection(robot: Robot) {
  testing.value[robot.uuid] = true
  connectionErrors.value[robot.uuid] = ''
  
  try {
    const result: any = await testRobotConnection(projectUuid.value, robot.uuid)
    if (result.success && result.connected) {
      robot.status = 'online'
      alert('连接成功！')
    } else {
      robot.status = 'offline'
      connectionErrors.value[robot.uuid] = result.error || '连接失败'
    }
  } catch (error: any) {
    robot.status = 'offline'
    connectionErrors.value[robot.uuid] = error.message || '连接测试失败'
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
}

async function saveRobot() {
  try {
    if (editingRobot.value) {
      const result: any = await updateRobot(projectUuid.value, editingRobot.value.uuid, formData.value)
      if (result.success) {
        await loadRobots()
        closeDialog()
      }
    } else {
      const result: any = await addRobot(projectUuid.value, formData.value)
      if (result.success) {
        await loadRobots()
        closeDialog()
      }
    }
  } catch (error) {
    console.error('保存机器人失败:', error)
    alert('保存失败，请检查输入')
  }
}

async function deleteRobotConfirm(robot: Robot) {
  if (!confirm(`确定要删除机器人"${robot.name}"吗？`)) {
    return
  }
  
  try {
    const result: any = await deleteRobot(projectUuid.value, robot.uuid)
    if (result.success) {
      await loadRobots()
    }
  } catch (error) {
    console.error('删除机器人失败:', error)
    alert('删除失败')
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
  wsClient.joinProject(projectUuid.value)
})
</script>

<style scoped>
.robot-manager {
  padding: 20px;
  height: 100%;
  overflow: auto;
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
}

.actions {
  display: flex;
  gap: 10px;
}

.btn-view {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-view.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 卡片视图 */
.robot-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.robot-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}

.robot-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.online {
  background: #d4edda;
  color: #155724;
}

.status-badge.offline {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.connecting {
  background: #fff3cd;
  color: #856404;
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
  color: #666;
}

.info-row .value {
  font-weight: 500;
}

.error-message {
  margin-top: 12px;
  padding: 8px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 13px;
  color: #856404;
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
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-test:hover {
  background: #e7f3ff;
  border-color: #007bff;
}

.btn-edit:hover {
  background: #f0f0f0;
}

.btn-delete {
  color: #dc3545;
}

.btn-delete:hover {
  background: #ffe6e6;
  border-color: #dc3545;
}

.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 列表视图 */
.robot-list {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
}

th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

td {
  padding: 12px;
  border-bottom: 1px solid #dee2e6;
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
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-small:hover {
  background: #f0f0f0;
}

.btn-small.btn-danger {
  color: #dc3545;
}

.btn-small.btn-danger:hover {
  background: #ffe6e6;
  border-color: #dc3545;
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
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 12px;
  color: #856404;
  white-space: nowrap;
  z-index: 10;
}

.empty-cell {
  text-align: center;
  color: #999;
}

.empty-cell a {
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #999;
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
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #dee2e6;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
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
  color: #495057;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,0.25);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #dee2e6;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-cancel:hover {
  background: #f0f0f0;
}
</style>
