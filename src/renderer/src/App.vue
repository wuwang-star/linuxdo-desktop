<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import { useQueueStore } from './stores/queue'
import { useRouter } from 'vue-router'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { applyPrefs, loadPrefs, watchSystemTheme } from './utils/prefs'
import { applyThemeById, loadSelectedThemeId } from './utils/themes'
import UserCard from './components/UserCard.vue'

const auth = useAuthStore()
const queue = useQueueStore()
const router = useRouter()

// 阅读体感：启动即应用（setup 同步执行早于首帧，避免暗色系统下白闪）；system 模式实时跟随
const startPrefs = loadPrefs()
applyPrefs(startPrefs)
// 主题镜像到主进程：nativeTheme.themeSource + titleBarOverlay 跟随 prefs
// （system 模式下 themeSource='system' 后 OS 亮暗切换主进程自行跟随，无需再通知；失败静默）
void window.api.setTheme(startPrefs.theme).catch(() => {})
const disposeThemeWatcher = watchSystemTheme()
// 主题工坊：启动应用已选皮肤（异步读盘，切换瞬间允许短暂默认色——见 PRD Out of Scope）
void applyThemeById(loadSelectedThemeId()).catch(() => {})
const queueOpen = ref(false)
const who = computed(() => auth.status?.user?.username ?? null)
const api = window.api
const unread = computed(() => {
  const u = auth.status?.user
  if (!u) return 0
  return (u.unread_notifications ?? 0) + (u.unread_high_priority_notifications ?? 0)
})

// 首次加载完成后再开始比较，避免把存量未读当新通知
const initialized = ref(false)
watch(unread, (n, o) => {
  if (initialized.value && n > o) {
    try {
      new Notification('linux.do 新通知', { body: `你有 ${n} 条未读通知` })
    } catch {
      /* 通知 API 不可用时静默 */
    }
  }
})

let timer: number | undefined
function onFocus(): void {
  void auth.refresh()
}

// ---- MessageBus 实时通知：cookie 登录态就绪后启动；未登录/回退时仅靠 60s 手动轮询 ----
let offPush: (() => void) | null = null
let offOpen: (() => void) | null = null
let offQueueNext: (() => void) | null = null

// 全局快捷键 Alt+Shift+N 队列下一贴：主进程广播 → 复用 TopicView 同款 neighbors().next 跳转；
// 不在主题页或无下一贴时按 PRD 忽略（无副作用）
function goQueueNext(): void {
  const route = router.currentRoute.value
  const cur = route.name === 'topic' ? Number(route.params.id) : NaN
  const next = Number.isFinite(cur) ? queue.neighbors(cur).next : null
  if (next !== null) void router.push(`/t/${next}`)
}

onMounted(() => {
  void auth.refresh().then(() => {
    initialized.value = true
  })
  timer = window.setInterval(() => void auth.refresh(), 60_000)
  window.addEventListener('focus', onFocus)
  // 实时推送到达 → 刷新登录态（未读徽标随之更新，增量时由上方 watcher 弹 toast）
  offPush = window.api.onNotificationPush((payload) => {
    if (payload.channel.startsWith('/notification/')) void auth.refresh()
  })
  // 原生通知点击 → 跳转对应主题楼层（TopicView 已支持 ?pn 直达；主进程已聚焦窗口）
  offOpen = window.api.onNotificationOpen((p) => {
    void router.push(`/t/${p.topicId}${p.postNumber ? `?pn=${p.postNumber}` : ''}`)
  })
  offQueueNext = window.api.onQueueNext(goQueueNext)
  // 仅在登录态/用户变化时启停实时通道（主进程侧重复 start 为 no-op，失败达上限进入回退）
  watch(
    () => (auth.status?.cookie ? (auth.status.user?.id ?? null) : null),
    (id) => {
      const p = id === null ? window.api.messageBusStop() : window.api.messageBusStart(id)
      void p.catch(() => {})
    }
  )
})

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearInterval(timer)
  window.removeEventListener('focus', onFocus)
  offPush?.()
  offOpen?.()
  offQueueNext?.()
  disposeThemeWatcher()
})
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/" class="brand">LINUX<span>DO</span></RouterLink>
      <nav class="nav">
        <RouterLink to="/">最新</RouterLink>
        <div class="queue-wrap">
          <button class="chip" :class="{ active: queueOpen }" @click="queueOpen = !queueOpen">
            队列{{ queue.count > 0 ? ` ${queue.count}` : '' }}
          </button>
          <div v-if="queueOpen" class="queue-panel">
            <div v-if="queue.count === 0" class="queue-empty">队列为空：在列表或主题页点「＋」入队（悬停看提示）</div>
            <div v-for="item in queue.items" :key="item.id" class="queue-item">
              <RouterLink :to="`/t/${item.id}`" @click="queueOpen = false">{{ item.title }}</RouterLink>
              <button class="act" @click="queue.remove(item.id)">移除</button>
            </div>
            <button v-if="queue.count > 0" class="act queue-clear" @click="queue.clear()">清空队列</button>
          </div>
        </div>
        <RouterLink to="/notifications" class="bell" aria-label="通知">
          🔔
          <span v-if="unread > 0" class="badge">{{ unread > 99 ? '99+' : unread }}</span>
        </RouterLink>
        <RouterLink to="/settings">设置</RouterLink>
        <RouterLink to="/login" class="login-link">
          <template v-if="who">@{{ who }}</template>
          <template v-else>登录</template>
        </RouterLink>
      </nav>
      <!-- 自绘窗口钮（原生 overlay 已移除）：关闭=隐藏到托盘；双击拖拽区同样可最大化 -->
      <div class="win-btns" data-nodrag>
        <button class="win-btn" aria-label="最小化" @click="api.winMinimize()">
          <svg viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        </button>
        <button class="win-btn" aria-label="最大化/还原" @click="api.winToggleMaximize()">
          <svg viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
          </svg>
        </button>
        <button class="win-btn close" aria-label="关闭" @click="api.winClose()">
          <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        </button>
      </div>
    </div>
  </header>
  <main class="page">
    <RouterView />
    <UserCard />
  </main>
</template>
