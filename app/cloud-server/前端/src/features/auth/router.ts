import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/auth',
    name: 'AuthPage',
    component: () => import('@/features/auth/views/AuthPage.vue'),
    meta: { title: '登录 / 注册', hidden: true },
  },
]

export const authLayoutRoutes: RouteRecordRaw[] = [
  {
    path: '/personal',
    name: 'PersonalCenter',
    component: () => import('@/features/auth/views/PersonalCenter.vue'),
    meta: { title: '个人资料', requireAuth: true, icon: 'User' },
  },
  {
    path: '/sessions',
    name: 'LoginDevices',
    component: () => import('@/features/auth/views/LoginDevices.vue'),
    meta: { title: '登录设备', requireAuth: true, icon: 'Monitor' },
  },
  {
    path: '/users',
    name: 'UserManage',
    component: () => import('@/features/auth/views/UserManage.vue'),
    meta: { title: '用户权限', requireAuth: true, roles: ['super_admin'], icon: 'UserFilled' },
  },
]
