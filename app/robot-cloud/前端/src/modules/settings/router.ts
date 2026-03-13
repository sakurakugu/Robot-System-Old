// 系统相关路由

import type { RouteRecordRaw } from 'vue-router'

export const systemRoutes: RouteRecordRaw[] = [
  {
    path: '/update-manage',
    name: 'UpdateManage',
    component: () => import('@/modules/settings/views/UpdateManage.vue'),
    meta: {
      title: '更新管理',
      icon: 'UploadFilled',
      roles: ['admin', 'super_admin'],
    },
  },
  {
    path: '/params',
    name: 'Params',
    component: () => import('@/modules/settings/views/ParamsManage.vue'),
    meta: {
      title: '参数管理',
      icon: 'Setting',
      roles: ['admin', 'super_admin'],
    },
  },
  {
    path: '/feedback-manage',
    name: 'FeedbackManage',
    component: () => import('@/modules/settings/views/FeedbackManage.vue'),
    meta: {
      title: '反馈管理',
      icon: 'ChatDotRound',
      roles: ['admin', 'super_admin'],
    },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/modules/settings/views/Settings.vue'),
    meta: {
      title: '系统设置',
      icon: 'Tools',
    },
  },
]
