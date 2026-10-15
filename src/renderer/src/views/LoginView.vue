<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import type { DiagEntry } from '../../../main/api/client'
import type { TranslateConfig } from '../../../main/api/settings'

const auth = useAuthStore()
const apiKey = ref('')
const apiUsername = ref('')
const diag = ref<DiagEntry[]>([])

// ---- 翻译服务配置 ----
const trBaseUrl = ref('')
const trModel = ref('')
const trKey = ref('')
const trSaving = ref(false)
const trMessage = ref('')
const trConfigured = ref(false)

async function saveTranslate(): Promise<void> {
  if (trSaving.value) return
  trSaving.value = true
  trMessage.value = ''
  try {
    const cfg: TranslateConfig = await window.api.setTranslateConfig(
      trBaseUrl.value,
      trModel.value,
      trKey.value ? trKey.value : undefined
    )
    trConfigured.value = Boolean(cfg.baseUrl) && cfg.hasKey
    trKey.value = ''
    trMessage.value = '翻译服务配置已保存'
  } catch (e) {
    trMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    trSaving.value = false
  }
}

// ---- 登录方式 ----
const tCookie = ref('')

async function pasteCookie(): Promise<void> {
  if (!tCookie.value.trim() || auth.loading) return
  await auth.pasteTCookie(tCookie.value)
  tCookie.value = ''
}

onMounted(async () => {
  await auth.refresh()
  diag.value = await window.api.diagnostics()
  const cfg = await window.api.getTranslateConfig()
  trBaseUrl.value = cfg.baseUrl
  trModel.value = cfg.model
  trConfigured.value = Boolean(cfg.baseUrl) && cfg.hasKey
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
        <li>
          API Key：{{ auth.status?.apiKey ? `✅（${auth.status.apiKeyKind === 'user-api-key' ? '用户授权' : '手动填入'}）` : '—' }}
        </li>
      </ul>
      <p v-if="auth.message" class="message">{{ auth.message }}</p>
    </section>

    <section class="card">
      <h2>方式一（推荐）：浏览器窗口登录</h2>
      <p class="tip">弹出的窗口就是真实浏览器，支持 Connect / OAuth / 账密 / 2FA；检测到登录态后自动关闭并落盘 cookie（重启保留）。</p>
      <div class="row">
        <button class="primary" :disabled="auth.loading" @click="auth.openLogin()">打开登录窗口</button>
      </div>
    </section>

    <section class="card">
      <h2>方式二：粘贴 _t cookie（测试用，秒切会话）</h2>
      <p class="tip">浏览器 F12 → Application → Cookies → linux.do → 复制 <code>_t</code> 的值粘贴到这里。</p>
      <div class="row">
        <input v-model="tCookie" placeholder="_t cookie 值" style="flex:1" />
        <button class="primary" :disabled="auth.loading || !tCookie.trim()" @click="pasteCookie">注入</button>
      </div>
    </section>

    <section class="card">
      <h2>方式三：User API Key 授权（linux.do 当前未开放 ⚠️）</h2>
      <p class="tip">
        实测 linux.do 管理员已关闭自助申请（授权页报「页面不存在或是不公开页面」），普通用户无法使用；
        若日后开放或用于其他 Discourse 站点，此通道可直接复用浏览器登录态。
      </p>
      <div class="row">
        <button :disabled="auth.loading" @click="auth.startUserApiKey('system-browser')">系统浏览器授权</button>
        <button :disabled="auth.loading" @click="auth.startUserApiKey('embedded')">应用内窗口授权</button>
        <button v-if="auth.loading" @click="auth.cancelUserApiKey()">取消等待</button>
      </div>
      <p class="tip">浏览器授权后应用会自动收到回调并保存；若浏览器弹出「打开 LinuxDo Desktop?」请选择允许。</p>
    </section>

    <section class="card">
      <h2>方式四：手动填 Api-Key（持有现成 Key 时）</h2>
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
      <h2>翻译服务（OpenAI 兼容）</h2>
      <p class="tip">
        用于楼内「译」按钮的双语翻译。填任意 OpenAI 兼容端点（如 https://api.openai.com/v1 或自建网关）。
        API Key 以系统加密存储在本机。状态：{{ trConfigured ? '✅ 已配置' : '未配置' }}
      </p>
      <input v-model="trBaseUrl" placeholder="Base URL，如 https://api.openai.com/v1" />
      <input v-model="trModel" placeholder="模型，如 gpt-4o-mini" />
      <input v-model="trKey" placeholder="API Key（留空表示不修改）" type="password" />
      <div class="row">
        <button class="primary" :disabled="trSaving || !trBaseUrl || !trModel" @click="saveTranslate">
          {{ trSaving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p v-if="trMessage" class="message">{{ trMessage }}</p>
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
