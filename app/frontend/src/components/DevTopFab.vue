<template>
  <div
    class="dev-top-fab"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @pointerdown="onPointerDown"
    v-if="isDev"
  >
    <el-popover
      v-model="visible"
      :placement="popoverPlacement"
      :show-arrow="false"
      width="auto"
      popper-class="dev-fab-popper run-dropdown-popper"
    >
      <el-button-group class="fab-panel">
        <el-button size="small" class="panel-btn" @click="toggleTheme" text>
          <el-icon v-if="effectiveTheme === 'dark'"><Moon /></el-icon>
          <el-icon v-else><Sunny /></el-icon>
          切换主题
        </el-button>
      </el-button-group>
      <template #reference>
        <el-button type="primary" circle class="fab-btn">
          <el-icon><Plus /></el-icon>
        </el-button>
      </template>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useThemeStore } from '@/stores/theme'
const isDev = import.meta.env.DEV === true

const visible = ref(false)
const themeStore = useThemeStore()
const effectiveTheme = computed(() => themeStore.getEffectiveTheme())
const popoverPlacement = computed(() => {
  const h = window.innerHeight
  return pos.value.y > h / 2 ? 'top-start' : 'bottom-start'
})

const STORAGE_KEY = 'dev-top-fab-pos'
const btnSize = 44
const margin = 12
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

const loadPos = () => {
  const w = window.innerWidth
  const h = window.innerHeight
  const defaultPos = { x: w - btnSize - margin, y: h - btnSize - margin }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPos
    const parsed = JSON.parse(raw) as { x: number; y: number }
    const x = clamp(parsed.x, margin, w - btnSize - margin)
    const y = clamp(parsed.y, margin, h - btnSize - margin)
    return { x, y }
  } catch {
    return defaultPos
  }
}

const pos = ref<{ x: number; y: number }>(loadPos())
const dragging = ref(false)
let startX = 0
let startY = 0
let startPosX = 0
let startPosY = 0

const onPointerDown = (e: PointerEvent) => {
  dragging.value = true
  visible.value = false
  startX = e.clientX
  startY = e.clientY
  startPosX = pos.value.x
  startPosY = pos.value.y
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  const w = window.innerWidth
  const h = window.innerHeight
  pos.value = {
    x: clamp(startPosX + dx, margin, w - btnSize - margin),
    y: clamp(startPosY + dy, margin, h - btnSize - margin)
  }
}

const onPointerUp = () => {
  if (!dragging.value) return
  dragging.value = false
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos.value))
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

const onResize = () => {
  const w = window.innerWidth
  const h = window.innerHeight
  pos.value = {
    x: clamp(pos.value.x, margin, w - btnSize - margin),
    y: clamp(pos.value.y, margin, h - btnSize - margin)
  }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  pos.value = loadPos()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

const toggleTheme = () => {
  if (themeStore.followSystem) {
    themeStore.setFollowSystem(false)
  }
  themeStore.setTheme(effectiveTheme.value === 'dark' ? 'light' : 'dark')
  visible.value = false
}
</script>

<style scoped>
.dev-top-fab {
  position: fixed;
  transform: none;
  z-index: 2000;
  pointer-events: auto;
}

.fab-btn {
  width: 44px;
  height: 44px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.fab-panel {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 4px 6px;
  background: transparent;
}

:deep(.dev-fab-popper) {
  border-radius: 6px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
</style>
