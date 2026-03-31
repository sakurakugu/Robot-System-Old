import { getUIConfig, updateUIConfig } from '@/features/settings/api';
import { ElMessage } from 'element-plus';
import { onBeforeUnmount, ref, type Ref } from 'vue';

export type ControlLayout = Record<string, { x: number; y: number }>

export const defaultRobotOperationControlLayout: ControlLayout = {
  chatToggle: { x: 92, y: 12 },
  voiceRecord: { x: 92, y: 24 },
  leftJoystick: { x: 15, y: 80 },
  rightJoystick: { x: 85, y: 80 },
  action_stand_up: { x: 34, y: 78 },
  action_sit_down: { x: 44, y: 78 },
  action_front_jump: { x: 54, y: 78 },
  action_jump: { x: 64, y: 78 },
  action_back_flip: { x: 36, y: 88 },
  action_two_leg_stand: { x: 50, y: 88 },
  action_shake_hand: { x: 64, y: 88 },
}

export function useRobotOperationLayout(
  defaultLayout: ControlLayout = defaultRobotOperationControlLayout,
  floatingLayerRef: Ref<HTMLDivElement | null> = ref<HTMLDivElement | null>(null),
) {
  const layoutEditMode = ref(false)
  const controlLayout = ref<ControlLayout>(cloneLayout(defaultLayout))
  const originalLayoutSnapshot = ref<ControlLayout>(cloneLayout(defaultLayout))

  let stopDraggingListeners: (() => void) | null = null

  const stopDragging = () => {
    stopDraggingListeners?.()
  }

  const getControlStyle = (id: string) => {
    const pos = controlLayout.value[id] || defaultLayout[id]
    const x = pos?.x ?? 50
    const y = pos?.y ?? 50
    return {
      left: `${x}%`,
      top: `${y}%`,
    }
  }

  const startDrag = (id: string, event: PointerEvent) => {
    if (!layoutEditMode.value) {
      return
    }

    const layer = floatingLayerRef.value
    if (!layer) {
      return
    }

    event.preventDefault()
    stopDragging()

    const rect = layer.getBoundingClientRect()

    const updatePosition = (nextEvent: PointerEvent) => {
      const x = clampPercent(((nextEvent.clientX - rect.left) / rect.width) * 100)
      const y = clampPercent(((nextEvent.clientY - rect.top) / rect.height) * 100)
      controlLayout.value = {
        ...controlLayout.value,
        [id]: { x, y },
      }
    }

    const onMove = (nextEvent: PointerEvent) => updatePosition(nextEvent)
    const onUp = () => stopDragging()

    stopDraggingListeners = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      stopDraggingListeners = null
    }

    updatePosition(event)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startLayoutEdit = () => {
    layoutEditMode.value = true
    originalLayoutSnapshot.value = cloneLayout(controlLayout.value)
  }

  const cancelLayoutEdit = () => {
    stopDragging()
    controlLayout.value = cloneLayout(originalLayoutSnapshot.value)
    layoutEditMode.value = false
  }

  const saveLayout = async () => {
    stopDragging()

    try {
      await updateUIConfig({ controlLayout: controlLayout.value })
      originalLayoutSnapshot.value = cloneLayout(controlLayout.value)
      layoutEditMode.value = false
      ElMessage.success('布局已保存')
    } catch (error) {
      ElMessage.error('布局保存失败')
      throw error
    }
  }

  const loadLayout = async () => {
    try {
      const response = await getUIConfig()
      const layout = response.data?.controlLayout
      if (layout && typeof layout === 'object') {
        const nextLayout = normalizeLayout(layout, defaultLayout)
        controlLayout.value = nextLayout
        originalLayoutSnapshot.value = cloneLayout(nextLayout)
      }
    } catch (error) {
      console.error('加载布局失败', error)
    }
  }

  const setLayoutEditMode = (value: boolean) => {
    if (value) {
      startLayoutEdit()
    } else {
      cancelLayoutEdit()
    }
  }

  onBeforeUnmount(() => {
    stopDragging()
  })

  return {
    layoutEditMode,
    floatingLayerRef,
    controlLayout,
    getControlStyle,
    startDrag,
    startLayoutEdit,
    cancelLayoutEdit,
    saveLayout,
    loadLayout,
    setLayoutEditMode,
  }
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function cloneLayout(layout: ControlLayout): ControlLayout {
  return Object.fromEntries(
    Object.entries(layout).map(([key, value]) => [key, { x: value.x, y: value.y }]),
  )
}

function normalizeLayout(source: Record<string, { x?: number; y?: number }>, fallback: ControlLayout): ControlLayout {
  const nextLayout = cloneLayout(fallback)

  for (const key of Object.keys(source)) {
    const item = source[key]
    const x = Number(item?.x)
    const y = Number(item?.y)
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      nextLayout[key] = {
        x: clampPercent(x),
        y: clampPercent(y),
      }
    }
  }

  return nextLayout
}
