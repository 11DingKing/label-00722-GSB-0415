import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/release',
    name: 'Release',
    component: () => import('../views/Release.vue'),
    meta: { title: '软件快速发布', group: 'developer' }
  },
  {
    path: '/update',
    name: 'Update',
    component: () => import('../views/Update.vue'),
    meta: { title: '软件更新设置', group: 'system' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
