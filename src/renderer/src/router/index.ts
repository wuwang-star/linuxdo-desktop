import { createRouter, createWebHashHistory } from 'vue-router'
import BrowseView from '../views/BrowseView.vue'
// @scope: golden-path —— 冷启动首启门（PRD R1）：prefs 读写见 utils/prefs
import { loadPrefs, markOnboardingDone } from '../utils/prefs'

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
    // @scope: golden-path —— 冷启动欢迎流（8 屏状态机壳，见 WelcomeView.vue）
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('../views/WelcomeView.vue')
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

// @scope: golden-path —— 冷启动首启门（PRD R1）：未完成 onboarding 的导航一律先进 /welcome 流程。
// 放行名单：welcome（流程本身）与 login（「跳过，直接登录」入口；在登录页完成登录后再导航时，
// 下面的老用户判定会就地补写 onboardingDone 并放行——判定顺序：cookie 有效 > ech/doh 配置存在 > 走流程）。
router.beforeEach(async (to) => {
  if (to.name === 'welcome' || to.name === 'login') return true
  if (loadPrefs().onboardingDone) return true
  try {
    const st = await window.api.loginStatus()
    if (st.cookie || st.user) {
      markOnboardingDone()
      return true
    }
    const [net, doh] = await Promise.all([window.api.getNetworkConfig(), window.api.getDohConfig()])
    if (net.proxyMode === 'ech' || doh.enabled) {
      markOnboardingDone()
      return true
    }
  } catch {
    /* 主进程未就绪等异常：按新用户走流程 */
  }
  return { name: 'welcome' }
})

export default router
