<template>
  <div
    v-if="isDev"
    ref="rootEl"
    class="dev-top-fab"
    :style="{ left: `${posPx.x}px`, top: `${posPx.y}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <el-popover
      v-model="visible"
      :placement="popoverPlacement"
      :show-arrow="false"
      width="auto"
      popper-class="dev-fab-popper"
    >
      <div class="fab-container">
        <div class="fab-title">
          开发者工具
        </div>
        <el-button-group class="fab-panel">
          <el-button
            size="small"
            class="panel-btn"
            text
            @click="toggleTheme"
          >
            <el-icon v-if="effectiveTheme === 'dark'">
              <Moon />
            </el-icon>
            <el-icon v-else>
              <Sunny />
            </el-icon>
            切换主题
          </el-button>
        </el-button-group>
      </div>
      <template #reference>
        <el-button
          type="primary"
          circle
          class="fab-btn"
          aria-label="开发者工具"
          title="开发者工具"
        >
          <el-icon><Tools /></el-icon>
        </el-button>
      </template>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { Moon, Sunny, Tools } from '@element-plus/icons-vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'

const isDev = import.meta.env.DEV === true

const visible = ref(false)
const themeStore = useThemeStore()
const effectiveTheme = computed(() => themeStore.getEffectiveTheme())
const popoverPlacement = computed(() => {
  const h = typeof window !== 'undefined' ? window.innerHeight : 0
  return posPx.value.y > h / 2 ? 'top-start' : 'bottom-start'
})

const STORAGE_KEY = 'dev-top-fab-pos'
const btnSize = 44
const margin = 12
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

const rootEl = ref<HTMLElement | null>(null)

const getPxFromPct = (p: { x: number; y: number }) => {
  const w = window.innerWidth
  const h = window.innerHeight
  const rx = Math.max(1, w - btnSize - 2 * margin)
  const ry = Math.max(1, h - btnSize - 2 * margin)
  return { x: Math.round(margin + p.x * rx), y: Math.round(margin + p.y * ry) }
}

const getPctFromPx = (p: { x: number; y: number }) => {
  const w = window.innerWidth
  const h = window.innerHeight
  const rx = Math.max(1, w - btnSize - 2 * margin)
  const ry = Math.max(1, h - btnSize - 2 * margin)
  return { x: clamp01((p.x - margin) / rx), y: clamp01((p.y - margin) / ry) }
}

const loadPosPct = () => {
  const defaultPct = { x: 1, y: 1 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPct
    const parsed = JSON.parse(raw) as { unit?: string; x?: number; y?: number }
    if (parsed && parsed.unit === 'pct-1' && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: clamp01(parsed.x), y: clamp01(parsed.y) }
    }
    if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return getPctFromPx({ x: parsed.x, y: parsed.y })
    }
    return defaultPct
  } catch {
    return defaultPct
  }
}

const pos = ref<{ x: number; y: number }>(loadPosPct())
const posPx = computed(() => getPxFromPct(pos.value))
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
  startPosX = posPx.value.x
  startPosY = posPx.value.y
  rootEl.value?.setPointerCapture(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  const w = window.innerWidth
  const h = window.innerHeight
  const xPx = clamp(startPosX + dx, margin, w - btnSize - margin)
  const yPx = clamp(startPosY + dy, margin, h - btnSize - margin)
  pos.value = getPctFromPx({ x: xPx, y: yPx })
}

const onPointerUp = (e: PointerEvent) => {
  if (!dragging.value) return
  dragging.value = false
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: pos.value.x, y: pos.value.y, unit: 'pct-1' }))
  if (rootEl.value) {
    try {
      rootEl.value.releasePointerCapture(e.pointerId)
    } catch {
      // 指针捕获可能已释放，忽略即可
    }
  }
}

const onPointerCancel = (e: PointerEvent) => {
  if (!dragging.value) return
  dragging.value = false
  if (rootEl.value) {
    try {
      rootEl.value.releasePointerCapture(e.pointerId)
    } catch {
      // 指针捕获可能已释放，忽略即可
    }
  }
}

const onResize = () => {
  pos.value = { x: clamp01(pos.value.x), y: clamp01(pos.value.y) }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  pos.value = loadPosPct()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
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
  touch-action: none;
  user-select: none;
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
  padding: 0;
  background: transparent;
}

:deep(.dev-fab-popper) {
  border-radius: 6px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.fab-container {
  padding: 2px 4px;
}

.fab-title {
  padding-bottom: 8px;
  font-size: 12px;
  line-height: 16px;
  color: var(--el-text-color-regular);
  margin-bottom: 2px;
  user-select: none;
}
</style>
