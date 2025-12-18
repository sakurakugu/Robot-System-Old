<template>
  <div class="code-editor">
    <div class="editor-header">
      <div class="file-info">
        <el-icon><Document /></el-icon>
        <span>{{ fileName }}</span>
      </div>
    </div>
    <div class="editor-content">
      <el-input
        v-model="content"
        type="textarea"
        :rows="20"
        resize="none"
        readonly
        class="code-textarea"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Document } from '@element-plus/icons-vue'

const props = defineProps<{
  fileName: string
  initialContent: string
}>()

const content = ref(props.initialContent)

watch(() => props.initialContent, (newContent) => {
  content.value = newContent
})
</script>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  color: #d4d4d4;
}

.editor-header {
  padding: 8px 16px;
  background-color: #252526;
  border-bottom: 1px solid #3c3c3c;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cccccc;
}

.editor-content {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.code-textarea {
  height: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
}

:deep(.el-textarea__inner) {
  height: 100%;
  background-color: #1e1e1e;
  color: #d4d4d4;
  border: none;
  border-radius: 0;
  padding: 10px 20px;
  box-shadow: none;
}

:deep(.el-textarea__inner:focus) {
  box-shadow: none;
}
</style>
