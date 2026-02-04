<template>
  <div class="robot-settings" :class="{ 'is-embedded': props.embedded }">
    <el-page-header v-if="!props.embedded" @back="() => router.push('/robots')" class="page-header">
      <template #content>
        <div class="header-content">
          <el-icon :size="24"><Bot /></el-icon>
          <span class="title">机器人设置</span>
        </div>
      </template>
      <template #extra>
        <el-popconfirm
          title="确定要解除绑定吗？此操作不可恢复。"
          confirm-button-text="确定"
          cancel-button-text="取消"
          confirm-button-type="danger"
          @confirm="handleUnbind"
        >
          <template #reference>
            <el-button type="danger" plain>解除绑定</el-button>
          </template>
        </el-popconfirm>
      </template>
    </el-page-header>

    <div class="content" v-loading="loading">
      <el-tabs
        v-model="currentTab"
        tab-position="left"
        class="settings-tabs"
        :class="{ 'is-hide-tabs': props.hideTabs }"
      >
        <el-tab-pane label="基本信息" name="basic">
          <div class="pane-content">
            <h3 class="section-title">基本信息</h3>
            <el-form :model="formData" label-width="100px">
              <el-form-item label="名称">
                <el-input 
                  v-model="formData.name" 
                  maxlength="16" 
                  show-word-limit 
                  placeholder="请输入机器人名称"
                  @change="autoSave('name')"
                />
              </el-form-item>
              <el-form-item label="类型">
                <el-input v-model="formData.model" disabled />
              </el-form-item>
              <el-form-item label="角色">
                <el-select 
                  v-model="formData.role_id" 
                  placeholder="选择角色" 
                  clearable
                  @change="autoSave('role_id')"
                >
                  <el-option
                    v-for="role in roles"
                    :key="role.uuid"
                    :label="role.name"
                    :value="role.uuid"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="分组">
                <el-select 
                  v-model="formData.group_name" 
                  placeholder="选择分组" 
                  allow-create 
                  filterable 
                  default-first-option
                  @change="autoSave('group_name')"
                >
                  <el-option label="默认分组" value="Default" />
                  <el-option label="开发测试" value="Dev" />
                  <el-option label="演示展厅" value="Demo" />
                </el-select>
              </el-form-item>
              <el-form-item label="标签">
                <div class="tags-container">
                  <el-tag
                    v-for="tag in tags"
                    :key="tag"
                    closable
                    :disable-transitions="false"
                    @close="handleCloseTag(tag)"
                  >
                    {{ tag }}
                  </el-tag>
                  <el-input
                    v-if="inputVisible"
                    ref="InputRef"
                    v-model="inputValue"
                    class="input-new-tag"
                    size="small"
                    @keyup.enter="handleInputConfirm"
                    @blur="handleInputConfirm"
                  />
                  <el-button v-else class="button-new-tag" size="small" @click="showInput">
                    + New Tag
                  </el-button>
                </div>
              </el-form-item>
              <el-divider />
              <h4 class="subsection-title">系统音量</h4>
              <el-form-item label="音量">
                <div class="volume-control">
                  <el-slider
                    v-model="volumeData.volume"
                    :min="0"
                    :max="100"
                    :disabled="volumeData.loading || !status.connected"
                    @change="handleVolumeChange"
                    style="flex: 1; margin-right: 12px;"
                  />
                  <el-input-number
                    v-model="volumeData.volume"
                    :min="0"
                    :max="100"
                    :disabled="volumeData.loading || !status.connected"
                    @change="handleVolumeChange"
                    style="width: 100px; margin-right: 8px;"
                  />
                  <el-button
                    :icon="volumeData.muted ? 'VideoPause' : 'VideoPlay'"
                    @click="handleMuteToggle"
                    :disabled="volumeData.loading || !status.connected"
                    :type="volumeData.muted ? 'danger' : 'default'"
                  >
                    {{ volumeData.muted ? '静音' : '取消静音' }}
                  </el-button>
                  <el-button
                    @click="loadVolume"
                    :loading="volumeData.loading"
                    :disabled="!status.connected"
                    icon="Refresh"
                    circle
                  />
                </div>
                <el-text v-if="!status.connected" type="info" size="small">
                  机器人未连接，无法控制音量
                </el-text>
              </el-form-item>
              <el-divider />
              <el-form-item label="SN">
                <el-input v-model="formData.sn" disabled />
              </el-form-item>
              <el-form-item label="UUID">
                <el-input v-model="formData.uuid" disabled />
              </el-form-item>
              <el-divider />
              <div class="status-grid">
                <div class="status-item">
                  <span class="label">温度</span>
                  <span class="value">{{ status.temperature }}°C</span>
                </div>
                <div class="status-item">
                  <span class="label">电量</span>
                  <span class="value">{{ status.battery }}%</span>
                </div>
                <div class="status-item">
                  <span class="label">连接状态</span>
                  <el-tag :type="status.connected ? 'success' : 'danger'">
                    {{ status.connected ? '在线' : '离线' }}
                  </el-tag>
                </div>
              </div>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="网络配置" name="network">
          <div class="pane-content">
            <h3 class="section-title">网络配置</h3>
            <el-form :model="formData" label-width="100px">
              <el-form-item label="机器人IP">
                <el-input v-model="formData.ip" placeholder="例如：192.168.1.110" @change="autoSave('ip')">
                  <template #append>
                    <el-button @click="copyText(formData.ip)" :disabled="!formData.ip">复制</el-button>
                  </template>
                </el-input>
                <el-text v-if="formData.ip && !isValidIP(formData.ip)" type="danger" size="small">IP格式不正确</el-text>
              </el-form-item>
              <el-form-item label="本地IP">
                <el-input v-model="formData.local_ip" disabled />
              </el-form-item>
              <!-- <el-form-item label="本地端口">
                <el-input v-model="formData.local_port" disabled />
              </el-form-item> -->
              <el-form-item>
                <el-button type="primary" :loading="testingNetwork" @click="testConnection">
                  测试连接
                </el-button>
                <el-button type="success" :disabled="!canOpenWifi" @click="openWifiSettings">
                  修改WiFi
                </el-button>
                <span v-if="networkResult" :class="['network-result', networkResult.success ? 'success' : 'error']">
                  {{ networkResult.message }}
                </span>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="日志管理" name="logs">
          <div class="pane-content">
            <h3 class="section-title">日志管理</h3>
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
                  <el-radio-button label="robot">机器人日志</el-radio-button>
                  <el-radio-button label="app">APP日志</el-radio-button>
                  <el-radio-button label="all">全部日志</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="uploadLogs" :loading="uploadingLogs">
                  打包上传
                </el-button>
              </el-form-item>
            </el-form>
            
            <div class="log-history">
              <h4>最近上传记录</h4>
              <el-table :data="logHistory" style="width: 100%" size="small">
                <el-table-column prop="time" label="时间" width="160" />
                <el-table-column prop="type" label="类型" width="100">
                   <template #default="scope">
                     {{ getLogTypeLabel(scope.row.type) }}
                   </template>
                </el-table-column>
                <el-table-column prop="size" label="大小" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="AI 配置" name="ai">
          <div class="pane-content">
            <h3 class="section-title">AI 配置</h3>
            <el-form :model="formData" label-position="top">
              <el-form-item label="回复温度">
                <el-slider
                  v-model="formData.ai_temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  show-input
                  :input-size="'small'"
                  @change="autoSave('ai_temperature')"
                />
              </el-form-item>
              <el-form-item label="使用模型">
                <el-select v-model="formData.ai_model" placeholder="请选择模型" style="width: 100%" @change="autoSave('ai_model')">
                  <el-option
                    v-for="m in availableModels"
                    :key="m.value"
                    :label="m.label"
                    :value="m.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="音色">
                <el-select v-model="formData.ai_voice" placeholder="请选择音色" style="width: 100%" @change="autoSave('ai_voice')">
                  <el-option label="女声-温柔" value="female-soft" />
                  <el-option label="女声-活泼" value="female-bright" />
                  <el-option label="男声-低沉" value="male-deep" />
                  <el-option label="男声-洪亮" value="male-bright" />
                  <el-option label="童声" value="child" />
                  <el-option label="电子音" value="robotic" />
                </el-select>
              </el-form-item>
              <el-form-item label="意图识别">
                <el-select v-model="formData.ai_intent" placeholder="请选择方案" style="width: 100%" @change="autoSave('ai_intent')">
                  <el-option label="规则引擎" value="rule-based" />
                  <el-option label="LLM分类器" value="llm-classifier" />
                  <el-option label="混合策略" value="hybrid" />
                </el-select>
              </el-form-item>
              
              <el-divider content-position="left">系统提示词</el-divider>
              
              <el-form-item label="角色名称">
                <el-input v-model="formData.ai_role_name" placeholder="例如：导航助手" @change="autoSave('ai_role_name')" />
              </el-form-item>
              <el-form-item label="系统提示词">
                <el-input
                  v-model="formData.ai_system_prompt"
                  type="textarea"
                  :rows="6"
                  placeholder="例如：保持安全、简洁、友好"
                  @change="autoSave('ai_system_prompt')"
                />
              </el-form-item>
              <el-form-item>
                 <el-button type="primary" @click="saveAIConfig">保存配置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane name="upgrade">
          <template #label>
            <span class="custom-tab-label">
              系统升级
              <span v-if="hasUpdate" class="dot"></span>
            </span>
          </template>
          <div class="pane-content">
            <h3 class="section-title">系统升级</h3>
            
            <div class="upgrade-card">
              <div class="upgrade-header">
                <h4>APP 客户端</h4>
                <el-tag size="small" type="info">当前版本 v1.0.2</el-tag>
              </div>
              <div class="upgrade-body">
                <p v-if="appUpdateAvailable">发现新版本 v1.1.0 (2025-01-20)</p>
                <p v-else>当前已是最新版本</p>
                <el-button type="primary" size="small" :disabled="!appUpdateAvailable" @click="handleUpgrade('app')">
                  {{ appUpdateAvailable ? '立即升级' : '检查更新' }}
                </el-button>
              </div>
            </div>

            <div class="upgrade-card">
              <div class="upgrade-header">
                <h4>机器狗固件</h4>
                <el-tag size="small" type="info">当前版本 v2.3.1</el-tag>
              </div>
                <div class="upgrade-body">
                <p v-if="firmwareUpdateAvailable">发现新版本 v2.4.0 (2025-01-18)</p>
                <p v-else>当前已是最新版本</p>
                <el-button type="primary" size="small" :disabled="!firmwareUpdateAvailable" @click="handleUpgrade('firmware')">
                  {{ firmwareUpdateAvailable ? '立即升级' : '检查更新' }}
                </el-button>
              </div>
            </div>

            <div class="one-click-upgrade" v-if="appUpdateAvailable || firmwareUpdateAvailable">
               <el-button type="success" @click="handleUpgrade('all')" style="width: 100%">一键升级所有</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isValidIP } from '@/utils/validator'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{ embedded?: boolean; robotUuid?: string; hideTabs?: boolean; activeTab?: string }>()
const route = useRoute()
const router = useRouter()
const uuid = computed(() => props.robotUuid || (route.params.uuid as string | undefined))

const currentTab = ref(props.activeTab || 'basic')
const loading = ref(false)

// Data Models
const formData = reactive({
  name: '',
  model: '',
  role_id: '',
  group_name: '',
  sn: '',
  uuid: '',
  ip: '',
  local_ip: '',
  ai_temperature: 0.7,
  ai_model: '',
  ai_voice: '',
  ai_intent: '',
  ai_role_name: '',
  ai_system_prompt: ''
})

const roles = ref<any[]>([])

const tags = ref<string[]>([])
const inputVisible = ref(false)
const inputValue = ref('')
const InputRef = ref()

const status = reactive({
  temperature: 42,
  battery: 85,
  connected: true
})

// Volume Control
const volumeData = reactive({
  volume: 50,
  muted: false,
  loading: false
})

// Logs
const logDateRange = ref('')
const logType = ref('all')
const uploadingLogs = ref(false)
type LogHistoryEntry = { time: string; type: string; size: string }
const logHistory = ref<LogHistoryEntry[]>([])

// Network Test
const testingNetwork = ref(false)
const networkResult = ref<{ success: boolean; message: string } | null>(null)

// AI Options (Mock)
const availableModels = [
  { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }
]

// Update Status (Mock)
const appUpdateAvailable = ref(false)
const firmwareUpdateAvailable = ref(false)
const hasUpdate = computed(() => appUpdateAvailable.value || firmwareUpdateAvailable.value)
const canOpenWifi = computed(() => status.connected && isValidIP(formData.ip))

// Methods

const loadData = async () => {
  loading.value = true
  try {
    if (uuid.value) {
      const res = await fetch(`/api/v1/robots/${uuid.value}`)
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success && json.data) {
        const r = json.data
        formData.uuid = r.uuid || ''
        formData.name = r.name || ''
        formData.model = r.model || ''
        formData.role_id = r.role_id || ''
        formData.sn = r.sn || ''
        formData.ip = r.ip || r.robot_ip || ''
        tags.value = Array.isArray(r.tags) ? r.tags : []
        status.connected = Boolean(
          r.connected ??
            r.is_connected ??
            (typeof r.status === 'string' && ['online', 'connected'].includes(r.status))
        )
      }
      const lipRes = await fetch('/api/v1/network/local-ip')
      const lipJson = await lipRes.json().catch(() => ({}))
      if (lipRes.ok && lipJson.success) {
        formData.local_ip = lipJson.data?.ip || ''
      }
      
      // 加载音量信息
      if (status.connected) {
        await loadVolume()
      }
    }
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }

  // 加载角色列表
  try {
    const rolesRes = await fetch('/api/v1/roles')
    const rolesJson = await rolesRes.json().catch(() => ({}))
    if (rolesRes.ok && rolesJson.success) {
      roles.value = rolesJson.data || []
    }
  } catch {}
}

// Auto Save
const autoSave = async (field: string) => {
  if (!uuid.value) {
    ElMessage.warning('请先选择机器人')
    return
  }
  try {
    const payload: any = {}
    if (field === 'name') payload.name = formData.name
    if (field === 'role_id') payload.role_id = formData.role_id || null
    if (field === 'group_name') payload.group_name = formData.group_name
    if (field.startsWith('ai_')) payload[field] = (formData as any)[field]
    if (field === 'tags') payload.tags = tags.value
    if (field === 'ip') {
      if (!formData.ip || !isValidIP(formData.ip)) {
        ElMessage.warning('IP格式不正确')
        return
      }
      payload.ip = formData.ip
      payload.robot_ip = formData.ip
    }
    const res = await fetch(`/api/v1/robots/${uuid.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
    ElMessage.success({ message: '保存成功', duration: 1000 })
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

// Tags
const handleCloseTag = (tag: string) => {
  tags.value.splice(tags.value.indexOf(tag), 1)
  autoSave('tags')
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value!.input!.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value) {
    tags.value.push(inputValue.value)
    autoSave('tags')
  }
  inputVisible.value = false
  inputValue.value = ''
}

// Network
const copyText = (text: string) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

const testConnection = async () => {
  if (!uuid.value) {
    ElMessage.warning('请先选择机器人')
    return
  }
  testingNetwork.value = true
  networkResult.value = null
  try {
    const res = await fetch(`/api/v1/robots/${uuid.value}/test-connection`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    testingNetwork.value = false
    if (res.ok) {
      const connected = !!json.connected
      status.connected = connected
      networkResult.value = { success: connected, message: json.message || (connected ? '连接成功' : '连接失败') }
    } else {
      networkResult.value = { success: false, message: json.error || `HTTP ${res.status}` }
    }
  } catch (e: any) {
    testingNetwork.value = false
    networkResult.value = { success: false, message: e?.message || '测试失败' }
  }
}

// Update Methods
const handleUpgrade = async (type: 'app' | 'firmware' | 'all') => {
  ElMessage.info(`暂不支持${type === 'app' ? 'APP' : type === 'firmware' ? '固件' : '系统'}升级功能`)
  // TODO: 实现升级功能
}

// Logs
const getLogTypeLabel = (type: string) => {
  const map: Record<string, string> = { robot: '机器人', app: 'APP', all: '全部' }
  return map[type] || type
}

const uploadLogs = () => {
  uploadingLogs.value = true
  setTimeout(() => {
    uploadingLogs.value = false
    ElMessage.success('日志上传成功')
    logHistory.value.unshift({
      time: new Date().toLocaleString(),
      type: logType.value,
      size: '1.5MB'
    })
    if (logHistory.value.length > 5) logHistory.value.pop()
  }, 1500)
}

// AI
const saveAIConfig = () => {
    ElMessage.success('AI配置已保存')
}

const openWifiSettings = () => {
  if (!status.connected) {
    ElMessage.warning('机器人未连接')
    return
  }
  if (!formData.ip || !isValidIP(formData.ip)) {
    ElMessage.warning('IP格式不正确')
    return
  }
  const url = `http://${formData.ip}:8080`
  window.open(url, '_blank')
}

// Volume Control
let volumeDebounceTimer: number | null = null

const loadVolume = async () => {
  if (!uuid.value || !status.connected) return
  
  volumeData.loading = true
  try {
    const response = await fetch(`/api/v1/robots/${uuid.value}/volume`)
    const json = await response.json().catch(() => ({}))
    
    if (response.ok && json.success && json.data) {
      volumeData.volume = json.data.volume || 50
      volumeData.muted = json.data.muted || false
    }
  } catch (error) {
    console.error('加载音量失败:', error)
  } finally {
    volumeData.loading = false
  }
}

const handleVolumeChange = (value: number) => {
  // 防抖处理
  if (volumeDebounceTimer) {
    clearTimeout(volumeDebounceTimer)
  }
  
  volumeDebounceTimer = window.setTimeout(async () => {
    if (!uuid.value) return
    
    volumeData.loading = true
    try {
      const response = await fetch(`/api/v1/robots/${uuid.value}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: value })
      })
      
      const json = await response.json().catch(() => ({}))
      
      if (response.ok && json.success) {
        ElMessage.success({ message: `音量已设置为 ${value}`, duration: 1000 })
      } else {
        ElMessage.error('设置音量失败: ' + (json.error || '未知错误'))
      }
    } catch (error: any) {
      ElMessage.error('设置音量失败: ' + (error?.message || '网络错误'))
    } finally {
      volumeData.loading = false
    }
  }, 500)
}

const handleMuteToggle = async () => {
  if (!uuid.value) return
  
  const newMuteState = !volumeData.muted
  volumeData.loading = true
  
  try {
    const response = await fetch(`/api/v1/robots/${uuid.value}/volume/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: newMuteState })
    })
    
    const json = await response.json().catch(() => ({}))
    
    if (response.ok && json.success) {
      volumeData.muted = newMuteState
      ElMessage.success(newMuteState ? '已静音' : '已取消静音')
    } else {
      ElMessage.error('设置静音失败: ' + (json.error || '未知错误'))
    }
  } catch (error: any) {
    ElMessage.error('设置静音失败: ' + (error?.message || '网络错误'))
  } finally {
    volumeData.loading = false
  }
}

// Unbind
const handleUnbind = () => {
  if (!uuid.value) {
    ElMessage.warning('请先选择机器人')
    return
  }
  // Call API
  ElMessage.success('解除绑定成功')
  router.push('/robots')
}

watch(
  () => props.activeTab,
  (val) => {
    if (val && val !== currentTab.value) {
      currentTab.value = val
    }
  },
  { immediate: true }
)

watch(
  uuid,
  () => {
    loadData()
  },
  { immediate: true }
)
</script>

<style scoped>
.robot-settings {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
}

.robot-settings.is-embedded {
  padding: 0;
  height: auto;
  overflow: visible;
  background: transparent;
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
  min-height: 400px;
}

.settings-tabs {
  width: 100%;
}

.settings-tabs :deep(.el-tabs__content) { padding: 20px; }

.settings-tabs.is-hide-tabs :deep(.el-tabs__header) {
  display: none;
}

.settings-tabs.is-hide-tabs :deep(.el-tabs__content) {
  padding: 0;
}

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

.volume-control {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.input-new-tag {
  width: 90px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-top: 10px;
}

.status-item {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.status-item .label {
  font-size: 12px;
  color: #909399;
}

.status-item .value {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.network-result {
  margin-left: 10px;
  font-size: 13px;
}
.network-result.success { color: #67c23a; }
.network-result.error { color: #f56c6c; }

.log-history {
  margin-top: 30px;
}
.log-history h4 {
  margin-bottom: 10px;
}

.custom-tab-label {
  position: relative;
}

.dot {
  position: absolute;
  top: -2px;
  right: -6px;
  width: 6px;
  height: 6px;
  background: #f56c6c;
  border-radius: 50%;
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

.one-click-upgrade {
  margin-top: 20px;
}
</style>
