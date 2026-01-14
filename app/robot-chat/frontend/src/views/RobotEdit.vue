<template>
  <div class="robot-edit">
    <el-page-header @back="() => router.push('/robots')" class="page-header">
      <template #content>
        <div class="header-content">
          <el-icon :size="24"><Bot /></el-icon>
          <span class="title">编辑机器人</span>
        </div>
      </template>
      <template #extra>
        <el-button type="primary" @click="saveRobot" :disabled="!isFormValid" :icon="Select">
          保存
        </el-button>
      </template>
    </el-page-header>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      style="margin: 0 0 20px"
    />

    <div class="form-content" v-loading="loading">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="24" :md="12" :lg="8">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><InfoFilled /></el-icon>
                <span>基础信息</span>
              </div>
            </template>
            <el-form :model="formData" label-position="top">
              <el-form-item label="名称" required>
                <el-input v-model="formData.name" placeholder="例如：机器狗1" />
              </el-form-item>
              <el-form-item label="分组">
                <el-input v-model="formData.group_name" placeholder="选填，例如：舞蹈组" />
              </el-form-item>
              <el-form-item label="UUID">
                <el-input :value="uuid" disabled />
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="24" :md="12" :lg="8">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><Connection /></el-icon>
                <span>网络配置</span>
              </div>
            </template>
            <el-form :model="formData" label-position="top">
              <el-form-item label="机器人IP">
                <el-input v-model="formData.robot_ip" placeholder="例如：192.168.1.110" />
                <el-text v-if="formData.robot_ip && !isValidIp(formData.robot_ip)" type="danger" size="small">
                  IP格式不正确
                </el-text>
              </el-form-item>
              <el-form-item label="本地IP">
                <el-input v-model="formData.local_ip" placeholder="例如：192.168.1.105" />
                <el-text v-if="formData.local_ip && !isValidIp(formData.local_ip)" type="danger" size="small">
                  IP格式不正确
                </el-text>
              </el-form-item>
              <el-form-item label="本地端口">
                <el-input v-model="localPortInput" placeholder="例如：10131" />
                <el-text v-if="localPortInput && !isValidPort(localPortInput)" type="danger" size="small">
                  端口需为1-65535的整数
                </el-text>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="24" :md="24" :lg="8">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><MagicStick /></el-icon>
                <span>AI 配置</span>
              </div>
            </template>
            <el-form :model="formData" label-position="top">
              <el-form-item label="回复温度">
                <el-slider
                  v-model="formData.ai_temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  show-input
                  :input-size="'small'"
                />
              </el-form-item>
              <el-form-item label="使用模型">
                <el-select v-model="formData.ai_model" placeholder="请选择模型" style="width: 100%">
                  <el-option
                    v-for="m in availableModels"
                    :key="m.value"
                    :label="m.label"
                    :value="m.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="音色">
                <el-select v-model="formData.ai_voice" placeholder="请选择音色" style="width: 100%">
                  <el-option label="女声-温柔" value="female-soft" />
                  <el-option label="女声-活泼" value="female-bright" />
                  <el-option label="男声-低沉" value="male-deep" />
                  <el-option label="男声-洪亮" value="male-bright" />
                  <el-option label="童声" value="child" />
                  <el-option label="电子音" value="robotic" />
                </el-select>
              </el-form-item>
              <el-form-item label="意图识别">
                <el-select v-model="formData.ai_intent" placeholder="请选择方案" style="width: 100%">
                  <el-option label="规则引擎" value="rule-based" />
                  <el-option label="LLM分类器" value="llm-classifier" />
                  <el-option label="混合策略" value="hybrid" />
                </el-select>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <el-col :span="24">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><ChatLineRound /></el-icon>
                <span>系统提示词</span>
              </div>
            </template>
            <el-form :model="formData" label-position="top">
              <el-form-item label="角色名称">
                <el-input v-model="formData.ai_role_name" placeholder="例如：导航助手、舞蹈导师" />
              </el-form-item>
              <el-form-item label="系统提示词">
                <el-input
                  v-model="formData.ai_system_prompt"
                  type="textarea"
                  :rows="6"
                  placeholder="例如：保持安全、简洁、友好"
                />
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  InfoFilled, Connection, MagicStick, ChatLineRound, Select
} from '@element-plus/icons-vue'
import { Bot } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const uuid = computed(() => route.params.uuid as string | undefined)

const error = ref('')
const loading = ref(false)

const formData = ref({
  name: '',
  robot_ip: '',
  local_ip: '',
  local_port: 10000,
  group_name: '',
  ai_temperature: 0.7,
  ai_system_prompt: '',
  ai_role_name: '',
  ai_model: '',
  ai_voice: '',
  ai_intent: ''
})

const localPortInput = ref<string>('10000')
const llmProvider = ref<'openai' | 'anthropic' | 'deepseek'>('openai')
const availableModels = computed(() => {
  const map: Record<string, { value: string; label: string }[]> = {
    openai: [
      { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
      { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini' },
      { value: 'gpt-4.1', label: 'OpenAI GPT-4.1' }
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
      { value: 'claude-3-opus', label: 'Anthropic Claude 3 Opus' }
    ],
    deepseek: [
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
      { value: 'deepseek-chat', label: 'DeepSeek Chat' }
    ]
  }
  return map[llmProvider.value] || []
})

const isValidIp = (ip: string) => {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/
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

async function loadRobot() {
  if (!uuid.value) return
  loading.value = true
  error.value = ''
  try {
    llmProvider.value = (localStorage.getItem('rc_llm_provider') as any) || 'openai'
    const res = await fetch(`/api/robots/${uuid.value}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
    const r = json.data
    let meta: any = {}
    try {
      meta = r.metadata ? JSON.parse(r.metadata) : {}
    } catch { meta = {} }
    formData.value = {
      name: r.name || '',
      robot_ip: r.robot_ip ?? meta.robot_ip ?? '',
      local_ip: r.local_ip ?? meta.local_ip ?? '',
      local_port: r.local_port ?? meta.local_port ?? 10000,
      group_name: r.group_name ?? meta.group_name ?? '',
      ai_temperature: meta.ai_temperature ?? 0.7,
      ai_system_prompt: meta.ai_system_prompt ?? '',
      ai_role_name: '',
      ai_model: r.model || meta.ai_model || '',
      ai_voice: '',
      ai_intent: ''
    }
    localPortInput.value = String(formData.value.local_port)
  } catch (e: any) {
    error.value = e?.message || '加载失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

async function saveRobot() {
  if (!uuid.value) return
  const payload = {
    name: formData.value.name,
    robot_ip: formData.value.robot_ip,
    local_ip: formData.value.local_ip,
    local_port: Number(localPortInput.value || formData.value.local_port),
    group_name: formData.value.group_name || '',
    ai_temperature: formData.value.ai_temperature,
    ai_system_prompt: formData.value.ai_system_prompt,
    model: formData.value.ai_model || ''
  }
  try {
    const res = await fetch(`/api/robots/${uuid.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
    ElMessage.success('保存成功')
    router.push('/robots')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

onMounted(() => {
  loadRobot()
})
</script>

<style scoped>
.robot-edit {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
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

.form-content {
  min-height: 400px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:deep(.el-card) {
  margin-bottom: 20px;
}

:deep(.el-card__body) {
  padding-top: 10px;
}
</style>
