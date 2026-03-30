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

              <!-- 讯飞 ASR 配置 -->
              <el-divider content-position="left">
                讯飞 ASR
              </el-divider>
              <el-form-item label="APP ID">
                <el-input
                  v-model="xunfeiAsrConfig.appId"
                  :readonly="xunfeiAsrConfig.readonlyAppId"
                  :type="xunfeiAsrConfig.readonlyAppId || xunfeiAsrConfig.showAppId ? 'text' : 'password'"
                  placeholder="粘贴讯飞 APP ID"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!xunfeiAsrConfig.readonlyAppId"
                        :icon="View"
                        @click="toggleXunfeiVisibility('appId')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteXunfeiField('appId')"
                      />
                      <el-button
                        v-if="xunfeiAsrConfig.readonlyAppId && xunfeiAsrConfig.hasAppId"
                        :icon="Edit"
                        @click="enableXunfeiEdit('appId')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="API Key">
                <el-input
                  v-model="xunfeiAsrConfig.apiKey"
                  :readonly="xunfeiAsrConfig.readonlyApiKey"
                  :type="xunfeiAsrConfig.readonlyApiKey || xunfeiAsrConfig.showApiKey ? 'text' : 'password'"
                  placeholder="粘贴讯飞 API Key"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!xunfeiAsrConfig.readonlyApiKey"
                        :icon="View"
                        @click="toggleXunfeiVisibility('apiKey')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteXunfeiField('apiKey')"
                      />
                      <el-button
                        v-if="xunfeiAsrConfig.readonlyApiKey && xunfeiAsrConfig.hasApiKey"
                        :icon="Edit"
                        @click="enableXunfeiEdit('apiKey')"
                      />
                    </el-button-group>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="API Secret">
                <el-input
                  v-model="xunfeiAsrConfig.apiSecret"
                  :readonly="xunfeiAsrConfig.readonlyApiSecret"
                  :type="xunfeiAsrConfig.readonlyApiSecret || xunfeiAsrConfig.showApiSecret ? 'text' : 'password'"
                  placeholder="粘贴讯飞 API Secret"
                >
                  <template #append>
                    <el-button-group>
                      <el-button
                        v-if="!xunfeiAsrConfig.readonlyApiSecret"
                        :icon="View"
                        @click="toggleXunfeiVisibility('apiSecret')"
                      />
                      <el-button
                        :icon="CopyDocument"
                        @click="pasteXunfeiField('apiSecret')"
                      />
                      <el-button
                        v-if="xunfeiAsrConfig.readonlyApiSecret && xunfeiAsrConfig.hasApiSecret"
                        :icon="Edit"
                        @click="enableXunfeiEdit('apiSecret')"
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
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { useAuthStore } from '@/modules/auth/store'
import { CopyDocument, Edit, Select, Setting, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const formData = ref({})
const activeTab = ref('llm')
const saved = ref(false)
const authStore = useAuthStore()



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

const xunfeiAsrConfig = ref({
  appId: '',
  apiKey: '',
  apiSecret: '',
  showAppId: false,
  showApiKey: false,
  showApiSecret: false,
  readonlyAppId: false,
  readonlyApiKey: false,
  readonlyApiSecret: false,
  hasAppId: false,
  hasApiKey: false,
  hasApiSecret: false,
  appIdLength: 0,
  apiKeyLength: 0,
  apiSecretLength: 0
})

const getMaskedText = (len: number) => len > 0 ? Array(len).fill('•').join('') : ''

const authJson = async (url: string, init?: RequestInit) => {
  const token = localStorage.getItem('auth_token') || ''
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-client-type': 'web',
      'x-device-name': navigator.userAgent,
      ...(init?.headers || {}),
    },
  })
  return response.json()
}

onMounted(async () => {


  // 加载参数配置
  try {
    const cfgRes = await authJson('/api/v1/config/llm')
    console.log('参数配置响应:', cfgRes)
    if (cfgRes?.success && cfgRes.data && cfgRes.data.providers) {
      const providers = cfgRes.data.providers
      // OpenAI 配置
      if (providers.openai) {
        openaiConfig.value.hasKey = !!providers.openai.hasApiKey
        openaiConfig.value.keyLength = providers.openai.apiKeyLength || 0
        openaiConfig.value.readonly = openaiConfig.value.hasKey
        if (openaiConfig.value.hasKey) {
          openaiConfig.value.apiKey = getMaskedText(openaiConfig.value.keyLength)
          console.log('OpenAI配置:', openaiConfig.value)
        }
      }

      // BigModel 配置
      if (providers.bigmodel) {
        bigmodelConfig.value.hasKey = !!providers.bigmodel.hasApiKey
        bigmodelConfig.value.keyLength = providers.bigmodel.apiKeyLength || 0
        bigmodelConfig.value.readonly = bigmodelConfig.value.hasKey
        if (bigmodelConfig.value.hasKey) {
          bigmodelConfig.value.apiKey = getMaskedText(bigmodelConfig.value.keyLength)
          console.log('BigModel配置:', bigmodelConfig.value)
        }
      }

      // Anthropic 配置
      if (providers.anthropic) {
        anthropicConfig.value.hasKey = !!providers.anthropic.hasApiKey
        anthropicConfig.value.keyLength = providers.anthropic.apiKeyLength || 0
        anthropicConfig.value.readonly = anthropicConfig.value.hasKey
        if (anthropicConfig.value.hasKey) {
          anthropicConfig.value.apiKey = getMaskedText(anthropicConfig.value.keyLength)
          console.log('Anthropic配置:', anthropicConfig.value)
        }
      }

      // DeepSeek 配置
      if (providers.deepseek) {
        deepseekConfig.value.hasKey = !!providers.deepseek.hasApiKey
        deepseekConfig.value.keyLength = providers.deepseek.apiKeyLength || 0
        deepseekConfig.value.readonly = deepseekConfig.value.hasKey
        if (deepseekConfig.value.hasKey) {
          deepseekConfig.value.apiKey = getMaskedText(deepseekConfig.value.keyLength)
          console.log('DeepSeek配置:', deepseekConfig.value)
        }
      }

      // 千问 配置
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

  try {
    const aiRes = await authJson('/api/v1/config/ai')
    if (aiRes?.success && aiRes.data?.xunfeiAsr) {
      const xunfei = aiRes.data.xunfeiAsr
      xunfeiAsrConfig.value.hasAppId = !!xunfei.hasAppId
      xunfeiAsrConfig.value.hasApiKey = !!xunfei.hasApiKey
      xunfeiAsrConfig.value.hasApiSecret = !!xunfei.hasApiSecret
      xunfeiAsrConfig.value.appIdLength = xunfei.appIdLength || 0
      xunfeiAsrConfig.value.apiKeyLength = xunfei.apiKeyLength || 0
      xunfeiAsrConfig.value.apiSecretLength = xunfei.apiSecretLength || 0

      xunfeiAsrConfig.value.readonlyAppId = xunfeiAsrConfig.value.hasAppId
      xunfeiAsrConfig.value.readonlyApiKey = xunfeiAsrConfig.value.hasApiKey
      xunfeiAsrConfig.value.readonlyApiSecret = xunfeiAsrConfig.value.hasApiSecret

      if (xunfeiAsrConfig.value.hasAppId) {
        xunfeiAsrConfig.value.appId = getMaskedText(xunfeiAsrConfig.value.appIdLength)
      }
      if (xunfeiAsrConfig.value.hasApiKey) {
        xunfeiAsrConfig.value.apiKey = getMaskedText(xunfeiAsrConfig.value.apiKeyLength)
      }
      if (xunfeiAsrConfig.value.hasApiSecret) {
        xunfeiAsrConfig.value.apiSecret = getMaskedText(xunfeiAsrConfig.value.apiSecretLength)
      }
    }
  } catch (e) {
    console.error('加载讯飞配置失败:', e)
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
  } catch {
    // 剪贴板读取失败时保持当前输入框内容
  }
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

const toggleXunfeiVisibility = (field: 'appId' | 'apiKey' | 'apiSecret') => {
  if (field === 'appId') xunfeiAsrConfig.value.showAppId = !xunfeiAsrConfig.value.showAppId
  else if (field === 'apiKey') xunfeiAsrConfig.value.showApiKey = !xunfeiAsrConfig.value.showApiKey
  else if (field === 'apiSecret') xunfeiAsrConfig.value.showApiSecret = !xunfeiAsrConfig.value.showApiSecret
}

const pasteXunfeiField = async (field: 'appId' | 'apiKey' | 'apiSecret') => {
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    const value = text.trim()
    if (field === 'appId') xunfeiAsrConfig.value.appId = value
    else if (field === 'apiKey') xunfeiAsrConfig.value.apiKey = value
    else if (field === 'apiSecret') xunfeiAsrConfig.value.apiSecret = value
  } catch {
    // 剪贴板读取失败时保持当前输入框内容
  }
}

const enableXunfeiEdit = (field: 'appId' | 'apiKey' | 'apiSecret') => {
  if (field === 'appId') {
    xunfeiAsrConfig.value.readonlyAppId = false
    xunfeiAsrConfig.value.appId = ''
    xunfeiAsrConfig.value.showAppId = true
  } else if (field === 'apiKey') {
    xunfeiAsrConfig.value.readonlyApiKey = false
    xunfeiAsrConfig.value.apiKey = ''
    xunfeiAsrConfig.value.showApiKey = true
  } else if (field === 'apiSecret') {
    xunfeiAsrConfig.value.readonlyApiSecret = false
    xunfeiAsrConfig.value.apiSecret = ''
    xunfeiAsrConfig.value.showApiSecret = true
  }
}

const saveLLMConfig = async () => {
  if (!authStore.isSuperAdmin) {
    ElMessage.error('仅主管理员可修改 API Key')
    return
  }
  const llmPayload: any = {}

  // OpenAI 配置
  if ((openaiConfig.value.apiKey || '').trim().length > 0 && openaiConfig.value.apiKey !== getMaskedText(openaiConfig.value.keyLength)) {
    llmPayload.openai = { apiKey: openaiConfig.value.apiKey.trim() }
  }

  // BigModel 配置
  if ((bigmodelConfig.value.apiKey || '').trim().length > 0 && bigmodelConfig.value.apiKey !== getMaskedText(bigmodelConfig.value.keyLength)) {
    llmPayload.bigmodel = { apiKey: bigmodelConfig.value.apiKey.trim() }
  }

  // Anthropic 配置
  if ((anthropicConfig.value.apiKey || '').trim().length > 0 && anthropicConfig.value.apiKey !== getMaskedText(anthropicConfig.value.keyLength)) {
    llmPayload.anthropic = { apiKey: anthropicConfig.value.apiKey.trim() }
  }

  // DeepSeek 配置
  if ((deepseekConfig.value.apiKey || '').trim().length > 0 && deepseekConfig.value.apiKey !== getMaskedText(deepseekConfig.value.keyLength)) {
    llmPayload.deepseek = { apiKey: deepseekConfig.value.apiKey.trim() }
  }

  // 千问 配置
  if ((aliyunConfig.value.apiKey || '').trim().length > 0 && aliyunConfig.value.apiKey !== getMaskedText(aliyunConfig.value.keyLength)) {
    llmPayload.aliyun = { apiKey: aliyunConfig.value.apiKey.trim() }
  }

  const xunfeiPayload: any = {}
  if ((xunfeiAsrConfig.value.appId || '').trim().length > 0 && xunfeiAsrConfig.value.appId !== getMaskedText(xunfeiAsrConfig.value.appIdLength)) {
    xunfeiPayload.appId = xunfeiAsrConfig.value.appId.trim()
  }
  if ((xunfeiAsrConfig.value.apiKey || '').trim().length > 0 && xunfeiAsrConfig.value.apiKey !== getMaskedText(xunfeiAsrConfig.value.apiKeyLength)) {
    xunfeiPayload.apiKey = xunfeiAsrConfig.value.apiKey.trim()
  }
  if ((xunfeiAsrConfig.value.apiSecret || '').trim().length > 0 && xunfeiAsrConfig.value.apiSecret !== getMaskedText(xunfeiAsrConfig.value.apiSecretLength)) {
    xunfeiPayload.apiSecret = xunfeiAsrConfig.value.apiSecret.trim()
  }

  const hasLLMUpdate = Object.keys(llmPayload).length > 0
  const hasXunfeiUpdate = Object.keys(xunfeiPayload).length > 0

  try {
    if (hasLLMUpdate) {
      await authJson('/api/v1/config/llm', {
        method: 'PUT',
        body: JSON.stringify(llmPayload)
      })
    }
    if (hasXunfeiUpdate) {
      await authJson('/api/v1/config/ai', {
        method: 'PUT',
        body: JSON.stringify({ xunfeiAsr: xunfeiPayload })
      })
    }

    if (hasLLMUpdate || hasXunfeiUpdate) {
      saved.value = true
      setTimeout(() => (saved.value = false), 1200)
    }
  } catch {
    ElMessage.error('保存失败')
  }
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
  color: var(--el-text-color-primary);
}

:deep(.el-divider__text) {
  background-color: transparent;
}
</style>
