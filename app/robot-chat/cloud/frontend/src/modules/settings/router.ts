// 系统相关路由

import type { RouteRecordRaw } from 'vue-router'

export const systemRoutes: RouteRecordRaw[] = [
  {
    path: '/operation',
    name: 'Operation',
    component: () => import('@/modules/robot/views/RobotOperation.vue'),
    meta: {
      title: '机器人操作',
      icon: 'Operation',
    },
  },
  {
    path: '/operation/edit',
    name: 'OperationEdit',
    component: () => import('@/modules/robot/views/RobotOperationEdit.vue'),
    meta: {
      title: '机器人操作编辑',
      hidden: true,
    },
  },
  {
    path: '/params',
    name: 'Params',
    component: () => import('@/modules/settings/views/ParamsManage.vue'),
    meta: {
      title: '参数管理',
      icon: 'Setting',
    },
  },
  {
    path: '/kb',
    name: 'KnowledgeBase',
    component: () => import('@/modules/knowledge/views/KnowledgeBase.vue'),
    meta: {
      title: '知识库', // 给ai用的
      icon: 'Document',
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
