<template>
  <div class="code-editor">
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
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
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
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: none;
  border-radius: 0;
  padding: 10px 20px;
  box-shadow: none;
}

:deep(.el-textarea__inner:focus) {
  box-shadow: none;
}
</style>
