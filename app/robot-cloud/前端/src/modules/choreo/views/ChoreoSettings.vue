<template>
  <div class="settings-page">
    <div class="page-header">
      <el-button text @click="goBack" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>编舞设置</h2>
    </div>
    <div class="content">
      <div class="settings-layout">
        <div class="settings-sidebar">
          <div
            v-for="section in sections"
            :key="section.id"
            class="sidebar-item"
            :class="{ active: activeSection === section.id }"
            @click="scrollTo(section.id)"
          >
            {{ section.title }}
          </div>
        </div>
        <div class="settings-content">
          <section id="appearance" class="settings-section">
            <h3 class="section-title">外观</h3>
            <el-form label-width="140px" class="settings-form">
              <el-form-item label="跟随系统主题">
                <el-switch v-model="settings.followSystem" />
              </el-form-item>
              <el-form-item label="主题">
                <el-select v-model="settings.theme" style="width: 220px" :disabled="settings.followSystem">
                  <el-option label="浅色" value="light" />
                  <el-option label="深色" value="dark" />
                </el-select>
              </el-form-item>
            </el-form>
          </section>

          <section id="timeline" class="settings-section">
            <h3 class="section-title">时间轴</h3>
            <el-form label-width="140px" class="settings-form">
              <el-form-item label="默认时长（秒）">
                <el-input-number v-model="settings.defaultDuration" :min="10" :max="600" :step="10" />
              </el-form-item>
              <el-form-item label="默认缩放级别">
                <el-slider v-model="settings.defaultZoom" :min="20" :max="200" :step="10" show-input />
              </el-form-item>
              <el-form-item label="网格吸附">
                <el-switch v-model="settings.snapToGrid" />
              </el-form-item>
              <el-form-item label="网格大小（秒）">
                <el-input-number v-model="settings.gridSize" :min="0.1" :max="5" :step="0.1" :precision="1" />
              </el-form-item>
            </el-form>
          </section>

          <section id="playback" class="settings-section">
            <h3 class="section-title">播放</h3>
            <el-form label-width="140px" class="settings-form">
              <el-form-item label="自动播放预览">
                <el-switch v-model="settings.autoPlayPreview" />
              </el-form-item>
              <el-form-item label="循环播放">
                <el-switch v-model="settings.loopPlayback" />
              </el-form-item>
            </el-form>
          </section>

          <section id="preview" class="settings-section">
            <h3 class="section-title">3D 预览</h3>
            <el-form label-width="140px" class="settings-form">
              <el-form-item label="显示网格">
                <el-switch v-model="settings.showGrid" />
              </el-form-item>
              <el-form-item label="抗锯齿">
                <el-switch v-model="settings.antiAlias" />
              </el-form-item>
              <el-form-item label="阴影质量">
                <el-select v-model="settings.shadowQuality" style="width: 220px">
                  <el-option label="低" value="low" />
                  <el-option label="中" value="medium" />
                  <el-option label="高" value="high" />
                </el-select>
              </el-form-item>
            </el-form>
          </section>

          <section id="execution" class="settings-section">
            <h3 class="section-title">执行</h3>
            <el-form label-width="140px" class="settings-form">
              <el-form-item label="执行前确认">
                <el-switch v-model="settings.confirmBeforeExecute" />
              </el-form-item>
              <el-form-item label="执行超时（秒）">
                <el-input-number v-model="settings.executionTimeout" :min="30" :max="600" :step="30" />
              </el-form-item>
            </el-form>
          </section>

          <div class="actions">
            <el-button @click="resetSettings">重置默认</el-button>
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeSection = ref('appearance')

const sections = [
  { id: 'appearance', title: '外观' },
  { id: 'timeline', title: '时间轴' },
  { id: 'playback', title: '播放' },
  { id: 'preview', title: '3D 预览' },
  { id: 'execution', title: '执行' },
]

const defaultSettings = {
  // 外观
  followSystem: true,
  theme: 'dark' as 'light' | 'dark',
  // 时间轴
  defaultDuration: 60,
  defaultZoom: 100,
  snapToGrid: true,
  gridSize: 0.5,
  // 播放
  autoPlayPreview: false,
  loopPlayback: false,
  // 3D 预览
  showGrid: true,
  antiAlias: true,
  shadowQuality: 'medium' as 'low' | 'medium' | 'high',
  // 执行
  confirmBeforeExecute: true,
  executionTimeout: 300,
}

const STORAGE_KEY = 'choreo-settings'

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error('加载设置失败:', e)
  }
  return { ...defaultSettings }
}

const settings = reactive(loadSettings())

const goBack = () => {
  router.back()
}

const scrollTo = (id: string) => {
  activeSection.value = id
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const resetSettings = () => {
  Object.assign(settings, defaultSettings)
  ElMessage.success('已重置为默认设置')
}

const saveSettings = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    ElMessage.success('设置已保存')
  } catch (e) {
    ElMessage.error('保存设置失败')
  }
}
</script>

<style scoped>
.settings-page {
  padding: 24px;
  color: var(--el-text-color-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  flex-shrink: 0;
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
  overflow: hidden;
}

.settings-layout {
  display: flex;
  gap: 24px;
  height: 100%;
}

.settings-sidebar {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color);
  padding-right: 16px;
}

.sidebar-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  transition: all 0.2s;
}

.sidebar-item:hover {
  background: var(--el-fill-color-light);
}

.sidebar-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 16px;
}

.settings-section {
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.settings-section:last-of-type {
  border-bottom: none;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.settings-form {
  max-width: 500px;
}

.actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
}
</style>
