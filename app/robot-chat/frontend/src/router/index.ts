// 路由配置
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import RobotManage from '../views/RobotManage.vue'
import ChatView from '../views/ChatView.vue'
import ParamsManage from '../views/ParamsManage.vue'
import KnowledgeBase from '../views/KnowledgeBase.vue'
import SettingsPage from '../views/Settings.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: '/robots' },
      { path: 'robots', component: RobotManage },
      { path: 'chat', component: ChatView },
      { path: 'params', component: ParamsManage },
      { path: 'kb', component: KnowledgeBase },
      { path: 'settings', component: SettingsPage },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

