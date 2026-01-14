<template>
  <div class="page">
    <div class="header">
      <h2>知识库</h2>
      <div class="actions">
        <button @click="refresh" :disabled="loading">刷新</button>
      </div>
    </div>
    <div class="content">
      <div v-if="loading" class="hint">加载中...</div>
      <div v-else class="grid">
        <div v-for="doc in docs" :key="doc.uuid" class="card">
          <div class="title">{{ doc.title }}</div>
          <div class="meta">
            <span>{{ doc.category || '未分类' }}</span>
            <span>更新时间 {{ formatTime(doc.updated_at) }}</span>
          </div>
          <div class="excerpt">{{ doc.content.slice(0, 120) }}{{ doc.content.length > 120 ? '...' : '' }}</div>
        </div>
        <div v-if="docs.length === 0" class="hint">暂无文档</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type Doc = {
  uuid: string
  title: string
  content: string
  category?: string | null
  tags?: string | null
  updated_at?: string | null
}

const loading = ref(false)
const docs = ref<Doc[]>([])

const refresh = async () => {
  loading.value = true
  docs.value = []
  loading.value = false
}

const formatTime = (val?: string | null) => {
  if (!val) return '-'
  try { return new Date(val).toLocaleString() } catch { return val }
}
</script>

<style scoped>
.page { height: 100%; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.header { display: flex; align-items: center; justify-content: space-between; }
.actions button { background-color: #2a2a2a; border: 1px solid #444; color: #e0e0e0; padding: 0.5rem 0.9rem; border-radius: 8px; }
.content { flex: 1; overflow: auto; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.card { background-color: #2a2a2a; border: 1px solid #444; border-radius: 10px; padding: 0.9rem 1.1rem; }
.title { font-weight: 600; margin-bottom: 0.5rem; }
.meta { font-size: 0.8rem; color: #aaa; display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
.excerpt { color: #ddd; font-size: 0.95rem; }
.hint { color: #bbb; padding: 0.5rem; }
@media (prefers-color-scheme: light) {
  .actions button { background-color: #fff; color: #333; border-color: #ddd; }
  .card { background-color: #fff; border-color: #e0e0e0; }
}
</style>
