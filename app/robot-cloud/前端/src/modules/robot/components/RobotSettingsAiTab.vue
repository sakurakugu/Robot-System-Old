<template>
  <div class="pane-content">
    <h3 class="section-title">
      AI 配置
    </h3>
    <el-form
      :model="props.formData"
      label-position="top"
    >
      <el-form-item label="回复温度">
        <el-slider
          v-model="aiTemperature"
          :min="0"
          :max="2"
          :step="0.1"
          show-input
          :input-size="'small'"
          @change="emit('auto-save', 'ai_temperature')"
        />
      </el-form-item>
      <el-form-item label="使用模型">
        <el-select
          v-model="aiModel"
          placeholder="请选择模型"
          style="width: 100%"
          @change="emit('auto-save', 'ai_model')"
        >
          <el-option
            v-for="model in availableModels"
            :key="model.value"
            :label="model.label"
            :value="model.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="音色">
        <el-select
          v-model="aiVoice"
          placeholder="请选择音色"
          style="width: 100%"
          @change="emit('auto-save', 'ai_voice')"
        >
          <el-option
            label="女声-温柔"
            value="female-soft"
          />
          <el-option
            label="女声-活泼"
            value="female-bright"
          />
          <el-option
            label="男声-低沉"
            value="male-deep"
          />
          <el-option
            label="男声-洪亮"
            value="male-bright"
          />
          <el-option
            label="童声"
            value="child"
          />
          <el-option
            label="电子音"
            value="robotic"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="意图识别">
        <el-select
          v-model="aiIntent"
          placeholder="请选择方案"
          style="width: 100%"
          @change="emit('auto-save', 'ai_intent')"
        >
          <el-option
            label="规则引擎"
            value="rule-based"
          />
          <el-option
            label="LLM分类器"
            value="llm-classifier"
          />
          <el-option
            label="混合策略"
            value="hybrid"
          />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">
        系统提示词
      </el-divider>

      <el-form-item label="角色名称">
        <el-input
          v-model="aiRoleName"
          placeholder="例如：导航助手"
          @change="emit('auto-save', 'ai_role_name')"
        />
      </el-form-item>
      <el-form-item label="系统提示词">
        <el-input
          v-model="aiSystemPrompt"
          type="textarea"
          :rows="6"
          placeholder="例如：保持安全、简洁、友好"
          @change="emit('auto-save', 'ai_system_prompt')"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          @click="saveAIConfig"
        >
          保存配置
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { updateRobot as updateRobotDetail } from '../api'
import { getRobotErrorMessage } from '../settings'
import type { RobotSettingsField, RobotSettingsFormData } from '../settings'

const props = defineProps<{
  formData: RobotSettingsFormData
  robotUuid?: string
}>()

const emit = defineEmits<{
  'auto-save': [field: RobotSettingsField]
  'update-field': [field: keyof RobotSettingsFormData, value: RobotSettingsFormData[keyof RobotSettingsFormData]]
}>()

const availableModels = [
  { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
]
const aiTemperature = computed({
  get: () => props.formData.ai_temperature,
  set: (value: number) => emit('update-field', 'ai_temperature', value),
})
const aiModel = computed({
  get: () => props.formData.ai_model,
  set: (value: string) => emit('update-field', 'ai_model', value),
})
const aiVoice = computed({
  get: () => props.formData.ai_voice,
  set: (value: string) => emit('update-field', 'ai_voice', value),
})
const aiIntent = computed({
  get: () => props.formData.ai_intent,
  set: (value: string) => emit('update-field', 'ai_intent', value),
})
const aiRoleName = computed({
  get: () => props.formData.ai_role_name,
  set: (value: string) => emit('update-field', 'ai_role_name', value),
})
const aiSystemPrompt = computed({
  get: () => props.formData.ai_system_prompt,
  set: (value: string) => emit('update-field', 'ai_system_prompt', value),
})

const saveAIConfig = async () => {
  if (!props.robotUuid) {
    ElMessage.warning('请先选择机器人')
    return
  }

  try {
    await updateRobotDetail(props.robotUuid, {
      ai_temperature: props.formData.ai_temperature,
      ai_model: props.formData.ai_model,
      ai_voice: props.formData.ai_voice,
      ai_intent: props.formData.ai_intent,
      ai_role_name: props.formData.ai_role_name,
      ai_system_prompt: props.formData.ai_system_prompt,
    })
    ElMessage.success('AI配置已保存')
  } catch (error) {
    ElMessage.error(getRobotErrorMessage(error, 'AI配置保存失败'))
  }
}
</script>

<style scoped>
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
</style>
