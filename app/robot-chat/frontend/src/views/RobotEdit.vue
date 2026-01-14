<template>
  <div class="robot-edit">
    <div class="page-header">
      <div class="left">
        <button class="btn-back" @click="router.push('/robots')" title="返回">
          <el-icon><ArrowLeft /></el-icon>
        </button>
      </div>
      <h2>编辑机器人</h2>
      <div class="right">
        <button class="btn-primary" @click="saveRobot" :disabled="!isFormValid">保存</button>
      </div>
    </div>

    <div v-if="error" class="error-hint">{{ error }}</div>

    <div class="grid">
      <section class="card">
        <div class="card-header">
          <h3>基础信息</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>名称 *</label>
            <input v-model="formData.name" type="text" placeholder="例如：机器狗1" />
          </div>
          <div class="form-group">
            <label>分组</label>
            <input v-model="formData.group_name" type="text" placeholder="选填，例如：舞蹈组" />
          </div>
          <div class="form-group">
            <label>UUID</label>
            <input :value="uuid" type="text" disabled />
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>网络配置</h3>
        </div>
        <div class="card-body">
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
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>AI 配置</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>回复温度</label>
            <input v-model.number="formData.ai_temperature" type="number" step="0.1" min="0" max="2" />
          </div>
          <div class="form-group">
            <label>系统提示词</label>
            <textarea v-model="formData.ai_system_prompt" rows="4" placeholder="例如：保持安全、简洁、友好" />
          </div>
          <div class="form-group">
            <label>角色名称</label>
            <input v-model="formData.ai_role_name" type="text" placeholder="例如：导航助手、舞蹈导师" />
          </div>
          <div class="form-group">
            <label>使用模型</label>
            <select v-model="formData.ai_model">
              <option value="">请选择模型</option>
              <option v-for="m in availableModels" :key="m.value" :value="m.value">
                {{ m.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>音色</label>
            <select v-model="formData.ai_voice">
              <option value="">请选择音色</option>
              <option value="female-soft">女声-温柔</option>
              <option value="female-bright">女声-活泼</option>
              <option value="male-deep">男声-低沉</option>
              <option value="male-bright">男声-洪亮</option>
              <option value="child">童声</option>
              <option value="robotic">电子音</option>
            </select>
          </div>
          <div class="form-group">
            <label>意图识别</label>
            <select v-model="formData.ai_intent">
              <option value="">请选择方案</option>
              <option value="rule-based">规则引擎</option>
              <option value="llm-classifier">LLM分类器</option>
              <option value="hybrid">混合策略</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  </div>
  </template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'

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
  color: var(--el-text-color-primary);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
  font-size: 24px;
  color: var(--el-text-color-primary);
}
.page-header .left { display: flex; align-items: center; }
.btn-back {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}
.btn-back:hover { background: var(--el-fill-color-light); }
.page-header .right { display: flex; gap: 10px; }
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}
.card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color);
}
.card-header h3 { margin: 0; font-size: 18px; color: var(--el-text-color-primary); }
.card-body { padding: 20px; }
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
.form-group select {
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
.input-error { margin-top: 6px; font-size: 12px; color: var(--el-color-danger); }
.error-hint { padding: 10px; color: var(--el-color-danger); }
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.8rem;
  color: #9ecbff;
  word-break: break-all;
}
</style>
