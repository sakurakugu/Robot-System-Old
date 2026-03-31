/**
 * 编舞系统路由配置
 */

import type { RouteRecordRaw } from 'vue-router'

export const choreoRoutes: RouteRecordRaw[] = [
  {
    path: '/choreo',
    name: 'ChoreoList',
    component: () => import('./views/ChoreoList.vue'),
    meta: {
      title: '编舞系统',
    },
  },
  {
    path: '/choreo/:uuid',
    name: 'ChoreoEditor',
    component: () => import('./views/ChoreoEditor.vue'),
    meta: {
      title: '编舞编辑器',
    },
    children: [
      {
        path: 'actions',
        name: 'ChoreoActions',
        component: () => import('./views/ActionList.vue'),
        meta: {
          title: '动作列表',
        },
      },
    ],
  },
  {
    path: '/choreo/:uuid/help',
    name: 'ChoreoHelp',
    component: () => import('./views/ChoreoHelp.vue'),
    meta: {
      title: '帮助',
    },
  },
  {
    path: '/choreo/:uuid/about',
    name: 'ChoreoAbout',
    component: () => import('./views/ChoreoAbout.vue'),
    meta: {
      title: '关于',
    },
  },
  {
    path: '/choreo/:uuid/settings',
    name: 'ChoreoSettings',
    component: () => import('./views/ChoreoSettings.vue'),
    meta: {
      title: '编舞设置',
    },
  },
]
