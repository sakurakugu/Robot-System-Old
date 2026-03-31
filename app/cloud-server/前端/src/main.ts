import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { useAuthStore } from './modules/auth/store'
import { router } from './modules/layouts/router'
import './style.css'
// 导入编舞系统样式
import './modules/choreo/styles/index.css'
import { useThemeStore } from './stores/theme'
import { setupAuthenticatedFetch } from './utils/setupAuthenticatedFetch'
import { setupConsole } from './utils/logger'

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
