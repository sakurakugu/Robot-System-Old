<template>
  <div class="page">
    <PageHeader
      title="参数管理"
      :icon="Setting"
    />
    <div class="content">
      <el-tabs
        v-model="activeTab"
        tab-position="left"
        class="settings-tabs"
      >
        <!-- LLM配置标签页 -->
        <el-tab-pane
          label="模型配置"
          name="llm"
        >
          <div class="pane-content">
            <h3 class="section-title">
              大语言模型API配置
            </h3>
            <el-form
              :model="formData"
              label-width="120px"
              label-position="left"
            >
              <!-- OpenAI 配置 -->
              <el-divider content-position="left">
                OpenAI
              </el-divider>
              <el-form-item label="API密钥">
                <el-input
                  v-model="openaiConfig.apiKey"
                  :readonly="openaiConfig.readonly"
                  :type="openaiConfig.readonly || openaiConfig.showKey ? 'text' : 'password'"
                  placeholder="粘贴OpenAI API Key"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!openaiConfig.readonly"
                        :icon="View"
                        @click="toggleVisibility('openai')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteApiKey('openai')"
                      />
                      <el-button
                        v-if="openaiConfig.readonly && openaiConfig.hasKey"
                        :icon="Edit"
                        @click="enableEdit('openai')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>

              <!-- BigModel 配置 -->
              <el-divider content-position="left">
                智谱AI (BigModel)
              </el-divider>
              <el-form-item label="API密钥">
                <el-input
                  v-model="bigmodelConfig.apiKey"
                  :readonly="bigmodelConfig.readonly"
                  :type="bigmodelConfig.readonly || bigmodelConfig.showKey ? 'text' : 'password'"
                  placeholder="粘贴BigModel API Key"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!bigmodelConfig.readonly"
                        :icon="View"
                        @click="toggleVisibility('bigmodel')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteApiKey('bigmodel')"
                      />
                      <el-button
                        v-if="bigmodelConfig.readonly && bigmodelConfig.hasKey"
                        :icon="Edit"
                        @click="enableEdit('bigmodel')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>

              <!-- Anthropic 配置 -->
              <el-divider content-position="left">
                Anthropic (Claude)
              </el-divider>
              <el-form-item label="API密钥">
                <el-input
                  v-model="anthropicConfig.apiKey"
                  :readonly="anthropicConfig.readonly"
                  :type="anthropicConfig.readonly || anthropicConfig.showKey ? 'text' : 'password'"
                  placeholder="粘贴Anthropic API Key"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!anthropicConfig.readonly"
                        :icon="View"
                        @click="toggleVisibility('anthropic')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteApiKey('anthropic')"
                      />
                      <el-button
                        v-if="anthropicConfig.readonly && anthropicConfig.hasKey"
                        :icon="Edit"
                        @click="enableEdit('anthropic')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>

              <!-- DeepSeek 配置 -->
              <el-divider content-position="left">
                DeepSeek
              </el-divider>
              <el-form-item label="API密钥">
                <el-input
                  v-model="deepseekConfig.apiKey"
                  :readonly="deepseekConfig.readonly"
                  :type="deepseekConfig.readonly || deepseekConfig.showKey ? 'text' : 'password'"
                  placeholder="粘贴DeepSeek API Key"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!deepseekConfig.readonly"
                        :icon="View"
                        @click="toggleVisibility('deepseek')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteApiKey('deepseek')"
                      />
                      <el-button
                        v-if="deepseekConfig.readonly && deepseekConfig.hasKey"
                        :icon="Edit"
                        @click="enableEdit('deepseek')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>

              <!-- 千问 配置 -->
              <el-divider content-position="left">
                千问 (Aliyun)
              </el-divider>
              <el-form-item label="API密钥">
                <el-input
                  v-model="aliyunConfig.apiKey"
                  :readonly="aliyunConfig.readonly"
                  :type="aliyunConfig.readonly || aliyunConfig.showKey ? 'text' : 'password'"
                  placeholder="粘贴阿里云 API Key"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!aliyunConfig.readonly"
                        :icon="View"
                        @click="toggleVisibility('aliyun')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteApiKey('aliyun')"
                      />
                      <el-button
                        v-if="aliyunConfig.readonly && aliyunConfig.hasKey"
                        :icon="Edit"
                        @click="enableEdit('aliyun')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :icon="Select"
                  @click="saveLLMConfig"
                >
                  保存API配置
                </el-button>
                <el-text
                  v-if="saved"
                  type="success"
                  style="margin-left: 12px"
                >
                  已保存
                </el-text>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 后端配置标签页 -->
        <el-tab-pane
          label="后端配置"
          name="connection"
        >
          <div class="pane-content">
            <h3 class="section-title">
              后端连接配置
            </h3>
            <el-form
              :model="formData"
              label-width="120px"
              label-position="left"
            >
              <el-form-item label="后端地址">
                <el-input
                  v-model="serverUrl"
                  placeholder="http://localhost:3001"
                />
              </el-form-item>
              <el-form-item label="WebSocket路径">
                <el-input
                  v-model="wsPath"
                  placeholder="/api/v1/interaction/connect"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  :icon="Select"
                  @click="saveConnectionConfig"
                >
                  保存后端配置
                </el-button>
                <el-text
                  v-if="connectionSaved"
                  type="success"
                  style="margin-left: 12px"
                >
                  已保存
                </el-text>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { CopyDocument, Edit, Select, Setting, View } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue'

const formData = ref({})
const activeTab = ref('llm')
const saved = ref(false)

// 后端配置
const serverUrl = ref('')
const wsPath = ref('/api/v1/interaction/connect')
const connectionSaved = ref(false)

// 各服务商配置
const openaiConfig = ref({
  apiKey: '',
  showKey: false,
  readonly: false,
  hasKey: false,
  keyLength: 0
})

const bigmodelConfig = ref({
  apiKey: '',
  showKey: false,
  readonly: false,
  hasKey: false,
  keyLength: 0
})

const anthropicConfig = ref({
  apiKey: '',
  showKey: false,
  readonly: false,
  hasKey: false,
  keyLength: 0
})

const deepseekConfig = ref({
  apiKey: '',
  showKey: false,
  readonly: false,
  hasKey: false,
  keyLength: 0
})

const aliyunConfig = ref({
  apiKey: '',
  showKey: false,
  readonly: false,
  hasKey: false,
  keyLength: 0
})

const getMaskedText = (len: number) => len > 0 ? Array(len).fill('•').join('') : ''


onMounted(async () => {
  // 加载后端配置
  try {
    const uiRes = await fetch('/api/v1/config/ui').then(r => r.json()).catch(() => null)
    if (uiRes?.success && uiRes.data) {
      serverUrl.value = uiRes.data.serverUrl || ''
      wsPath.value = uiRes.data.wsPath || '/api/v1/interaction/connect'
      localStorage.setItem('rc_server_url', serverUrl.value || '')
      localStorage.setItem('rc_ws_path', wsPath.value || '/api/v1/interaction/connect')
    } else {
      serverUrl.value = localStorage.getItem('rc_server_url') || ''
      wsPath.value = localStorage.getItem('rc_ws_path') || '/api/v1/interaction/connect'
    }
  } catch {}

  // 加载参数配置
  try {
    const cfgRes = await fetch('/api/v1/config/llm').then(r => r.json())
    console.log('参数配置响应:', cfgRes)
    if (cfgRes?.success && cfgRes.data && cfgRes.data.providers) {
      const providers = cfgRes.data.providers
      // OpenAI
      if (providers.openai) {
        openaiConfig.value.hasKey = !!providers.openai.hasApiKey
        openaiConfig.value.keyLength = providers.openai.apiKeyLength || 0
        openaiConfig.value.readonly = openaiConfig.value.hasKey
        if (openaiConfig.value.hasKey) {
          openaiConfig.value.apiKey = getMaskedText(openaiConfig.value.keyLength)
          console.log('OpenAI配置:', openaiConfig.value)
        }
      }

      // BigModel
      if (providers.bigmodel) {
        bigmodelConfig.value.hasKey = !!providers.bigmodel.hasApiKey
        bigmodelConfig.value.keyLength = providers.bigmodel.apiKeyLength || 0
        bigmodelConfig.value.readonly = bigmodelConfig.value.hasKey
        if (bigmodelConfig.value.hasKey) {
          bigmodelConfig.value.apiKey = getMaskedText(bigmodelConfig.value.keyLength)
          console.log('BigModel配置:', bigmodelConfig.value)
        }
      }

      // Anthropic
      if (providers.anthropic) {
        anthropicConfig.value.hasKey = !!providers.anthropic.hasApiKey
        anthropicConfig.value.keyLength = providers.anthropic.apiKeyLength || 0
        anthropicConfig.value.readonly = anthropicConfig.value.hasKey
        if (anthropicConfig.value.hasKey) {
          anthropicConfig.value.apiKey = getMaskedText(anthropicConfig.value.keyLength)
          console.log('Anthropic配置:', anthropicConfig.value)
        }
      }

      // DeepSeek
      if (providers.deepseek) {
        deepseekConfig.value.hasKey = !!providers.deepseek.hasApiKey
        deepseekConfig.value.keyLength = providers.deepseek.apiKeyLength || 0
        deepseekConfig.value.readonly = deepseekConfig.value.hasKey
        if (deepseekConfig.value.hasKey) {
          deepseekConfig.value.apiKey = getMaskedText(deepseekConfig.value.keyLength)
          console.log('DeepSeek配置:', deepseekConfig.value)
        }
      }

      // 千问
      if (providers.aliyun) {
        aliyunConfig.value.hasKey = !!providers.aliyun.hasApiKey
        aliyunConfig.value.keyLength = providers.aliyun.apiKeyLength || 0
        aliyunConfig.value.readonly = aliyunConfig.value.hasKey
        if (aliyunConfig.value.hasKey) {
          aliyunConfig.value.apiKey = getMaskedText(aliyunConfig.value.keyLength)
          console.log('千问配置:', aliyunConfig.value)
        }
      }
    }
  } catch (e) {
    console.error('加载参数配置失败:', e)
  }

})

const toggleVisibility = (provider: string) => {
  if (provider === 'openai') openaiConfig.value.showKey = !openaiConfig.value.showKey
  else if (provider === 'bigmodel') bigmodelConfig.value.showKey = !bigmodelConfig.value.showKey
  else if (provider === 'anthropic') anthropicConfig.value.showKey = !anthropicConfig.value.showKey
  else if (provider === 'deepseek') deepseekConfig.value.showKey = !deepseekConfig.value.showKey
  else if (provider === 'aliyun') aliyunConfig.value.showKey = !aliyunConfig.value.showKey
}

const pasteApiKey = async (provider: string) => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      if (provider === 'openai') openaiConfig.value.apiKey = text.trim()
      else if (provider === 'bigmodel') bigmodelConfig.value.apiKey = text.trim()
      else if (provider === 'anthropic') anthropicConfig.value.apiKey = text.trim()
      else if (provider === 'deepseek') deepseekConfig.value.apiKey = text.trim()
      else if (provider === 'aliyun') aliyunConfig.value.apiKey = text.trim()
    }
  } catch {}
}

const enableEdit = (provider: string) => {
  if (provider === 'openai') {
    openaiConfig.value.readonly = false
    openaiConfig.value.apiKey = ''
    openaiConfig.value.showKey = true
  } else if (provider === 'bigmodel') {
    bigmodelConfig.value.readonly = false
    bigmodelConfig.value.apiKey = ''
    bigmodelConfig.value.showKey = true
  } else if (provider === 'anthropic') {
    anthropicConfig.value.readonly = false
    anthropicConfig.value.apiKey = ''
    anthropicConfig.value.showKey = true
  } else if (provider === 'deepseek') {
    deepseekConfig.value.readonly = false
    deepseekConfig.value.apiKey = ''
    deepseekConfig.value.showKey = true
  } else if (provider === 'aliyun') {
    aliyunConfig.value.readonly = false
    aliyunConfig.value.apiKey = ''
    aliyunConfig.value.showKey = true
  }
}

const saveLLMConfig = async () => {
  const payload: any = {}

  // OpenAI
  if ((openaiConfig.value.apiKey || '').trim().length > 0 && openaiConfig.value.apiKey !== getMaskedText(openaiConfig.value.keyLength)) {
    payload.openai = { apiKey: openaiConfig.value.apiKey.trim() }
  }

  // BigModel
  if ((bigmodelConfig.value.apiKey || '').trim().length > 0 && bigmodelConfig.value.apiKey !== getMaskedText(bigmodelConfig.value.keyLength)) {
    payload.bigmodel = { apiKey: bigmodelConfig.value.apiKey.trim() }
  }

  // Anthropic
  if ((anthropicConfig.value.apiKey || '').trim().length > 0 && anthropicConfig.value.apiKey !== getMaskedText(anthropicConfig.value.keyLength)) {
    payload.anthropic = { apiKey: anthropicConfig.value.apiKey.trim() }
  }

  // DeepSeek
  if ((deepseekConfig.value.apiKey || '').trim().length > 0 && deepseekConfig.value.apiKey !== getMaskedText(deepseekConfig.value.keyLength)) {
    payload.deepseek = { apiKey: deepseekConfig.value.apiKey.trim() }
  }

  // 千问
  if ((aliyunConfig.value.apiKey || '').trim().length > 0 && aliyunConfig.value.apiKey !== getMaskedText(aliyunConfig.value.keyLength)) {
    payload.aliyun = { apiKey: aliyunConfig.value.apiKey.trim() }
  }

  try {
    const res = await fetch('/api/v1/config/llm', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      saved.value = true
      setTimeout(() => (saved.value = false), 1200)
    }
  } catch {}
}

const saveConnectionConfig = async () => {
  localStorage.setItem('rc_server_url', serverUrl.value || '')
  localStorage.setItem('rc_ws_path', wsPath.value || '/api/v1/interaction/connect')

  const uiPayload = {
    serverUrl: serverUrl.value || '',
    wsPath: wsPath.value || '/api/v1/interaction/connect',
  }

  try {
    await fetch('/api/v1/config/ui', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uiPayload)
    })
    connectionSaved.value = true
    setTimeout(() => (connectionSaved.value = false), 1200)
  } catch {}
}
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.content {
  min-height: 400px;
}

.settings-tabs {
  width: 100%;
}

.settings-tabs :deep(.el-tabs__content) {
  padding: 20px;
}

.pane-content {
  padding-right: 10px;
  max-width: 800px;
}

.section-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

:deep(.el-divider__text) {
  background-color: transparent;
}
</style>
