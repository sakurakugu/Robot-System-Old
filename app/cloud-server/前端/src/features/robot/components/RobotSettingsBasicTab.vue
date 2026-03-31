<template>
  <div class="pane-content">
    <h3 class="section-title">
      基本信息
    </h3>
    <el-form
      :model="props.formData"
      label-width="100px"
    >
      <el-form-item label="名称">
        <el-input
          v-model="nameModel"
          maxlength="16"
          show-word-limit
          placeholder="请输入机器人名称"
          @change="emit('auto-save', 'name')"
        />
      </el-form-item>
      <el-form-item label="类型">
        <el-input
          :model-value="props.formData.model"
          disabled
        />
      </el-form-item>
      <el-form-item label="角色">
        <el-select
          v-model="roleIdModel"
          placeholder="选择角色"
          clearable
          @change="emit('auto-save', 'role_id')"
        >
          <el-option
            v-for="role in props.roles"
            :key="role.uuid"
            :label="role.name"
            :value="role.uuid"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="分组">
        <el-select
          v-model="groupNameModel"
          placeholder="选择分组"
          allow-create
          filterable
          default-first-option
          @change="emit('auto-save', 'group_name')"
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
      <el-form-item label="标签">
        <div class="tags-container">
          <el-tag
            v-for="tag in props.tags"
            :key="tag"
            closable
            :disable-transitions="false"
            @close="emit('remove-tag', tag)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="inputVisible"
            ref="inputRef"
            v-model="inputValue"
            class="input-new-tag"
            size="small"
            @keyup.enter="handleInputConfirm"
            @blur="handleInputConfirm"
          />
          <el-button
            v-else
            class="button-new-tag"
            size="small"
            @click="showInput"
          >
            + New Tag
          </el-button>
        </div>
      </el-form-item>
      <el-divider />
      <h4 class="subsection-title">
        系统音量
      </h4>
      <el-form-item label="音量">
        <div class="volume-control">
          <el-slider
            v-model="volumeModel"
            :min="0"
            :max="100"
            :disabled="props.volumeData.loading || !props.status.connected"
            style="flex: 1; margin-right: 12px;"
            @change="handleVolumeChange"
          />
          <el-input-number
            v-model="volumeModel"
            :min="0"
            :max="100"
            :disabled="props.volumeData.loading || !props.status.connected"
            style="width: 100px; margin-right: 8px;"
            @change="handleVolumeChange"
          />
          <el-button
            :icon="props.volumeData.muted ? 'VideoPause' : 'VideoPlay'"
            :disabled="props.volumeData.loading || !props.status.connected"
            :type="props.volumeData.muted ? 'danger' : 'default'"
            @click="emit('toggle-mute')"
          >
            {{ props.volumeData.muted ? '静音' : '取消静音' }}
          </el-button>
          <el-button
            :loading="props.volumeData.loading"
            :disabled="!props.status.connected"
            icon="Refresh"
            circle
            @click="emit('reload-volume')"
          />
        </div>
        <el-text
          v-if="!props.status.connected"
          type="info"
          size="small"
        >
          机器人未连接，无法控制音量
        </el-text>
      </el-form-item>
      <el-divider />
      <el-form-item label="SN">
        <el-input
          :model-value="props.formData.sn"
          disabled
        />
      </el-form-item>
      <el-form-item label="UUID">
        <el-input
          :model-value="props.formData.uuid"
          disabled
        />
      </el-form-item>
      <el-divider />
      <div class="status-grid">
        <div class="status-item">
          <span class="label">温度</span>
          <span class="value">{{ props.status.temperature }}°C</span>
        </div>
        <div class="status-item">
          <span class="label">电量</span>
          <span class="value">{{ props.status.battery !== undefined ? props.status.battery + '%' : '--' }}</span>
        </div>
        <div class="status-item">
          <span class="label">连接状态</span>
          <el-tag :type="props.status.connected ? 'success' : 'danger'">
            {{ props.status.connected ? '在线' : '离线' }}
          </el-tag>
        </div>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import { computed, nextTick, ref } from 'vue'
import type { Role } from '../../role/types'
import type { RobotSettingsField, RobotSettingsFormData } from '../settings'

const props = defineProps<{
  formData: RobotSettingsFormData
  roles: Role[]
  tags: string[]
  status: {
    temperature: number
    battery: number | undefined
    connected: boolean
  }
  volumeData: {
    volume: number
    muted: boolean
    loading: boolean
  }
}>()

const emit = defineEmits<{
  'auto-save': [field: RobotSettingsField]
  'update-field': [field: keyof RobotSettingsFormData, value: RobotSettingsFormData[keyof RobotSettingsFormData]]
  'remove-tag': [tag: string]
  'add-tag': [tag: string]
  'update-volume': [value: number]
  'change-volume': [value?: number]
  'toggle-mute': []
  'reload-volume': []
}>()

const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref<InputInstance>()

const nameModel = computed({
  get: () => props.formData.name,
  set: (value: string) => emit('update-field', 'name', value),
})

const roleIdModel = computed({
  get: () => props.formData.role_id,
  set: (value: string | undefined) => emit('update-field', 'role_id', value ?? ''),
})

const groupNameModel = computed({
  get: () => props.formData.group_name,
  set: (value: string) => emit('update-field', 'group_name', value),
})

const volumeModel = computed({
  get: () => props.volumeData.volume,
  set: (value: number | undefined) => emit('update-volume', typeof value === 'number' ? value : 0),
})

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    inputRef.value?.input?.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value) {
    emit('add-tag', inputValue.value)
  }
  inputVisible.value = false
  inputValue.value = ''
}

const handleVolumeChange = (value?: number | [number, number]) => {
  if (typeof value === 'number') {
    emit('change-volume', value)
    return
  }
  emit('change-volume', props.volumeData.volume)
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

.subsection-title {
  margin-top: 15px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.volume-control {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.input-new-tag {
  width: 90px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-top: 10px;
}

.status-item {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.status-item .label {
  font-size: 12px;
  color: #909399;
}

.status-item .value {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}
</style>
