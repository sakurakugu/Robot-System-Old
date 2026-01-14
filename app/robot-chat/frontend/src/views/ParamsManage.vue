<template>
  <div class="page">
    <div class="header">
      <h2>参数管理</h2>
    </div>
    <div class="content">
      <div class="card">
        <div class="row">
          <label class="label">最大历史轮数</label>
          <input type="number" min="0" v-model.number="maxHistory" />
        </div>
        <div class="row">
          <label class="label">回复温度</label>
          <input type="number" step="0.1" min="0" max="2" v-model.number="temperature" />
        </div>
        <div class="row">
          <label class="label">系统提示词</label>
          <textarea rows="4" v-model="systemPrompt" />
        </div>
        <div class="actions">
          <button @click="save">保存</button>
          <span class="hint" v-if="saved">已保存</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const maxHistory = ref<number>(10)
const temperature = ref<number>(0.7)
const systemPrompt = ref<string>('你是一个友好且安全的机器狗助手。')
const saved = ref(false)

const save = () => {
  saved.value = true
  setTimeout(() => (saved.value = false), 1200)
}
</script>

<style scoped>
.page {
  height: 100%;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.header { display: flex; align-items: center; justify-content: space-between; }
.content { flex: 1; overflow: auto; }
.card {
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 1rem;
  max-width: 720px;
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
}
.label { color: #bbb; }
input, textarea {
  width: 100%;
  background-color: #1a1a1a;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
}
.actions { margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; }
button {
  background-color: #646cff;
  color: #fff;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 8px;
}
.hint { color: #7ee787; font-size: 0.9rem; }
@media (prefers-color-scheme: light) {
  .card { background-color: #fff; border-color: #e0e0e0; }
  input, textarea { background-color: #fff; color: #333; border-color: #ddd; }
}
</style>
