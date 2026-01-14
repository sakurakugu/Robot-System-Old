<template>
  <div class="layout">
    <header class="header">
      <h1>机器狗管理控制台</h1>
  </header>
    <div class="content">
      <nav class="rail" :style="{ width: railWidth + 'px' }" :class="{ narrow: isNarrow }">
        <router-link to="/robots" class="link" active-class="active">
          <el-icon class="icon"><List /></el-icon>
          <span class="label">机器人管理</span>
          <span class="pill">管理</span>
        </router-link>
        <router-link to="/chat" class="link" active-class="active">
          <el-icon class="icon"><ChatLineSquare /></el-icon>
          <span class="label">机器人对话</span>
          <span class="pill">对话</span>
        </router-link>
        <router-link to="/params" class="link" active-class="active">
          <el-icon class="icon"><Setting /></el-icon>
          <span class="label">参数管理</span>
          <span class="pill">参数</span>
        </router-link>
        <router-link to="/kb" class="link" active-class="active">
          <el-icon class="icon"><Collection /></el-icon>
          <span class="label">知识库</span>
          <span class="pill">知识</span>
        </router-link>
        <router-link to="/settings" class="link" active-class="active">
          <el-icon class="icon"><Setting /></el-icon>
          <span class="label">设置</span>
          <span class="pill">设置</span>
        </router-link>
      </nav>
      <div class="rail-resizer" @mousedown="startResize"></div>
      <main class="main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChatLineSquare, Setting, Collection, List } from '@element-plus/icons-vue'

const railWidth = ref(200)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(200)
const minWidth = 115
const maxWidth = 360
const isNarrow = computed(() => railWidth.value <= 150) // 当宽度小于等于最小宽度时，认为是窄屏

function onMouseMove(e: MouseEvent) {
  if (!isResizing.value) return
  const delta = e.clientX - startX.value
  const next = Math.min(maxWidth, Math.max(minWidth, startWidth.value + delta))
  railWidth.value = next
}

function onMouseUp() {
  if (!isResizing.value) return
  isResizing.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function startResize(e: MouseEvent) {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = railWidth.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: radial-gradient(1200px 600px at 20% -10%, #2a2a2a 0%, #1a1a1a 60%, #121212 100%);
  color: #e0e0e0;
}
.header {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(180deg, rgba(40,40,40,0.9) 0%, rgba(32,32,32,0.9) 100%);
  border-bottom: 1px solid #3a3a3a;
  backdrop-filter: saturate(140%) blur(6px);
}
.header h1 { font-size: 1.25rem; font-weight: 600; }
.content { display: flex; flex: 1; overflow: hidden; }
.rail {
  width: 200px;
  background: rgba(30, 30, 30, 0.7);
  border-right: 1px solid #3a3a3a;
  padding: 0.75rem 0.75rem 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  backdrop-filter: blur(8px);
}
.link {
  width: 100%;
  padding: 0.6rem 0.6rem;
  color: #e0e0e0;
  border: 1px solid transparent;
  border-radius: 10px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background-color 0.2s, border-color 0.2s, transform 0.08s;
}
.link:hover { background-color: #262626; border-color: #3a3a3a; transform: translateY(-1px); }
.link.active { background-color: #2f315a; border-color: #646cff; color: #ffffff; }
.icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9bbcff;
}
.label { flex: 1; font-size: 14px; }
.pill {
  font-size: 12px;
  color: #9bbcff;
  border: 1px solid rgba(100,108,255,0.25);
  background: rgba(100,108,255,0.12);
  padding: 2px 6px;
  border-radius: 999px;
}
.rail .pill { display: none; }
.rail.narrow .label { display: none; }
.rail.narrow .pill { display: inline-block; margin: 0 auto; }
.rail.narrow .link { justify-content: center; }
.main { flex: 1; overflow: auto; }
.rail-resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
}
.rail-resizer:hover { background: rgba(100, 108, 255, 0.12); }
@media (prefers-color-scheme: light) {
  .layout { background: radial-gradient(1200px 600px at 20% -10%, #ffffff 0%, #f7f7fb 60%, #f2f3f7 100%); color: #333; }
  .header { background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(248,248,252,0.85) 100%); border-color: #e0e0e0; }
  .rail { background: rgba(250,250,250,0.8); border-color: #e0e0e0; }
  .link { color: #333; border-color: #ddd; }
  .link:hover { background-color: #f0f0ff; border-color: #646cff; }
  .link.active { background-color: #e9eaff; }
}
</style>
