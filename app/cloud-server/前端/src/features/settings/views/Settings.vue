<template>
  <div class="page">
    <PageHeader
      title="系统设置"
      :icon="Tools"
    />

    <div class="content">
      <el-card shadow="hover">
        <el-form
          :model="formData"
          label-width="140px"
          label-position="left"
        >
          <el-form-item label="主题模式">
            <el-radio-group v-model="theme">
              <el-radio value="system">
                跟随系统
              </el-radio>
              <el-radio value="light">
                浅色
              </el-radio>
              <el-radio value="dark">
                深色
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="界面语言">
            <el-select
              v-model="language"
              placeholder="选择语言"
              style="width: 200px"
            >
              <el-option
                label="简体中文"
                value="zh-CN"
              />
              <el-option
                label="English"
                value="en-US"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="字体大小">
            <el-radio-group v-model="fontSize">
              <el-radio value="small">
                小
              </el-radio>
              <el-radio value="medium">
                中
              </el-radio>
              <el-radio value="large">
                大
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :icon="Select"
              @click="save"
            >
              保存
            </el-button>
            <el-button
              style="margin-left: 12px"
              @click="openFeedbackDialog"
            >
              反馈
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
      </el-card>
    </div>

    <el-dialog
      v-model="feedbackDialogVisible"
      title="提交反馈"
      width="520px"
      destroy-on-close
    >
      <el-input
        v-model="feedbackContent"
        type="textarea"
        :rows="6"
        maxlength="1000"
        show-word-limit
        placeholder="请输入反馈内容"
      />
      <template #footer>
        <el-button @click="feedbackDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="feedbackSubmitting"
          :disabled="!feedbackContent.trim()"
          @click="handleSubmitFeedback"
        >
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { submitFeedback } from '@/features/settings/api'
import PageHeader from '@/share/components/PageHeader.vue'
import { Select, Tools } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

defineOptions({
  name: 'SystemSettingsPage',
})

const formData = ref({})
const theme = ref<'system' | 'dark' | 'light'>('system')
const language = ref<'zh-CN' | 'en-US'>('zh-CN')
const fontSize = ref<'small' | 'medium' | 'large'>('medium')
const saved = ref(false)
const feedbackDialogVisible = ref(false)
const feedbackContent = ref('')
const feedbackSubmitting = ref(false)

onMounted(() => {
  theme.value = (localStorage.getItem('rc_theme') as any) || 'system'
  language.value = (localStorage.getItem('rc_language') as any) || 'zh-CN'
  fontSize.value = (localStorage.getItem('rc_fontSize') as any) || 'medium'
})

const save = () => {
  localStorage.setItem('rc_theme', theme.value)
  localStorage.setItem('rc_language', language.value)
  localStorage.setItem('rc_fontSize', fontSize.value)
  saved.value = true
  setTimeout(() => (saved.value = false), 1200)
}

const openFeedbackDialog = () => {
  feedbackContent.value = ''
  feedbackDialogVisible.value = true
}

const handleSubmitFeedback = async () => {
  const content = feedbackContent.value.trim()
  if (!content || feedbackSubmitting.value) {
    return
  }
  feedbackSubmitting.value = true
  try {
    await submitFeedback({ content })
    ElMessage.success('反馈提交成功')
    feedbackDialogVisible.value = false
    feedbackContent.value = ''
  } catch (error: any) {
    ElMessage.error(error?.message || '反馈提交失败')
  } finally {
    feedbackSubmitting.value = false
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
  max-width: 800px;
}

:deep(.el-card__body) {
  padding: 30px;
}
</style>
