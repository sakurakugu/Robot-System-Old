import type { RouteRecordRaw } from 'vue-router'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/home',
    name: 'HomePage',
    component: () => import('@/features/home/views/HomePage.vue'),
    meta: { title: '首页', hidden: true },
  },
]
