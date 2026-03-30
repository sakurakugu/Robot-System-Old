<template>
  <div class="robot-add">
    <PageHeader
      title="新增机器人"
      :icon="Bot"
      @back="goBack"
    />

    <el-card class="section-card">
      <template #header>
        <el-text
          type="info"
          size="small"
        >
          输入机器人信息
        </el-text>
      </template>

      <el-form
        :model="formData"
        label-width="100px"
      >
        <el-form-item
          label="名称"
          required
        >
          <el-input
            v-model="formData.name"
            placeholder="例如：机器狗1"
          />
        </el-form-item>
        <el-form-item label="机器人IP">
          <el-input
            v-model="formData.robot_ip"
            placeholder="例如：192.168.1.110"
          />
          <el-text
            v-if="formData.robot_ip && !isValidIP(formData.robot_ip)"
            type="danger"
            size="small"
          >
            IP格式不正确
          </el-text>
        </el-form-item>
        <el-form-item label="分组">
          <el-select
            v-model="formData.group_name"
            placeholder="选择分组"
            allow-create
            filterable
            default-first-option
          >
            <el-option
              label="默认分组"
              value="Default"
            />
            <el-option
              label="开发测试"
              value="Dev"
            />
            <el-option
              label="演示展厅"
              value="Demo"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="goBack">
            取消
          </el-button>
          <el-button
            type="primary"
            :disabled="!isFormValid"
            :loading="adding"
            @click="saveRobot"
          >
            添加
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { isValidIP } from '@/utils/validator'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createRobot } from '../api'

type FormData = {
  name: string
  robot_ip: string
  group_name: string
}

const router = useRouter()
const adding = ref(false)

const formData = ref<FormData>({
  name: '',
  robot_ip: '',
  group_name: ''
})

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

const isFormValid = computed(() => {
  return Boolean(
    formData.value.name &&
    (!formData.value.robot_ip || isValidIP(formData.value.robot_ip))
  )
})

function goBack() {
  router.push('/robots')
}

function notifyRobotsUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('robots_updated'))
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '通知失败'))
  }
}

async function saveRobot() {
  const payload = {
    name: formData.value.name,
    robot_ip: formData.value.robot_ip,
    group_name: formData.value.group_name || ''
  }
  try {
    await createRobot(payload)
    notifyRobotsUpdated()
    ElMessage.success('添加成功')
    goBack()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存失败'))
  }
}
</script>

<style scoped>
.robot-add {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  border-radius: 12px;
}
</style>
