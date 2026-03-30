import { ref, watch, type Ref } from 'vue'

type JoystickPayload = { x: number; y: number }
type EffectiveControlMode = 'move' | 'pose' | 'two_leg'

export function useRobotOperationJoystick(options: {
  isConnected: Ref<boolean>
  robotId: Ref<string>
  layoutEditMode: Ref<boolean>
  sendMessage: (message: {
    type: 'control_input'
    robotId: string
    timestamp: number
    data: {
      command: 'joystick'
      mode: EffectiveControlMode
      speed: number
      joystick: [number, number, number, number]
    }
  }) => void
}) {
  const controlMode = ref<'move' | 'pose'>('move')
  const speed = ref(5)
  const twoLegStandActive = ref(false)
  const rightJoystickDisabled = ref(false)
  const joystickAxes = ref<[number, number, number, number]>([0, 0, 0, 0])

  watch(twoLegStandActive, (value) => {
    rightJoystickDisabled.value = value
  })

  watch(controlMode, (value) => {
    joystickAxes.value = [0, 0, 0, 0]
    sendMergedJoystick(value === 'pose' ? 'pose' : 'move')
  })

  const sendMergedJoystick = (effectiveMode: EffectiveControlMode) => {
    if (options.layoutEditMode.value || !options.isConnected.value) {
      return
    }

    options.sendMessage({
      type: 'control_input',
      robotId: options.robotId.value,
      timestamp: Date.now(),
      data: {
        command: 'joystick',
        mode: effectiveMode,
        speed: speed.value,
        joystick: joystickAxes.value,
      },
    })
  }

  const onMoveJoystick = (payload: JoystickPayload) => {
    if (controlMode.value === 'pose' && !twoLegStandActive.value) {
      return
    }

    const effectiveMode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    joystickAxes.value[0] = payload.x
    joystickAxes.value[1] = payload.y

    if (effectiveMode === 'two_leg') {
      joystickAxes.value[2] = 0
      joystickAxes.value[3] = 0
    }

    sendMergedJoystick(effectiveMode)
  }

  const onLookJoystick = (payload: JoystickPayload) => {
    if (rightJoystickDisabled.value) {
      return
    }

    const effectiveMode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    if (effectiveMode === 'pose') {
      joystickAxes.value[2] = payload.x
      joystickAxes.value[3] = payload.y
    } else {
      joystickAxes.value[2] = payload.y
      joystickAxes.value[3] = 0
    }

    sendMergedJoystick(effectiveMode)
  }

  const onMoveJoystickEnd = () => {
    if (controlMode.value === 'pose' && !twoLegStandActive.value) {
      return
    }

    const effectiveMode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    if (effectiveMode === 'two_leg') {
      joystickAxes.value = [0, 0, 0, 0]
    } else {
      joystickAxes.value[0] = 0
      joystickAxes.value[1] = 0
    }

    sendMergedJoystick(effectiveMode)
  }

  const onLookJoystickEnd = () => {
    if (rightJoystickDisabled.value) {
      return
    }

    const effectiveMode = getEffectiveMode(controlMode.value, twoLegStandActive.value)
    joystickAxes.value[2] = 0
    joystickAxes.value[3] = 0
    sendMergedJoystick(effectiveMode)
  }

  return {
    controlMode,
    speed,
    twoLegStandActive,
    rightJoystickDisabled,
    onMoveJoystick,
    onLookJoystick,
    onMoveJoystickEnd,
    onLookJoystickEnd,
  }
}

function getEffectiveMode(controlMode: 'move' | 'pose', twoLegStandActive: boolean): EffectiveControlMode {
  if (twoLegStandActive) {
    return 'two_leg'
  }

  return controlMode === 'pose' ? 'pose' : 'move'
}
