// 路由配置

import { authLayoutRoutes, authRoutes } from '@/modules/auth/router'
import { useAuthStore } from '@/modules/auth/store'
import { choreoRoutes } from '@/modules/choreo/router'
import { conversationRoutes } from '@/modules/conversation/router'
import { knowledgeBase } from '@/modules/knowledge/router'
import MainLayout from '@/modules/layouts/views/MainLayout.vue'
import { robotRoutes } from '@/modules/robot/router'
import { roleRoutes } from '@/modules/role/router'
import { systemRoutes } from '@/modules/settings/router'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  ...authRoutes,
  {
    path: '/',
    component: MainLayout,
    redirect: '/robots',
    children: [
      ...robotRoutes,
      ...roleRoutes,
      ...conversationRoutes,
      ...systemRoutes,
      ...knowledgeBase,
      ...choreoRoutes,
      ...authLayoutRoutes,
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/robots',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - 机器狗对话系统`
  }

  if (to.meta.requireAuth && !authStore.isAuthenticated) {
    next('/auth')
    return
  }

  const allowRoles = (to.meta.roles as string[] | undefined) || []
  if (allowRoles.length > 0) {
    const role = authStore.user?.role || 'guest'
    if (!allowRoles.includes(role)) {
      next('/robots')
      return
    }
  }

  next()
})

export default router
