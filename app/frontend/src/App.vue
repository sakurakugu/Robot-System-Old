<template>
  <div id="app">
    <DevTopFab />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import DevTopFab from './components/DevTopFab.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}
</style>
