<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const auth = useAuthStore()
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

onMounted(() => {
  void auth.refresh().then(() => {
    initialized.value = true
  })
  timer = window.setInterval(() => void auth.refresh(), 60_000)
  window.addEventListener('focus', onFocus)
})

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearInterval(timer)
  window.removeEventListener('focus', onFocus)
})
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/" class="brand">LINUX<span>DO</span></RouterLink>
      <nav class="nav">
        <RouterLink to="/">最新</RouterLink>
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
