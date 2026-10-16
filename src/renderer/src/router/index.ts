import { createRouter, createWebHashHistory } from 'vue-router'
import BrowseView from '../views/BrowseView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // 双栏主从：/ 与 /t/:id 同渲染 BrowseView（内部按视口宽/路由分流列表与阅读）；/login、/settings 等维持整页
    { path: '/', name: 'home', component: BrowseView },
    {
      path: '/t/:id',
      name: 'topic',
      component: BrowseView
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('../views/NotificationsView.vue')
    }
  ]
})

export default router
