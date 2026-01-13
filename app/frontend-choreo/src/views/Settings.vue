<template>
  <div class="settings-page">
    <div class="settings-header">
      <el-button v-if="showBack" text @click="goBack" class="back-btn" title="返回">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>设置</h2>
    </div>
    <div class="content">
      <div class="settings-layout">
        <div class="settings-sidebar">
          <div class="sidebar-title" @click="scrollTo('appearance')">外观</div>
          <div class="sidebar-title" @click="scrollTo('mapping')">主题映射</div>
          <div class="sidebar-title" @click="scrollTo('language')">语言</div>
        </div>
        <div class="settings-content">
          <section id="appearance" class="settings-section">
            <h3 class="section-title">外观</h3>
            <el-form label-width="120px" class="settings-form">
              <el-form-item label="跟随系统主题">
                <el-switch v-model="followSystem" />
              </el-form-item>
              <el-form-item label="主题">
                <el-select v-model="theme" placeholder="选择主题" style="width: 220px" :disabled="followSystem">
                  <el-option label="浅色" value="light" />
                  <el-option label="深色" value="dark" />
                </el-select>
              </el-form-item>
            </el-form>
          </section>

          <section id="mapping" class="settings-section">
            <h3 class="section-title">主题映射</h3>
            <el-form label-width="120px" class="settings-form">
              <el-form-item label="深色样式使用">
                <el-select v-model="darkMapping" placeholder="选择深色样式使用的主题" style="width: 220px">
                  <el-option label="深色" value="dark" />
                  <el-option label="浅色" value="light" />
                </el-select>
              </el-form-item>
              <el-form-item label="浅色样式使用">
                <el-select v-model="lightMapping" placeholder="选择浅色样式使用的主题" style="width: 220px">
                  <el-option label="浅色" value="light" />
                  <el-option label="深色" value="dark" />
                </el-select>
              </el-form-item>
            </el-form>
          </section>

          <section id="language" class="settings-section">
            <h3 class="section-title">语言</h3>
            <el-form label-width="120px" class="settings-form">
              <el-form-item label="语言（暂未实现）">
                <el-select v-model="language" placeholder="选择语言" style="width: 220px">
                  <el-option label="简体中文" value="zh-CN" />
                  <el-option label="English" value="en-US" />
                </el-select>
              </el-form-item>
            </el-form>
          </section>

          <div class="actions">
            <el-button type="primary" @click="save">保存</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const theme = ref<'light' | 'dark'>(themeStore.theme)
const followSystem = ref<boolean>(themeStore.followSystem)
const darkMapping = ref<'light' | 'dark'>(themeStore.mapping.dark)
const lightMapping = ref<'light' | 'dark'>(themeStore.mapping.light)
const language = ref<'zh-CN' | 'en-US'>('zh-CN')
const router = useRouter()
const route = useRoute()

watch(theme, (val) => {
  themeStore.setTheme(val)
})
watch(followSystem, (val) => {
  themeStore.setFollowSystem(val)
})
watch([darkMapping, lightMapping], ([d, l]) => {
  themeStore.setMapping({ dark: d, light: l })
})

const save = () => {
  ElMessage.success('设置已保存')
}

const goBack = () => {
  router.back()
}

const showBack = computed(() => {
  return !route.path.startsWith('/project/')
})

const scrollTo = (id: string) => {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
  color: var(--el-text-color-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
}

.content {
  margin-top: 20px;
  flex: 1;
  overflow-y: auto;
}

.settings-layout {
  display: flex;
  gap: 24px;
  position: relative;
}

.settings-sidebar {
  width: 220px;
  flex: 0 0 220px;
  position: sticky;
  top: 20px;
  align-self: flex-start;
}

.settings-layout::before {
  content: "";
  position: absolute;
  left: 220px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--el-border-color);
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  padding: 10px 12px;
  border-radius: 6px;
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.sidebar-title:hover {
  background-color: var(--el-fill-color-light);
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.settings-section {
  padding: 8px 0 20px 0;
}

.settings-section:not(:first-child) {
  border-top: 1px solid var(--el-border-color);
  margin-top: 20px;
}

.settings-form :deep(.el-form-item__label) {
  color: var(--el-text-color-secondary);
}

.actions {
  margin-top: 24px;
}
</style>
