<template>
  <el-dialog
    v-model="dialogVisible"
    title="选择机器狗动作"
    width="700px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="action-selector">
      <!-- 动作分类 -->
      <div class="action-categories">
        <el-tabs v-model="activeCategory" type="border-card">
          <el-tab-pane label="基础动作" name="basic">
            <div class="actions-grid">
              <div
                v-for="action in basicActions"
                :key="action.method"
                class="action-card"
                :class="{ selected: selectedAction?.method === action.method }"
                @click="selectAction(action)"
              >
                <div class="action-icon">🐕</div>
                <div class="action-info">
                  <div class="action-name">{{ action.name }}</div>
                  <div class="action-desc">{{ action.description }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
 
          <el-tab-pane label="姿态控制" name="attitude">
            <div class="actions-grid">
              <div
                v-for="action in attitudeActions"
                :key="action.method"
                class="action-card"
                :class="{ selected: selectedAction?.method === action.method }"
                @click="selectAction(action)"
              >
                <div class="action-icon">🎯</div>
                <div class="action-info">
                  <div class="action-name">{{ action.name }}</div>
                  <div class="action-desc">{{ action.description }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
 
          <el-tab-pane label="移动" name="movement">
            <div class="actions-grid">
              <div
                v-for="action in movementActions"
                :key="action.method"
                class="action-card"
                :class="{ selected: selectedAction?.method === action.method }"
                @click="selectAction(action)"
              >
                <div class="action-icon">🏃</div>
                <div class="action-info">
                  <div class="action-name">{{ action.name }}</div>
                  <div class="action-desc">{{ action.description }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
 
          <el-tab-pane label="特技" name="tricks">
            <div class="actions-grid">
              <div
                v-for="action in trickActions"
                :key="action.method"
                class="action-card"
                :class="{ selected: selectedAction?.method === action.method }"
                @click="selectAction(action)"
              >
                <div class="action-icon">⭐</div>
                <div class="action-info">
                  <div class="action-name">{{ action.name }}</div>
                  <div class="action-desc">{{ action.description }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
 
          <el-tab-pane label="自定义动作" name="custom">
            <div class="actions-grid">
              <div
                v-for="action in customActions"
                :key="action.uuid"
                class="action-card"
                :class="{ selected: selectedAction?.method === action.uuid }"
                @click="selectCustom(action)"
              >
                <div class="action-icon">🧩</div>
                <div class="action-info">
                  <div class="action-name">{{ action.name }}</div>
                  <div class="action-desc">{{ action.description || '无描述' }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 参数配置 -->
      <div v-if="selectedAction" class="action-params">
        <el-divider>动作参数</el-divider>
        <el-form :model="actionParams" label-width="120px" size="small">
          <!-- 动态渲染参数表单 -->
          <el-form-item
            v-for="param in selectedAction.params"
            :key="param.name"
            :label="param.label"
          >
            <!-- 数字输入 -->
            <el-input-number
              v-if="param.type === 'number'"
              v-model="actionParams[param.name]"
              :min="param.min"
              :max="param.name === 'duration' && maxDuration !== undefined ? Math.min(param.max || Infinity, maxDuration) : param.max"
              :step="param.step || 0.1"
              :precision="param.precision || 2"
              controls-position="right"
              style="width: 100%"
            />
            <!-- 选择框 -->
            <el-select
              v-else-if="param.type === 'select'"
              v-model="actionParams[param.name]"
              style="width: 100%"
            >
              <el-option
                v-for="option in param.options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <!-- 文本输入 -->
            <el-input
              v-else
              v-model="actionParams[param.name]"
            />
            <div v-if="param.description" class="param-hint">
              {{ param.description }}
            </div>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!selectedAction">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { projectApi } from '@/api/project'
import {
  basicActions,
  attitudeActions,
  movementActions,
  trickActions
} from '@/data/robotActions'

// 动作定义接口
interface ActionParam {
  name: string
  label: string
  type: 'number' | 'select' | 'text'
  min?: number
  max?: number
  step?: number
  precision?: number
  defaultValue: any
  options?: Array<{ label: string; value: any }>
  description?: string
}

interface RobotAction {
  method: string
  name: string
  description: string
  category: string
  params: ActionParam[]
}

// Props
const props = defineProps<{
  visible: boolean
  currentAction?: {
    actionType: string
    actionParams: Record<string, any>
  }
  maxDuration?: number
}>()

// Emits
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': [action: { actionType: string; actionName: string; actionParams: Record<string, any> }]
}>()

// 对话框显示状态
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 当前选择的分类
const activeCategory = ref('basic')

// 选中的动作
const selectedAction = ref<RobotAction | null>(null)

// 动作参数
const actionParams = ref<Record<string, any>>({})

// 获取最大 duration 限制
const maxDuration = computed(() => props.maxDuration)

// 自定义动作
const customActions = ref<any[]>([])
const route = useRoute()

const loadCustomActions = async () => {
  const projectUuid = route.params.uuid as string
  if (!projectUuid) return
  try {
    const res = await projectApi.getCustomActions(projectUuid)
    if (res.success) {
      customActions.value = res.data || []
    } else {
      customActions.value = []
    }
  } catch {
    customActions.value = []
  }
}

// 选择动作
const selectAction = (action: RobotAction) => {
  selectedAction.value = action
  // 初始化参数默认值
  actionParams.value = {}
  action.params.forEach(param => {
    actionParams.value[param.name] = param.defaultValue
  })
}

// 选择自定义动作：以只读方式设置名称，不设置方法；参数留空
const selectCustom = (action: any) => {
  selectedAction.value = {
    method: action.uuid,
    name: action.name,
    description: action.description || '',
    category: 'custom',
    params: []
  }
  actionParams.value = {}
}

// 监听 visible 变化，初始化数据
watch(() => props.visible, (visible) => {
  if (visible) {
    loadCustomActions()
    // 如果传入了当前动作，则初始化选择
    if (props.currentAction) {
      const allActions = [
        ...basicActions,
        ...attitudeActions,
        ...movementActions,
        ...trickActions
      ]
      const action = allActions.find(a => a.method === props.currentAction?.actionType)
      if (action) {
        selectedAction.value = action
        actionParams.value = { ...props.currentAction.actionParams }
        // 设置正确的分类
        activeCategory.value = action.category
      }
    }
  } else {
    // 关闭时重置
    selectedAction.value = null
    actionParams.value = {}
    activeCategory.value = 'basic'
  }
})

onMounted(() => {
  // 预取一次自定义动作，避免首次打开时空白
  loadCustomActions()
})

// 关闭对话框
const handleClose = () => {
  emit('update:visible', false)
}

// 确认选择
const handleConfirm = () => {
  if (selectedAction.value) {
    emit('confirm', {
      actionType: selectedAction.value.method,
      actionName: selectedAction.value.name,
      actionParams: { ...actionParams.value }
    })
    emit('update:visible', false)
  }
}
</script>

<style scoped>
.action-selector {
  min-height: 400px;
}

.action-categories {
  margin-bottom: 20px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 12px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}

.action-card:hover {
  border-color: #409eff;
  background: #f0f7ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.action-card.selected {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.action-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.action-info {
  text-align: center;
  width: 100%;
}

.action-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 12px;
  color: #909399;
}

.action-params {
  margin-top: 20px;
}

.param-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

:deep(.el-tabs--border-card) {
  border: 1px solid #e4e7ed;
  box-shadow: none;
}

:deep(.el-tabs__content) {
  padding: 0;
}
</style>
