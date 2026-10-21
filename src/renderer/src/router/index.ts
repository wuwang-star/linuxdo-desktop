import { createRouter, createWebHashHistory } from 'vue-router'
import BrowseView from '../views/BrowseView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // 双栏主从：列表六模式全部路由化（route→store 单向驱动，URL 即状态：可刷新/分享/前进后退）；
    // / 与 /t/:id 同渲染 BrowseView（内部按视口宽/路由分流列表与阅读）；/login、/settings 等维持整页
    { path: '/', name: 'home', component: BrowseView },
    { path: '/views', name: 'views', component: BrowseView },
    { path: '/top/:period/:sort(views)?', name: 'top', component: BrowseView },
    { path: '/hot', name: 'hot', component: BrowseView },
    { path: '/category/:slug/:id', name: 'category', component: BrowseView },
    { path: '/offline', name: 'offline', component: BrowseView },
    { path: '/favorites/:folderId?', name: 'favorites', component: BrowseView },
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
      path: '/u/:username',
      name: 'user',
      component: () => import('../views/UserProfileView.vue')
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('../views/NotificationsView.vue')
    }
  ]
})

export default router
