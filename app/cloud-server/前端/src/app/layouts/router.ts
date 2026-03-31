// 路由配置

import { authLayoutRoutes, authRoutes } from '@/features/auth/router'
import { useAuthStore } from '@/features/auth/store'
import { choreoRoutes } from '@/features/choreo/router'
import { conversationRoutes } from '@/features/conversation/router'
import { homeRoutes } from '@/features/home/router'
import { knowledgeBase } from '@/features/knowledge/router'
import { robotRoutes } from '@/features/robot/router'
import { roleRoutes } from '@/features/role/router'
import { systemRoutes } from '@/features/settings/router'
import MainLayout from '@/modules/layouts/views/MainLayout.vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  ...authRoutes,
  ...homeRoutes,
  {
    path: '/',
    component: MainLayout,
    redirect: '/home',
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
    redirect: '/home',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  const isAuthPage = to.path === '/auth'
  const isHomePage = to.path === '/home'

  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - 机器狗对话系统`
  }

  // 首页和认证页不需要登录
  if (isHomePage || isAuthPage) {
    next()
    return
  }

  if (!authStore.isAuthenticated) {
    next('/auth')
    return
  }

  if (isAuthPage && authStore.isAuthenticated) {
    next('/home')
    return
  }

  const allowRoles = (to.meta.roles as string[] | undefined) || []
  if (allowRoles.length > 0) {
    const role = authStore.user?.role || 'guest'
    if (!allowRoles.includes(role)) {
      next('/home')
      return
    }
  }

  next()
})

export default router
