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
import { ref, computed, watch } from 'vue'

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

// 基础动作
const basicActions: RobotAction[] = [
  {
    method: 'stand_up',
    name: '站立',
    description: '机器狗站起来',
    category: 'basic',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 10,
        step: 0.1,
        precision: 1,
        defaultValue: 4.5,
        description: '站立动作的持续时间（秒）'
      }
    ]
  },
  {
    method: 'lie_down',
    name: '趴下',
    description: '机器狗趴下',
    category: 'basic',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 10,
        step: 0.1,
        precision: 1,
        defaultValue: 2.5,
        description: '趴下动作的持续时间（秒）'
      }
    ]
  }
]

// 姿态控制动作
const attitudeActions: RobotAction[] = [
  {
    method: 'lean_left',
    name: '左倾',
    description: '机器狗向左倾斜',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '左倾持续时间（秒）'
      },
      {
        name: 'reset',
        label: '复位时间',
        type: 'number',
        min: 0,
        max: 5,
        defaultValue: 0,
        description: '复位到正常姿态的时间（0表示不复位）'
      }
    ]
  },
  {
    method: 'lean_right',
    name: '右倾',
    description: '机器狗向右倾斜',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '右倾持续时间（秒）'
      },
      {
        name: 'reset',
        label: '复位时间',
        type: 'number',
        min: 0,
        max: 5,
        defaultValue: 0,
        description: '复位到正常姿态的时间（0表示不复位）'
      }
    ]
  },
  {
    method: 'nod_up',
    name: '抬头',
    description: '机器狗抬头',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '抬头持续时间（秒）'
      },
      {
        name: 'reset',
        label: '复位时间',
        type: 'number',
        min: 0,
        max: 5,
        defaultValue: 0,
        description: '复位到正常姿态的时间（0表示不复位）'
      }
    ]
  },
  {
    method: 'nod_down',
    name: '低头',
    description: '机器狗低头',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '低头持续时间（秒）'
      },
      {
        name: 'reset',
        label: '复位时间',
        type: 'number',
        min: 0,
        max: 5,
        defaultValue: 0,
        description: '复位到正常姿态的时间（0表示不复位）'
      }
    ]
  },
  {
    method: 'rotate_clockwise',
    name: '顺时针探头',
    description: '机器狗头部顺时针旋转',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '探头持续时间（秒）'
      },
      {
        name: 'reset',
        label: '复位时间',
        type: 'number',
        min: 0,
        max: 5,
        defaultValue: 0,
        description: '复位到正常姿态的时间（0表示不复位）'
      }
    ]
  },
  {
    method: 'rotate_counterclockwise',
    name: '逆时针探头',
    description: '机器狗头部逆时针旋转',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '探头持续时间（秒）'
      },
      {
        name: 'reset',
        label: '复位时间',
        type: 'number',
        min: 0,
        max: 5,
        defaultValue: 0,
        description: '复位到正常姿态的时间（0表示不复位）'
      }
    ]
  },
  {
    method: 'max_height',
    name: '最大高度',
    description: '调节腿关节至最大高度',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '调节持续时间（秒）'
      },
      {
        name: '_height_vel',
        label: '高度速度',
        type: 'number',
        min: 0,
        max: 0.5,
        step: 0.05,
        precision: 2,
        defaultValue: 0.3,
        description: '垂直高度速度（m/s）'
      }
    ]
  },
  {
    method: 'min_height',
    name: '最小高度',
    description: '调节腿关节至最小高度',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '调节持续时间（秒）'
      },
      {
        name: '_height_vel',
        label: '高度速度',
        type: 'number',
        min: -0.5,
        max: 0,
        step: 0.05,
        precision: 2,
        defaultValue: -0.3,
        description: '垂直高度速度（m/s）'
      }
    ]
  },
  {
    method: 'attitude_rest',
    name: '复位姿态',
    description: '恢复到正常姿态',
    category: 'attitude',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 5,
        defaultValue: 0.5,
        description: '复位持续时间（秒）'
      }
    ]
  }
]

// 移动动作
const movementActions: RobotAction[] = [
  {
    method: 'move_by_distance',
    name: '按距离移动',
    description: '机器狗按指定距离移动',
    category: 'movement',
    params: [
      {
        name: 'axis',
        label: '移动方向',
        type: 'select',
        defaultValue: 'x',
        options: [
          { label: '前进', value: 'x' },
          { label: '后退', value: '-x' },
          { label: '右移', value: 'y' },
          { label: '左移', value: '-y' }
        ],
        description: '选择移动方向'
      },
      {
        name: 'distance',
        label: '移动距离',
        type: 'number',
        min: 0.1,
        max: 10,
        step: 0.1,
        precision: 1,
        defaultValue: 1.0,
        description: '移动距离（米）'
      },
      {
        name: 'speed',
        label: '移动速度',
        type: 'number',
        min: 0.05,
        max: 3.0,
        step: 0.05,
        precision: 2,
        defaultValue: 0.5,
        description: '移动速度（m/s）'
      }
    ]
  },
  {
    method: 'turn_around',
    name: '原地转身',
    description: '机器狗原地旋转',
    category: 'movement',
    params: [
      {
        name: 'angle',
        label: '转身角度',
        type: 'number',
        min: 1,
        max: 360,
        step: 1,
        precision: 0,
        defaultValue: 180,
        description: '转身角度（度）'
      },
      {
        name: 'speed',
        label: '偏航角速度',
        type: 'number',
        min: 2,
        max: 170,
        step: 1,
        precision: 0,
        defaultValue: 30,
        description: '偏航角速度（度/秒）'
      },
      {
        name: 'direction',
        label: '旋转方向',
        type: 'select',
        defaultValue: 'cw',
        options: [
          { label: '顺时针', value: 'cw' },
          { label: '逆时针', value: 'ccw' }
        ],
        description: '选择旋转方向'
      }
    ]
  }
]

// 特技动作
const trickActions: RobotAction[] = [
  {
    method: 'jump',
    name: '跳跃',
    description: '机器狗向上跳跃',
    category: 'tricks',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 10,
        defaultValue: 2.5,
        description: '跳跃动作的持续时间（秒）'
      }
    ]
  },
  {
    method: 'front_jump',
    name: '前跳',
    description: '机器狗向前跳跃',
    category: 'tricks',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 10,
        defaultValue: 2.5,
        description: '前跳动作的持续时间（秒）'
      }
    ]
  },
  {
    method: 'back_flip',
    name: '后空翻',
    description: '机器狗后空翻',
    category: 'tricks',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 10,
        defaultValue: 2.5,
        description: '后空翻动作的持续时间（秒）'
      }
    ]
  },
  {
    method: 'shake_hand',
    name: '握手',
    description: '机器狗握手',
    category: 'tricks',
    params: [
      {
        name: 'duration',
        label: '持续时间',
        type: 'number',
        min: 0.1,
        max: 20,
        defaultValue: 10,
        description: '握手动作的持续时间（秒）'
      }
    ]
  }
]

// 选择动作
const selectAction = (action: RobotAction) => {
  selectedAction.value = action
  // 初始化参数默认值
  actionParams.value = {}
  action.params.forEach(param => {
    actionParams.value[param.name] = param.defaultValue
  })
}

// 监听 visible 变化，初始化数据
watch(() => props.visible, (visible) => {
  if (visible) {
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
