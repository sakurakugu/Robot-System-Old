<template>
  <div class="page">
    <el-page-header @back="() => {}" class="page-header">
      <template #content>
        <div class="header-content">
          <el-icon :size="24"><Setting /></el-icon>
          <span class="title">参数管理</span>
        </div>
      </template>
    </el-page-header>
    <div class="content">
      <el-card shadow="hover">
        <el-form :model="formData" label-width="120px" label-position="left">
          <el-form-item label="模型服务商">
            <el-select v-model="llmProvider" placeholder="请选择服务商" style="width: 100%">
              <el-option
                v-for="p in providers"
                :key="p.value"
                :label="p.label"
                :value="p.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="使用模型">
            <el-select v-model="llmModel" placeholder="请选择模型" style="width: 100%">
              <el-option
                v-for="m in availableModels"
                :key="m.value"
                :label="m.label"
                :value="m.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="API密钥">
            <el-input
              v-model="apiKeyField"
              :readonly="apiKeyReadOnly"
              :type="llmApiKeyType"
              placeholder="粘贴服务商API Key"
            >
              <template #append>
                <el-button-group>
                  <el-button :icon="View" @click="toggleApiKeyVisible" v-if="!apiKeyReadOnly" />
                  <el-button :icon="CopyDocument" @click="pasteApiKey" />
                  <el-button :icon="Edit" @click="enableEditApiKey" v-if="apiKeyReadOnly && llmHasApiKey" />
                </el-button-group>
              </template>
            </el-input>
          </el-form-item>
          <el-divider />
          <el-form-item label="后端地址">
            <el-input v-model="serverUrl" placeholder="http://localhost:3001" />
          </el-form-item>
          <el-form-item label="WebSocket路径">
            <el-input v-model="wsPath" placeholder="/api/conversation/connect" />
          </el-form-item>
          <el-form-item label="最大历史轮数">
            <el-input-number v-model="maxHistory" :min="0" :max="100" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="save" :icon="Select">保存</el-button>
            <el-text v-if="saved" type="success" style="margin-left: 12px">已保存</el-text>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Setting, View, CopyDocument, Edit, Select } from '@element-plus/icons-vue'

const formData = ref({})

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
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
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
  max-width: 800px;
}

:deep(.el-card__body) {
  padding: 30px;
}
</style>
