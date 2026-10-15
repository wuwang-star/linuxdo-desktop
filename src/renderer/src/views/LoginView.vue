<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import type { DiagEntry } from '../../../main/api/client'

const auth = useAuthStore()
const apiKey = ref('')
const apiUsername = ref('')
const diag = ref<DiagEntry[]>([])

onMounted(async () => {
  await auth.refresh()
  diag.value = await window.api.diagnostics()
})
</script>

<template>
  <div class="login-page">
    <section class="card">
      <h2>登录状态</h2>
      <p v-if="auth.status?.user">✅ 已登录：<strong>@{{ auth.status.user.username }}</strong></p>
      <p v-else>未登录（游客可浏览公开内容）</p>
      <ul class="status-list">
        <li>Cookie 会话：{{ auth.status?.cookie ? '✅' : '—' }}</li>
        <li>User API Key：{{ auth.status?.apiKey ? '✅' : '—' }}</li>
      </ul>
      <button class="primary" :disabled="auth.loading" @click="auth.openLogin()">打开登录窗口（推荐）</button>
      <p class="tip">登录窗口是真实浏览器环境：账号密码 / OAuth / Cloudflare 验证都在其中完成，成功后自动关闭。</p>
      <p v-if="auth.message" class="message">{{ auth.message }}</p>
    </section>

    <section class="card">
      <h2>User API Key（可选）</h2>
      <p class="tip">若你持有 linux.do 的 User API Key，可在此填入；凭据将以系统加密存储在本机。</p>
      <input v-model="apiUsername" placeholder="用户名（如 neo）" />
      <input v-model="apiKey" placeholder="API Key" type="password" />
      <div class="row">
        <button class="primary" :disabled="auth.loading || !apiKey || !apiUsername" @click="auth.saveApiKey(apiKey, apiUsername)">
          保存
        </button>
        <button v-if="auth.status?.apiKey" @click="auth.clearApiKey()">清除</button>
      </div>
    </section>

    <section class="card">
      <h2>请求诊断（最近）</h2>
      <div class="diag">
        <div v-for="(d, i) in diag.slice(0, 20)" :key="i" class="diag-row" :class="{ bad: d.status >= 400 || d.status === 0 }">
          <span class="st">{{ d.status }}</span>
          <span class="ms">{{ d.ms }}ms</span>
          <span class="url">{{ d.url.replace('https://linux.do', '') }}</span>
        </div>
        <div v-if="diag.length === 0" class="tip">暂无请求</div>
      </div>
    </section>
  </div>
</template>
