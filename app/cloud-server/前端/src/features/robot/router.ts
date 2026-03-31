// 机器人相关路由

import type { RouteRecordRaw } from 'vue-router'

export const robotRoutes: RouteRecordRaw[] = [
  {
    path: '/robots',
    name: 'RobotList',
    component: () => import('@/features/robot/views/RobotManage.vue'),
    meta: {
      title: '机器人管理',
      icon: 'Robot',
    },
  },
  {
    path: '/robots/add',
    name: 'RobotAdd',
    component: () => import('@/features/robot/views/RobotAdd.vue'),
    meta: {
      title: '新增机器人',
      hidden: true,
    },
  },
  {
    path: '/robots/:uuid',
    name: 'RobotDetail',
    component: () => import('@/features/robot/views/RobotSettings.vue'),
    meta: {
      title: '机器人详情',
      hidden: true,
    },
  },
  {
    path: '/robots/:uuid/settings',
    name: 'RobotSettings',
    component: () => import('@/features/robot/views/RobotSettings.vue'),
    meta: {
      title: '机器人设置',
      hidden: true,
    },
  },
  {
    path: '/operation',
    name: 'Operation',
    component: () => import('@/features/robot/views/RobotOperation.vue'),
    meta: {
      title: '机器人操作',
      icon: 'Operation',
    },
  },
  {
    path: '/operation/edit',
    name: 'OperationEdit',
    component: () => import('@/features/robot/views/RobotOperationEdit.vue'),
    meta: {
      title: '机器人操作编辑',
      hidden: true,
    },
  },
]
