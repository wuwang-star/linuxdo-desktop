<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import { useQueueStore } from './stores/queue'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const auth = useAuthStore()
const queue = useQueueStore()
const queueOpen = ref(false)
const who = computed(() => auth.status?.user?.username ?? null)
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
            <div v-if="queue.count === 0" class="queue-empty">队列为空：在列表或主题页点「＋ 入队」</div>
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
        <RouterLink to="/login" class="login-link">
          <template v-if="who">@{{ who }}</template>
          <template v-else>登录 / 设置</template>
        </RouterLink>
      </nav>
    </div>
  </header>
  <main class="page">
    <RouterView />
  </main>
</template>
