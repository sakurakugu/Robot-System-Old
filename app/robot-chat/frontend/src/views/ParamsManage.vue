<template>
  <div class="page">
    <div class="header">
      <h2>参数管理</h2>
    </div>
    <div class="content">
      <div class="card">
        <div class="row">
          <label class="label">模型服务商</label>
          <select v-model="llmProvider">
            <option v-for="p in providers" :key="p.value" :value="p.value">
              {{ p.label }}
            </option>
          </select>
        </div>
        <div class="row">
          <label class="label">使用模型</label>
          <select v-model="llmModel">
            <option v-for="m in availableModels" :key="m.value" :value="m.value">
              {{ m.label }}
            </option>
          </select>
        </div>
        <div class="row">
          <label class="label">API密钥</label>
          <div class="input-group">
            <div class="input-with-icon">
              <input v-model="apiKeyField" :readonly="apiKeyReadOnly" :type="llmApiKeyType" placeholder="粘贴服务商API Key" />
              <button v-if="!apiKeyReadOnly" class="eye-icon" @click="toggleApiKeyVisible" title="显示/隐藏">👁</button>
            </div>
            <button class="btn-icon" @click="pasteApiKey" title="粘贴">粘贴</button>
            <button class="btn-icon" v-if="apiKeyReadOnly && llmHasApiKey" @click="enableEditApiKey" title="编辑">编辑</button>
          </div>
        </div>
        <div class="row">
          <label class="label">后端地址</label>
          <input v-model="serverUrl" placeholder="http://localhost:3001" />
        </div>
        <div class="row">
          <label class="label">WebSocket路径</label>
          <input v-model="wsPath" placeholder="/api/conversation/connect" />
        </div>
        <div class="row">
          <label class="label">最大历史轮数</label>
          <input type="number" min="0" v-model.number="maxHistory" />
        </div>
        <div class="actions">
          <button @click="save">保存</button>
          <span class="hint" v-if="saved">已保存</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'

const serverUrl = ref('')
const wsPath = ref('/api/conversation/connect')
const maxHistory = ref<number>(10)
const saved = ref(false)
const llmProvider = ref<string>('openai')
const llmModel = ref('')
const llmApiKey = ref('')
const llmApiKeyType = ref<'password' | 'text'>('password')
const llmHasApiKey = ref(false)
const llmApiKeyLen = ref<number>(0)
const maskedText = computed(() => llmApiKeyLen.value > 0 ? Array(llmApiKeyLen.value).fill('•').join('') : '')
const apiKeyReadOnly = ref(false)
const apiKeyField = computed<string>({
  get() {
    if (apiKeyReadOnly.value && llmHasApiKey.value && !llmApiKey.value) return maskedText.value
    return llmApiKey.value
  },
  set(v: string) {
    llmApiKey.value = v
  }
})
const providers = ref<{ value: string; label: string; baseUrl?: string; models: { value: string; label: string }[] }[]>([])

const selectedProvider = computed(() => providers.value.find(p => p.value === llmProvider.value))

const availableModels = computed(() => selectedProvider.value?.models || [])

onMounted(async () => {
  try {
    const uiRes = await fetch('/api/config/ui').then(r => r.json()).catch(() => null)
    if (uiRes?.success && uiRes.data) {
      serverUrl.value = uiRes.data.serverUrl || ''
      wsPath.value = uiRes.data.wsPath || '/api/conversation/connect'
      maxHistory.value = typeof uiRes.data.maxHistory === 'number' ? uiRes.data.maxHistory : 10
      localStorage.setItem('rc_server_url', serverUrl.value || '')
      localStorage.setItem('rc_ws_path', wsPath.value || '/api/conversation/connect')
      localStorage.setItem('rc_max_history', String(maxHistory.value ?? 10))
    } else {
      serverUrl.value = localStorage.getItem('rc_server_url') || ''
      wsPath.value = localStorage.getItem('rc_ws_path') || '/api/conversation/connect'
      const mh = localStorage.getItem('rc_max_history')
      maxHistory.value = mh ? Number(mh) : 10
    }
  } catch {}
  try {
    const provRes = await fetch('/api/config/llm/providers').then(r => r.json())
    if (provRes?.success && Array.isArray(provRes.data)) {
      providers.value = provRes.data
    }
  } catch {}
  try {
    const cfgRes = await fetch('/api/config/llm').then(r => r.json())
    if (cfgRes?.success && cfgRes.data) {
      const backendProvider = cfgRes.data.provider || providers.value[0]?.value || 'openai'
      llmProvider.value = backendProvider
      const modelFromCfg =
        backendProvider === 'openai' ? cfgRes.data.openai?.model :
        backendProvider === 'bigmodel' ? cfgRes.data.bigmodel?.model : ''
      llmModel.value = modelFromCfg || (availableModels.value[0]?.value || '')
      const hasKey =
        backendProvider === 'openai' ? !!cfgRes.data.openai?.hasApiKey :
        backendProvider === 'bigmodel' ? !!cfgRes.data.bigmodel?.hasApiKey : false
      llmHasApiKey.value = hasKey
      llmApiKeyLen.value =
        backendProvider === 'openai' ? Number(cfgRes.data.openai?.apiKeyLength || 0) :
        backendProvider === 'bigmodel' ? Number(cfgRes.data.bigmodel?.apiKeyLength || 0) : 0
      apiKeyReadOnly.value = llmHasApiKey.value && !llmApiKey.value
    } else {
      const storedProvider = (localStorage.getItem('rc_llm_provider') as any) || providers.value[0]?.value || 'openai'
      llmProvider.value = storedProvider
      llmModel.value = localStorage.getItem('rc_llm_model') || (availableModels.value[0]?.value || '')
    }
  } catch {}
})

watch(llmProvider, async () => {
  if (!availableModels.value.find(m => m.value === llmModel.value)) {
    llmModel.value = availableModels.value[0]?.value || ''
  }
  try {
    const cfgRes = await fetch('/api/config/llm').then(r => r.json())
    if (cfgRes?.success && cfgRes.data) {
      const backendProvider = llmProvider.value
      const hasKey =
        backendProvider === 'openai' ? !!cfgRes.data.openai?.hasApiKey :
        backendProvider === 'bigmodel' ? !!cfgRes.data.bigmodel?.hasApiKey : false
      llmHasApiKey.value = hasKey
      llmApiKeyLen.value =
        backendProvider === 'openai' ? Number(cfgRes.data.openai?.apiKeyLength || 0) :
        backendProvider === 'bigmodel' ? Number(cfgRes.data.bigmodel?.apiKeyLength || 0) : 0
      apiKeyReadOnly.value = llmHasApiKey.value && !llmApiKey.value
    }
  } catch {}
})

const toggleApiKeyVisible = () => {
  llmApiKeyType.value = llmApiKeyType.value === 'password' ? 'text' : 'password'
}

const pasteApiKey = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) llmApiKey.value = text.trim()
  } catch {}
}

const enableEditApiKey = () => {
  apiKeyReadOnly.value = false
  llmApiKey.value = ''
  llmApiKeyType.value = 'text'
}

const save = () => {
  localStorage.setItem('rc_server_url', serverUrl.value || '')
  localStorage.setItem('rc_ws_path', wsPath.value || '/api/conversation/connect')
  localStorage.setItem('rc_max_history', String(maxHistory.value ?? 10))
  localStorage.setItem('rc_llm_provider', llmProvider.value)
  localStorage.setItem('rc_llm_model', llmModel.value || '')
  localStorage.setItem('rc_llm_api_key', llmApiKey.value || '')
  const payload: any = {
    provider: llmProvider.value,
    model: llmModel.value || '',
    baseUrl: selectedProvider.value?.baseUrl
  }
  if ((llmApiKey.value || '').trim().length > 0) {
    payload.apiKey = llmApiKey.value.trim()
  }
  fetch('/api/config/llm', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {})
  const uiPayload = {
    serverUrl: serverUrl.value || '',
    wsPath: wsPath.value || '/api/conversation/connect',
    maxHistory: maxHistory.value ?? 10
  }
  fetch('/api/config/ui', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uiPayload)
  }).catch(() => {})
  saved.value = true
  setTimeout(() => (saved.value = false), 1200)
}
</script>

<style scoped>
.page {
  height: 100%;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.header { display: flex; align-items: center; justify-content: space-between; }
.content { flex: 1; overflow: auto; }
.card {
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 1rem;
  max-width: 720px;
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
}
.label { color: #bbb; }
input, textarea, select {
  width: 100%;
  background-color: #1a1a1a;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
}
.actions { margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; }
button {
  background-color: #646cff;
  color: #fff;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 8px;
}
.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.input-with-icon {
  position: relative;
  flex: 1;
}
.input-with-icon input {
  padding-right: 2rem;
}
.eye-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #e0e0e0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-icon {
  background-color: #444;
  color: #fff;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  writing-mode: horizontal-tb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.hint { color: #7ee787; font-size: 0.9rem; }
@media (prefers-color-scheme: light) {
  .card { background-color: #fff; border-color: #e0e0e0; }
  input, textarea, select { background-color: #fff; color: #333; border-color: #ddd; }
  .btn-icon { background-color: #eee; color: #333; border: 1px solid #ddd; }
  .eye-icon { color: #666; }
}
</style>
