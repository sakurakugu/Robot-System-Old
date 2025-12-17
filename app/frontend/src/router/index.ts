import { createRouter, createWebHistory } from 'vue-router'
import ProjectList from '../views/ProjectList.vue'
import MainLayout from '../views/MainLayout.vue'
import ProjectEditor from '../views/ProjectEditor.vue'
import RobotManager from '../views/RobotManager.vue'

const routes = [
  {
    path: '/',
    name: 'ProjectList',
    component: ProjectList
  },
  {
    path: '/project/:uuid',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'ProjectEditor',
        component: ProjectEditor
      },
      {
        path: 'robots',
        name: 'RobotManager',
        component: RobotManager
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
