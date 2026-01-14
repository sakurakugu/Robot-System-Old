<template>
  <div class="page">
    <div class="header">
      <h2>设置</h2>
    </div>
    <div class="content">
      <div class="card">
        <div class="row">
          <label class="label">后端地址</label>
          <input v-model="serverUrl" placeholder="http://localhost:3000" />
        </div>
        <div class="row">
          <label class="label">WebSocket路径</label>
          <input v-model="wsPath" placeholder="/api/conversation/connect" />
        </div>
        <div class="row">
          <label class="label">主题</label>
          <select v-model="theme">
            <option value="system">跟随系统</option>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </div>
        <div class="actions">
          <button @click="save">保存</button>
          <span v-if="saved" class="hint">已保存</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const serverUrl = ref('')
const wsPath = ref('/api/conversation/connect')
const theme = ref<'system' | 'dark' | 'light'>('system')
const saved = ref(false)

onMounted(() => {
  serverUrl.value = localStorage.getItem('rc_server_url') || ''
  wsPath.value = localStorage.getItem('rc_ws_path') || '/api/conversation/connect'
  theme.value = (localStorage.getItem('rc_theme') as any) || 'system'
})

const save = () => {
  localStorage.setItem('rc_server_url', serverUrl.value)
  localStorage.setItem('rc_ws_path', wsPath.value)
  localStorage.setItem('rc_theme', theme.value)
  saved.value = true
  setTimeout(() => (saved.value = false), 1200)
}
</script>

<style scoped>
.page { height: 100%; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.header { display: flex; align-items: center; justify-content: space-between; }
.content { flex: 1; overflow: auto; }
.card { background-color: #2a2a2a; border: 1px solid #444; border-radius: 12px; padding: 1rem; max-width: 720px; }
.row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 0.75rem; margin: 0.75rem 0; }
.label { color: #bbb; }
input, select { width: 100%; background-color: #1a1a1a; border: 1px solid #444; color: #e0e0e0; padding: 0.6rem 0.75rem; border-radius: 8px; }
.actions { margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; }
button { background-color: #646cff; color: #fff; border: none; padding: 0.6rem 1rem; border-radius: 8px; }
.hint { color: #7ee787; font-size: 0.9rem; }
@media (prefers-color-scheme: light) {
  .card { background-color: #fff; border-color: #e0e0e0; }
  input, select { background-color: #fff; color: #333; border-color: #ddd; }
}
</style>
