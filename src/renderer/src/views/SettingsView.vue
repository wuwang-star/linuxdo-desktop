<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { DiagEntry } from '../../../main/api/client'
import type { TranslateConfig } from '../../../main/api/settings'

// ---- 分类导航（顺序对齐参考项目：FluxDO 外观/偏好/网络/通知/日志/关于） ----
const sections = [
  { key: 'appearance', label: '外观' },
  { key: 'reading', label: '阅读' },
  { key: 'notifications', label: '通知' },
  { key: 'network', label: '网络' },
  { key: 'translate', label: '翻译' },
  { key: 'logs', label: '日志' },
  { key: 'about', label: '关于' }
] as const
type SectionKey = (typeof sections)[number]['key']
const active = ref<SectionKey>('appearance')

// ---- 通知 ----
const notifEnabled = ref(true)
const notifSaving = ref(false)
const notifMessage = ref('')

async function saveNotification(): Promise<void> {
  if (notifSaving.value) return
  notifSaving.value = true
  notifMessage.value = ''
  try {
    const cfg = await window.api.setNotificationConfig(notifEnabled.value)
    notifEnabled.value = cfg.enabled
    notifMessage.value = cfg.enabled ? '已开启系统通知' : '已关闭系统通知（即时生效）'
  } catch (e) {
    // 失败回滚 UI 态，避免显示与实际不符
    notifEnabled.value = !notifEnabled.value
    notifMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    notifSaving.value = false
  }
}

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

// ---- DoH 加密 DNS ----
const dohPresets = [
  'https://edge.1molchuan.top/linuxdo',
  'https://1.1.1.1/dns-query',
  'https://dns.google/dns-query',
  'https://dns.alidns.com/dns-query'
]
const dohEnabled = ref(true)
const dohMode = ref<'secure' | 'auto'>('secure')
const dohTemplate = ref(dohPresets[0])
const dohCustom = ref('')
const dohSaving = ref(false)
const dohMessage = ref('')
const dohTesting = ref(false)
const dnsResult = ref('')

async function saveDoh(): Promise<void> {
  if (dohSaving.value) return
  dohSaving.value = true
  dohMessage.value = ''
  try {
    const tpl = dohTemplate.value === 'custom' ? dohCustom.value : dohTemplate.value
    const res = await window.api.setDohConfig(dohEnabled.value, dohMode.value, tpl)
    // 主进程对模板做 https:// 校验，非法静默回退默认；比对返回值提示用户实际落盘结果
    if (res.template !== tpl) {
      dohMessage.value = `提交的模板非法，已回退默认：${res.template}`
    } else {
      dohMessage.value = '已保存'
    }
  } catch (e) {
    dohMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    dohSaving.value = false
  }
}

async function testDns(): Promise<void> {
  if (dohTesting.value) return
  dohTesting.value = true
  dnsResult.value = ''
  try {
    const res = await window.api.resolveDns()
    dnsResult.value = res.ok
      ? `解析成功（当前运行态）：${res.addresses?.join(', ') || '（无地址）'}`
      : `解析失败：${res.error ?? '未知错误'}`
  } catch (e) {
    dnsResult.value = `解析失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    dohTesting.value = false
  }
}

// ---- 日志：请求诊断 ----
const diag = ref<DiagEntry[]>([])

// ---- 关于 ----
const appVersion = __APP_VERSION__

onMounted(async () => {
  const cfg = await window.api.getTranslateConfig()
  trBaseUrl.value = cfg.baseUrl
  trModel.value = cfg.model
  trConfigured.value = Boolean(cfg.baseUrl) && cfg.hasKey
  const doh = await window.api.getDohConfig()
  dohEnabled.value = doh.enabled
  dohMode.value = doh.mode
  if (dohPresets.includes(doh.template)) {
    dohTemplate.value = doh.template
  } else {
    dohTemplate.value = 'custom'
    dohCustom.value = doh.template
  }
  const notif = await window.api.getNotificationConfig()
  notifEnabled.value = notif.enabled
  diag.value = await window.api.diagnostics()
})
</script>

<template>
  <div class="settings-page">
    <nav class="settings-nav">
      <button
        v-for="s in sections"
        :key="s.key"
        :class="{ active: active === s.key }"
        @click="active = s.key"
      >
        {{ s.label }}
      </button>
    </nav>

    <div class="settings-panel">
      <!-- 外观：诚实占位 -->
      <template v-if="active === 'appearance'">
        <section class="card">
          <h2>外观</h2>
          <p class="tip">主题系统规划中。当前亮/暗配色跟随系统偏好，落地后将在此提供主题与强调色选择。</p>
        </section>
      </template>

      <!-- 阅读：诚实占位 -->
      <template v-else-if="active === 'reading'">
        <section class="card">
          <h2>阅读</h2>
          <p class="tip">全局阅读偏好规划中。当前仅有楼内 per-topic 开关（只看楼主等），在主题页内使用。</p>
        </section>
      </template>

      <!-- 通知 -->
      <template v-else-if="active === 'notifications'">
        <section class="card">
          <h2>原生通知</h2>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">系统通知</div>
              <div class="field-desc">
                收到论坛新通知时弹系统原生通知，点击跳转对应楼层；关闭后仅更新应用内徽标，不再打扰桌面（即时生效，无需重启）。
              </div>
            </div>
            <label class="switch field-control">
              <input type="checkbox" v-model="notifEnabled" :disabled="notifSaving" @change="saveNotification" />
              <span class="switch-track"></span>
              <span class="switch-thumb"></span>
            </label>
          </div>
          <p v-if="notifMessage" class="message">{{ notifMessage }}</p>
        </section>
      </template>

      <!-- 网络 -->
      <template v-else-if="active === 'network'">
        <section class="card">
          <h2>加密 DNS（DoH）</h2>
          <div class="settings-banner">
            <span class="banner-icon">⚗️</span>
            <span>
              <strong>实验功能：当前 Electron 版本下暂未生效</strong>，保留设置以备后续方案，改动需重启应用生效（Chromium
              启动期开关限制）。
            </span>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">启用 DoH</div>
              <div class="field-desc">
                默认开启。用加密解析绕过 DNS 污染（linux.do 位于 Cloudflare，部分网络直连不稳；Cloudflare 域名另附
                ECH 加密收益）；关闭则与系统默认行为一致。
              </div>
            </div>
            <label class="switch field-control">
              <input type="checkbox" v-model="dohEnabled" />
              <span class="switch-track"></span>
              <span class="switch-thumb"></span>
            </label>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">解析模式</div>
              <div class="field-desc">secure：只用加密 DNS，解析失败即断 · auto：加密优先，失败回退系统 DNS（DoH 域被墙的网络选 auto）</div>
            </div>
            <div class="seg field-control">
              <label class="seg-opt">
                <input type="radio" value="secure" v-model="dohMode" :disabled="!dohEnabled" />
                <span>secure</span>
              </label>
              <label class="seg-opt">
                <input type="radio" value="auto" v-model="dohMode" :disabled="!dohEnabled" />
                <span>auto</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">解析器模板</div>
              <div class="field-desc">DoH 服务端地址；自定义需 https:// 开头，非法值保存时自动回退默认</div>
            </div>
            <div class="field-control">
              <select v-model="dohTemplate" :disabled="!dohEnabled">
                <option value="https://edge.1molchuan.top/linuxdo">默认（edge.1molchuan.top）</option>
                <option value="https://1.1.1.1/dns-query">Cloudflare</option>
                <option value="https://dns.google/dns-query">Google</option>
                <option value="https://dns.alidns.com/dns-query">阿里</option>
                <option value="custom">自定义…</option>
              </select>
              <input
                v-if="dohTemplate === 'custom'"
                v-model="dohCustom"
                placeholder="自定义 DoH 模板（https:// 开头）"
                :disabled="!dohEnabled"
              />
            </div>
          </div>
          <div class="row">
            <button class="primary" :disabled="dohSaving" @click="saveDoh">
              {{ dohSaving ? '保存中…' : '保存' }}
            </button>
            <button :disabled="dohTesting" @click="testDns">
              {{ dohTesting ? '解析中…' : '测试解析 linux.do' }}
            </button>
          </div>
          <p v-if="dohMessage" class="message">{{ dohMessage }}</p>
          <p v-if="dnsResult" class="tip dns-result">{{ dnsResult }}</p>
        </section>
      </template>

      <!-- 翻译 -->
      <template v-else-if="active === 'translate'">
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
      </template>

      <!-- 日志 -->
      <template v-else-if="active === 'logs'">
        <section class="card">
          <h2>请求诊断（最近）</h2>
          <p class="tip">主进程统一出口的请求记录（100 条环形缓冲），4xx/网络错误标红。</p>
          <div class="diag">
            <div v-for="(d, i) in diag.slice(0, 20)" :key="i" class="diag-row" :class="{ bad: d.status >= 400 || d.status === 0 }">
              <span class="time">{{ d.time.slice(11, 19) }}</span>
              <span class="method">{{ d.method }}</span>
              <span class="st">{{ d.status }}</span>
              <span class="ms">{{ d.ms }}ms</span>
              <span class="url">{{ d.url.replace('https://linux.do', '') }}</span>
            </div>
            <div v-if="diag.length === 0" class="tip">暂无请求</div>
          </div>
        </section>
      </template>

      <!-- 关于 -->
      <template v-else>
        <section class="card">
          <h2>关于</h2>
          <p>
            <strong>LinuxDo Desktop</strong>
            <span class="settings-version">v{{ appVersion }}</span>
          </p>
          <p class="tip">linux.do 的第三方桌面客户端（Electron + Vue 3，自建 UI 走 Discourse API）。</p>
          <p class="tip">架构与开发约定见仓库内 <code>specs/linuxdo-desktop/SPEC.md</code>；使用与打包说明见 <code>README.md</code>。</p>
        </section>
      </template>
    </div>
  </div>
</template>
