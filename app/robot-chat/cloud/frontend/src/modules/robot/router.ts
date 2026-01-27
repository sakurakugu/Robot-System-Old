// 机器人相关路由

import type { RouteRecordRaw } from 'vue-router'

export const robotRoutes: RouteRecordRaw[] = [
  {
    path: '/robots',
    name: 'RobotList',
    component: () => import('@/modules/robot/views/RobotManage.vue'),
    meta: {
      title: '机器人管理',
      icon: 'Robot',
    },
  },
  {
    path: '/robots/:uuid',
    name: 'RobotDetail',
    component: () => import('@/modules/robot/views/RobotSettings.vue'),
    meta: {
      title: '机器人详情',
      hidden: true,
    },
  },
  {
    path: '/robots/:uuid/settings',
    name: 'RobotSettings',
    component: () => import('@/modules/robot/views/RobotSettings.vue'),
    meta: {
      title: '机器人设置',
      hidden: true,
    },
  },
]
