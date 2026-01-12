<template>
  <div class="about-page">
    <h2>关于</h2>
    <div class="content">
      <p>我是关于页面</p>
      <p>版本: 23333</p>
      <p>114514</p>
      <p class="dev-mode" v-if="isDev">当前为开发者模式</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const isDev = import.meta.env.DEV
</script>

<style scoped>
.about-page {
  padding: 20px;
  color: var(--el-text-color-primary);
}

.content {
  margin-top: 20px;
  line-height: 1.6;
}

.dev-mode {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}
</style>
