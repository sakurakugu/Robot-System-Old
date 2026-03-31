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
              <template
                v-for="provider in llmProviderSections"
                :key="provider.key"
              >
                <el-divider content-position="left">
                  {{ provider.title }}
                </el-divider>
                <MaskedSecretInput
                  label="API密钥"
                  :model-value="provider.modelValue"
                  :readonly="provider.readonly"
                  :show-value="provider.showValue"
                  :has-value="provider.hasValue"
                  :placeholder="provider.placeholder"
                  @update:model-value="updateProviderValue(provider.key, $event)"
                  @toggle-visibility="toggleVisibility(provider.key)"
                  @paste="pasteApiKey(provider.key)"
                  @enable-edit="enableEdit(provider.key)"
                />
              </template>

              <el-divider content-position="left">
                讯飞 ASR
              </el-divider>
              <MaskedSecretInput
                v-for="field in xunfeiFields"
                :key="field.key"
                :label="field.label"
                :model-value="field.modelValue"
                :readonly="field.readonly"
                :show-value="field.showValue"
                :has-value="field.hasValue"
                :placeholder="field.placeholder"
                @update:model-value="updateXunfeiField(field.key, $event)"
                @toggle-visibility="toggleXunfeiVisibility(field.key)"
                @paste="pasteXunfeiField(field.key)"
                @enable-edit="enableXunfeiEdit(field.key)"
              />

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
import { useAuthStore } from '@/features/auth/store'
import PageHeader from '@/share/components/PageHeader.vue'
import { Select, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { getAIConfig, getLLMConfig, updateAIConfig, updateLLMConfig } from '../api'
import MaskedSecretInput from '../components/MaskedSecretInput.vue'
import {
  applyProviderSecretConfig,
  applyXunfeiAsrSecretConfig,
  buildLLMUpdatePayload,
  buildXunfeiUpdatePayload,
  createProviderSecretConfig,
  createXunfeiAsrSecretConfig,
  enableProviderEdit,
  enableXunfeiFieldEdit,
  llmProviderKeys,
  setProviderSecretValue,
  setXunfeiFieldValue,
  toggleProviderVisibility,
  toggleXunfeiFieldVisibility,
  type XunfeiFieldKey,
} from '../params'
import type { LLMProviderKey } from '../types'

const formData = ref({})
const activeTab = ref('llm')
const saved = ref(false)
const authStore = useAuthStore()



// 各服务商配置
const openaiConfig = ref(createProviderSecretConfig())
const bigmodelConfig = ref(createProviderSecretConfig())
const anthropicConfig = ref(createProviderSecretConfig())
const deepseekConfig = ref(createProviderSecretConfig())
const aliyunConfig = ref(createProviderSecretConfig())
const xunfeiAsrConfig = ref(createXunfeiAsrSecretConfig())

const llmProviderSections = computed(() => [
  {
    key: 'openai' as const,
    title: 'OpenAI',
    placeholder: '粘贴OpenAI API Key',
    modelValue: openaiConfig.value.apiKey,
    readonly: openaiConfig.value.readonly,
    showValue: openaiConfig.value.showKey,
    hasValue: openaiConfig.value.hasKey,
  },
  {
    key: 'bigmodel' as const,
    title: '智谱AI (BigModel)',
    placeholder: '粘贴BigModel API Key',
    modelValue: bigmodelConfig.value.apiKey,
    readonly: bigmodelConfig.value.readonly,
    showValue: bigmodelConfig.value.showKey,
    hasValue: bigmodelConfig.value.hasKey,
  },
  {
    key: 'anthropic' as const,
    title: 'Anthropic (Claude)',
    placeholder: '粘贴Anthropic API Key',
    modelValue: anthropicConfig.value.apiKey,
    readonly: anthropicConfig.value.readonly,
    showValue: anthropicConfig.value.showKey,
    hasValue: anthropicConfig.value.hasKey,
  },
  {
    key: 'deepseek' as const,
    title: 'DeepSeek',
    placeholder: '粘贴DeepSeek API Key',
    modelValue: deepseekConfig.value.apiKey,
    readonly: deepseekConfig.value.readonly,
    showValue: deepseekConfig.value.showKey,
    hasValue: deepseekConfig.value.hasKey,
  },
  {
    key: 'aliyun' as const,
    title: '千问 (Aliyun)',
    placeholder: '粘贴阿里云 API Key',
    modelValue: aliyunConfig.value.apiKey,
    readonly: aliyunConfig.value.readonly,
    showValue: aliyunConfig.value.showKey,
    hasValue: aliyunConfig.value.hasKey,
  },
])

const xunfeiFields = computed(() => [
  {
    key: 'appId' as const,
    label: 'APP ID',
    placeholder: '粘贴讯飞 APP ID',
    modelValue: xunfeiAsrConfig.value.appId,
    readonly: xunfeiAsrConfig.value.readonlyAppId,
    showValue: xunfeiAsrConfig.value.showAppId,
    hasValue: xunfeiAsrConfig.value.hasAppId,
  },
  {
    key: 'apiKey' as const,
    label: 'API Key',
    placeholder: '粘贴讯飞 API Key',
    modelValue: xunfeiAsrConfig.value.apiKey,
    readonly: xunfeiAsrConfig.value.readonlyApiKey,
    showValue: xunfeiAsrConfig.value.showApiKey,
    hasValue: xunfeiAsrConfig.value.hasApiKey,
  },
  {
    key: 'apiSecret' as const,
    label: 'API Secret',
    placeholder: '粘贴讯飞 API Secret',
    modelValue: xunfeiAsrConfig.value.apiSecret,
    readonly: xunfeiAsrConfig.value.readonlyApiSecret,
    showValue: xunfeiAsrConfig.value.showApiSecret,
    hasValue: xunfeiAsrConfig.value.hasApiSecret,
  },
])

const llmConfigRefs = {
  openai: openaiConfig,
  bigmodel: bigmodelConfig,
  anthropic: anthropicConfig,
  deepseek: deepseekConfig,
  aliyun: aliyunConfig,
} as const

const applyClipboardValue = async (onText: (text: string) => void) => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      onText(text.trim())
    }
  } catch {
    // 剪贴板读取失败时保持当前输入框内容
  }
}

onMounted(async () => {
  // 加载参数配置
  try {
    const cfgRes = await getLLMConfig()
    if (cfgRes.data?.providers) {
      const providers = cfgRes.data.providers
      for (const provider of llmProviderKeys) {
        applyProviderSecretConfig(llmConfigRefs[provider].value, providers[provider])
      }
    }
  } catch (error) {
    console.error('加载参数配置失败:', error)
  }

  try {
    const aiRes = await getAIConfig()
    applyXunfeiAsrSecretConfig(xunfeiAsrConfig.value, aiRes.data?.xunfeiAsr)
  } catch (error) {
    console.error('加载讯飞配置失败:', error)
  }
})

const toggleVisibility = (provider: LLMProviderKey) => {
  toggleProviderVisibility(llmConfigRefs[provider].value)
}

const updateProviderValue = (provider: LLMProviderKey, value: string) => {
  setProviderSecretValue(llmConfigRefs[provider].value, value)
}

const pasteApiKey = async (provider: LLMProviderKey) => {
  await applyClipboardValue((text) => {
    setProviderSecretValue(llmConfigRefs[provider].value, text)
  })
}

const enableEdit = (provider: LLMProviderKey) => {
  enableProviderEdit(llmConfigRefs[provider].value)
}

const toggleXunfeiVisibility = (field: XunfeiFieldKey) => {
  toggleXunfeiFieldVisibility(xunfeiAsrConfig.value, field)
}

const updateXunfeiField = (field: XunfeiFieldKey, value: string) => {
  setXunfeiFieldValue(xunfeiAsrConfig.value, field, value)
}

const pasteXunfeiField = async (field: XunfeiFieldKey) => {
  await applyClipboardValue((text) => {
    setXunfeiFieldValue(xunfeiAsrConfig.value, field, text)
  })
}

const enableXunfeiEdit = (field: XunfeiFieldKey) => {
  enableXunfeiFieldEdit(xunfeiAsrConfig.value, field)
}

const saveLLMConfig = async () => {
  if (!authStore.isSuperAdmin) {
    ElMessage.error('仅主管理员可修改 API Key')
    return
  }
  const llmPayload = buildLLMUpdatePayload({
    openai: openaiConfig.value,
    bigmodel: bigmodelConfig.value,
    anthropic: anthropicConfig.value,
    deepseek: deepseekConfig.value,
    aliyun: aliyunConfig.value,
  })
  const xunfeiPayload = buildXunfeiUpdatePayload(xunfeiAsrConfig.value)

  const hasLLMUpdate = Object.keys(llmPayload).length > 0
  const hasXunfeiUpdate = Object.keys(xunfeiPayload).length > 0

  try {
    if (hasLLMUpdate) {
      await updateLLMConfig(llmPayload)
    }
    if (hasXunfeiUpdate) {
      await updateAIConfig({ xunfeiAsr: xunfeiPayload })
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
