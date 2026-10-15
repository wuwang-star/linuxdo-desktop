<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import { computed } from 'vue'

const auth = useAuthStore()
auth.refresh()

const who = computed(() => auth.status?.user?.username ?? null)
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/" class="brand">LINUX<span>DO</span></RouterLink>
      <nav class="nav">
        <RouterLink to="/">最新</RouterLink>
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
