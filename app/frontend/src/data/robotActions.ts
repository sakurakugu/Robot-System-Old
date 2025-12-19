
export interface ActionParam {
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

export interface RobotAction {
  method: string
  name: string
  description: string
  category: string
  params: ActionParam[]
}

// 基础动作
export const basicActions: RobotAction[] = [
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
export const attitudeActions: RobotAction[] = [
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
export const movementActions: RobotAction[] = [
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
export const trickActions: RobotAction[] = [
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
