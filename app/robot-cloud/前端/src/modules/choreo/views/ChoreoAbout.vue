<template>
  <div class="about-page">
    <div class="page-header">
      <el-button text @click="goBack" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>关于</h2>
    </div>
    <div class="content">
      <el-card class="about-card">
        <div class="app-info">
          <div class="app-logo">
            <el-icon :size="64"><VideoPlay /></el-icon>
          </div>
          <h1 class="app-name">机器狗编舞系统</h1>
          <p class="app-version">版本 1.0.0</p>
          <p class="app-desc">一个用于控制机器狗执行编舞动作的可视化编辑系统</p>
        </div>

        <el-divider />

        <div class="info-section">
          <h3>功能特点</h3>
          <ul>
            <li>可视化时间轴编辑器</li>
            <li>多轨道动作编排</li>
            <li>音频同步播放</li>
            <li>3D 机器人预览</li>
            <li>多机器人协同控制</li>
            <li>自定义动作保存</li>
          </ul>
        </div>

        <el-divider />

        <div class="info-section">
          <h3>技术栈</h3>
          <div class="tech-tags">
            <el-tag>Vue 3</el-tag>
            <el-tag>TypeScript</el-tag>
            <el-tag>Element Plus</el-tag>
            <el-tag>Three.js</el-tag>
            <el-tag>WaveSurfer.js</el-tag>
            <el-tag>Vite</el-tag>
          </div>
        </div>

        <el-divider />

        <div class="info-section">
          <h3>环境信息</h3>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="运行模式">{{ isDev ? '开发模式' : '生产模式' }}</el-descriptions-item>
            <el-descriptions-item label="浏览器">{{ browserInfo }}</el-descriptions-item>
            <el-descriptions-item label="平台">{{ platformInfo }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, VideoPlay } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isDev = import.meta.env.DEV

const browserInfo = computed(() => {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Unknown'
})

const platformInfo = computed(() => {
  const platform = navigator.platform
  if (platform.includes('Win')) return 'Windows'
  if (platform.includes('Mac')) return 'macOS'
  if (platform.includes('Linux')) return 'Linux'
  return platform
})

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.about-page {
  padding: 24px;
  color: var(--el-text-color-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.content {
  flex: 1;
  display: flex;
  justify-content: center;
}

.about-card {
  max-width: 600px;
  width: 100%;
  background: var(--el-bg-color);
}

.app-info {
  text-align: center;
  padding: 20px 0;
}

.app-logo {
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.app-name {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.app-version {
  color: var(--el-text-color-secondary);
  margin: 0 0 12px 0;
}

.app-desc {
  color: var(--el-text-color-regular);
  margin: 0;
}

.info-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.info-section ul {
  margin: 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
}

.info-section ul li {
  margin-bottom: 6px;
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
