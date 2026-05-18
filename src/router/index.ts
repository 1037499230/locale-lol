import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/h5/polyglot',
    name: 'h5-polyglot',
    component: () => import('../views/h5/Polyglot.vue')
  },
  {
    path: '/system/tableKey',
    name: 'system-tableKey',
    component: () => import('../views/system/TitleKeyBD.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router