import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/themes/light.css'
import './styles/themes/dark.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faSquareCaretLeft, faSquareCaretDown, faSquareCaretRight } from '@fortawesome/free-regular-svg-icons'

const app = createApp(App)
const pinia = createPinia()

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 注册 FontAwesome
library.add(faSquareCaretLeft, faSquareCaretDown, faSquareCaretRight)
app.component('font-awesome-icon', FontAwesomeIcon)

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 初始化主题（默认深色，可从本地存储恢复）
const themeStore = useThemeStore(pinia)
themeStore.init()

app.mount('#app')
