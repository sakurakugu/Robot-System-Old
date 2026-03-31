import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { useAuthStore } from '../features/auth/store'
import App from './App.vue'
import { router } from './layouts/router'
import './style.css'
// 导入编舞系统样式
import '@/features/choreo/styles/index.css'
import { setupConsole } from '../share/utils/logger'
import { setupAuthenticatedFetch } from '../share/utils/setupAuthenticatedFetch'
import { useThemeStore } from './theme/store'

setupConsole()
setupAuthenticatedFetch()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 初始化主题
const themeStore = useThemeStore(pinia)
themeStore.init()

const authStore = useAuthStore(pinia)
authStore.restoreProfileIfNeeded()

app.mount('#app')
