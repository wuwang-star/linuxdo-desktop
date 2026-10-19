<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DiagEntry } from '../../../main/api/client'
import type { TranslateConfig } from '../../../main/api/settings'
import type { ThemeMeta } from '../../../main/themes'
import {
  DEFAULT_PREFS,
  applyPrefs,
  loadPrefs,
  normalizePrefs,
  savePrefs,
  type FontFamilyPref,
  type ListStylePref,
  type ReadingPrefs,
  type ThemePref,
  type WidthPref
} from '../utils/prefs'
import { applyAllProgress, collectAllProgress } from '../utils/progress'
import { applyThemeById, BUILTIN_THEMES, loadSelectedThemeId } from '../utils/themes'

// ---- 分类导航（顺序对齐参考项目：FluxDO 外观/偏好/网络/通知/日志/关于） ----
const sections = [
  { key: 'appearance', label: '外观' },
  { key: 'reading', label: '阅读' },
  { key: 'notifications', label: '通知' },
  { key: 'network', label: '网络' },
  { key: 'translate', label: '翻译' },
  { key: 'sync', label: '同步' },
  { key: 'shortcuts', label: '快捷键' },
  { key: 'logs', label: '日志' },
  { key: 'about', label: '关于' }
] as const
type SectionKey = (typeof sections)[number]['key']
const active = ref<SectionKey>('appearance')

// ---- 外观：主题模式（renderer 本地偏好 ldd-reading，即时生效） ----
const themePref = ref<ThemePref>(loadPrefs().theme)
const themes: { value: ThemePref; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' }
]

function applyThemePref(): void {
  const p = loadPrefs()
  p.theme = themePref.value
  savePrefs(p)
  applyPrefs(p)
  // 主题镜像到主进程：nativeTheme.themeSource + titleBarOverlay 跟随（失败静默）
  void window.api.setTheme(themePref.value).catch(() => {})
}

// ---- 外观：主题工坊（皮肤=声明式 CSS；应用机制见 utils/themes.ts） ----
interface ThemeRow {
  id: string
  name: string
  author?: string
  version: string
  builtin: boolean
}
const currentThemeId = ref(loadSelectedThemeId())
const importedThemes = ref<ThemeMeta[]>([])
const themeMessage = ref('')

const themeRows = computed<ThemeRow[]>(() => [
  { id: '', name: '默认', author: '内置', version: '-', builtin: true },
  ...BUILTIN_THEMES.map((t) => ({
    id: t.id,
    name: t.name,
    author: t.author,
    version: t.version,
    builtin: true
  })),
  ...importedThemes.value
    .filter((t) => !BUILTIN_THEMES.some((b) => b.id === t.id))
    .map((t) => ({ id: t.id, name: t.name, author: t.author, version: t.version, builtin: false }))
])

async function refreshThemes(): Promise<void> {
  importedThemes.value = await window.api.themesList().catch(() => [])
}

async function selectTheme(id: string): Promise<void> {
  const ok = await applyThemeById(id)
  if (ok) {
    currentThemeId.value = id
    themeMessage.value = ''
  } else {
    themeMessage.value = '主题加载失败（文件缺失或已损坏）'
  }
}

async function importTheme(): Promise<void> {
  themeMessage.value = ''
  const res = await window.api.themesImport()
  if (res.canceled) return
  if (!res.ok || !res.theme) {
    themeMessage.value = res.error ?? '导入失败'
    return
  }
  await refreshThemes()
  await selectTheme(res.theme.id)
  themeMessage.value = `已导入并应用：${res.theme.name}`
}

async function exportTheme(row: ThemeRow): Promise<void> {
  themeMessage.value = ''
  const pkg = row.builtin ? BUILTIN_THEMES.find((t) => t.id === row.id) : await window.api.themesGet(row.id)
  if (!pkg) {
    themeMessage.value = '主题读取失败'
    return
  }
  const res = await window.api.themesExportData(pkg)
  if (res.canceled) return
  themeMessage.value = res.ok ? `已导出：${res.path}` : (res.error ?? '导出失败')
}

async function removeTheme(row: ThemeRow): Promise<void> {
  themeMessage.value = ''
  await window.api.themesRemove(row.id)
  if (currentThemeId.value === row.id) await selectTheme('')
  await refreshThemes()
}

// ---- 阅读：排版偏好（字号/行距/字体/宽度，即时生效 + localStorage 持久化） ----
const reading = ref<ReadingPrefs>(loadPrefs())
const lineHeights: { value: number; label: string }[] = [
  { value: 1.5, label: '1.5' },
  { value: 1.7, label: '1.7' },
  { value: 1.9, label: '1.9' }
]
const fontFamilies: { value: FontFamilyPref; label: string }[] = [
  { value: 'system', label: '系统默认' },
  { value: 'serif', label: '衬线' },
  { value: 'sans', label: '无衬线' },
  { value: 'mono', label: '等宽' }
]
const widths: { value: WidthPref; label: string }[] = [
  { value: 'full', label: '全宽' },
  { value: 960, label: '960' },
  { value: 1120, label: '1120' },
  { value: 1280, label: '1280' }
]
const listStyles: { value: ListStylePref; label: string }[] = [
  { value: 'float', label: '悬浮' },
  { value: 'card', label: '卡片' },
  { value: 'compact', label: '紧凑' }
]

function updateReading(patch: Partial<ReadingPrefs>): void {
  reading.value = { ...reading.value, ...patch }
  savePrefs(reading.value)
  applyPrefs(reading.value)
}

function resetReading(): void {
  reading.value = { ...DEFAULT_PREFS }
  savePrefs(reading.value)
  applyPrefs(reading.value)
}

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

// ---- 上游代理（10-18 网络设置 FluxDO 化：manual 显式配置最可靠，保存即时生效） ----
const proxyMode = ref<'ech' | 'manual' | 'system' | 'off'>('system')
const proxyHost = ref('127.0.0.1')
const proxyPort = ref(7890)
const proxySaving = ref(false)
const proxyMessage = ref('')
const proxyTesting = ref(false)
const proxyTestMsg = ref('')

async function saveNetwork(): Promise<void> {
  if (proxySaving.value) return
  proxySaving.value = true
  proxyMessage.value = ''
  try {
    await window.api.setNetworkConfig(proxyMode.value, proxyHost.value.trim(), Number(proxyPort.value) || 0)
    proxyMessage.value = '已保存并即时生效'
  } catch (e) {
    proxyMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    proxySaving.value = false
  }
}

async function testProxy(): Promise<void> {
  if (proxyTesting.value) return
  proxyTesting.value = true
  proxyTestMsg.value = ''
  try {
    const res = await window.api.testUpstream(proxyHost.value.trim(), Number(proxyPort.value) || 0)
    proxyTestMsg.value = res.ok ? `✅ 经 ${proxyHost.value.trim()}:${proxyPort.value} 连接 linux.do 可达（${res.ms}ms）` : `❌ ${res.error ?? '不可达'}`
  } catch (e) {
    proxyTestMsg.value = `❌ ${e instanceof Error ? e.message : String(e)}`
  } finally {
    proxyTesting.value = false
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
    const label =
      res.via === 'doh'
        ? 'DoH 加密'
        : res.via === 'fallback'
          ? 'DoH 失败回退系统'
          : res.via === 'upstream'
            ? `经上游转发（${res.addresses?.[0] ?? ''}）`
            : '系统 DNS'
    dnsResult.value = res.ok
      ? `链路正常 · ${label}${res.via === 'upstream' ? '' : `：${res.addresses?.join(', ') || '（无地址）'}`}`
      : `解析失败：${res.error ?? '未知错误'}`
  } catch (e) {
    dnsResult.value = `解析失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    dohTesting.value = false
  }
}

// ---- 同步：WebDAV 手动推送/拉取 ----
const wdServer = ref('')
const wdUsername = ref('')
const wdPassword = ref('')
const wdRemoteDir = ref('')
const wdHasPassword = ref(false)
const wdTesting = ref(false)
const wdBusy = ref(false)
const wdTestMessage = ref('')
const wdOpMessage = ref('')

/** 落盘当前表单（密码留空 = 不修改已存密码）；密码只在主进程，后续操作都读取已存配置 */
async function saveWebdav(): Promise<void> {
  const cfg = await window.api.setWebdavConfig(
    wdServer.value,
    wdUsername.value,
    wdRemoteDir.value,
    wdPassword.value ? wdPassword.value : undefined
  )
  wdServer.value = cfg.server
  wdUsername.value = cfg.username
  wdRemoteDir.value = cfg.remoteDir
  wdHasPassword.value = cfg.hasPassword
  wdPassword.value = ''
}

async function testWebdav(): Promise<void> {
  if (wdTesting.value) return
  wdTesting.value = true
  wdTestMessage.value = ''
  try {
    await saveWebdav()
    const res = await window.api.webdavTestConn()
    if (res.ok) wdTestMessage.value = '✅ 连接成功'
    else wdTestMessage.value = `${res.needMkCol ? '⚠️' : '❌'} ${res.error ?? '连接失败'}`
  } catch (e) {
    wdTestMessage.value = `❌ ${e instanceof Error ? e.message : String(e)}`
  } finally {
    wdTesting.value = false
  }
}

async function pushWebdav(): Promise<void> {
  if (wdBusy.value) return
  wdBusy.value = true
  wdOpMessage.value = ''
  try {
    await saveWebdav()
    const res = await window.api.webdavPush()
    wdOpMessage.value = res.ok ? '✅ 已推送到云端（本地覆盖云端）' : `❌ 推送失败：${res.error ?? '未知错误'}`
  } catch (e) {
    wdOpMessage.value = `❌ 推送失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    wdBusy.value = false
  }
}

async function pullWebdav(): Promise<void> {
  if (wdBusy.value) return
  wdBusy.value = true
  wdOpMessage.value = ''
  try {
    await saveWebdav()
    const res = await window.api.webdavPull()
    wdOpMessage.value = res.ok
      ? `✅ 已拉取并应用（云端覆盖本地${res.exportedAt ? `，数据时间 ${res.exportedAt}` : ''}）`
      : `❌ 拉取失败：${res.error ?? '未知错误'}`
  } catch (e) {
    wdOpMessage.value = `❌ 拉取失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    wdBusy.value = false
  }
}

// ---- 全局快捷键（主进程注册；切换即时生效，注册失败逐项透出不互相影响） ----
type ShortcutKind = 'callWindow' | 'nextTopic'
const scCallWindow = ref(true)
const scNextTopic = ref(false)
const scSaving = ref(false)
const scMessage = ref('')
const scErrors = ref<{ callWindow: string | null; nextTopic: string | null }>({ callWindow: null, nextTopic: null })

async function saveShortcut(kind: ShortcutKind): Promise<void> {
  if (scSaving.value) return
  scSaving.value = true
  scMessage.value = ''
  try {
    const enabled = kind === 'callWindow' ? scCallWindow.value : scNextTopic.value
    const st = await window.api.setShortcutEnabled(kind, enabled)
    scCallWindow.value = st.callWindow.enabled
    scNextTopic.value = st.nextTopic.enabled
    scErrors.value = { callWindow: st.callWindow.error, nextTopic: st.nextTopic.error }
  } catch (e) {
    // 失败回滚 UI 态，避免显示与实际不符
    if (kind === 'callWindow') scCallWindow.value = !scCallWindow.value
    else scNextTopic.value = !scNextTopic.value
    scMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    scSaving.value = false
  }
}

// ---- 日志：请求诊断 ----
const diag = ref<DiagEntry[]>([])

// ---- 关于 ----
const appVersion = __APP_VERSION__

// ---- 同步数据交换响应器：应答主进程的 progress/prefs 请求（WebDAV 推送/拉取时） ----
const offSyncRequest = window.api.onSyncRequest((channel, token, payload) => {
  switch (channel) {
    case 'progress:getAll':
      window.api.syncReply(token, collectAllProgress())
      break
    case 'progress:applyAll':
      applyAllProgress(payload)
      window.api.syncReply(token, true)
      break
    case 'prefs:getAll':
      window.api.syncReply(token, loadPrefs())
      break
    case 'prefs:applyAll': {
      // 远端偏好经 normalizePrefs 归一（脏数据回退默认），写入后即时应用（排版变化立即可见）
      const p = normalizePrefs(payload)
      savePrefs(p)
      applyPrefs(p)
      window.api.syncReply(token, true)
      break
    }
  }
})
onBeforeUnmount(() => offSyncRequest())

onMounted(async () => {
  const wd = await window.api.getWebdavConfig()
  wdServer.value = wd.server
  wdUsername.value = wd.username
  wdRemoteDir.value = wd.remoteDir
  wdHasPassword.value = wd.hasPassword
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
  const net = await window.api.getNetworkConfig()
  proxyMode.value = net.proxyMode
  proxyHost.value = net.proxyHost
  proxyPort.value = net.proxyPort
  const notif = await window.api.getNotificationConfig()
  notifEnabled.value = notif.enabled
  const sc = await window.api.getShortcutsStatus()
  scCallWindow.value = sc.callWindow.enabled
  scNextTopic.value = sc.nextTopic.enabled
  scErrors.value = { callWindow: sc.callWindow.error, nextTopic: sc.nextTopic.error }
  diag.value = await window.api.diagnostics()
  await refreshThemes()
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
      <!-- 外观：主题模式 -->
      <template v-if="active === 'appearance'">
        <section class="card">
          <h2>外观</h2>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">主题模式</div>
              <div class="field-desc">
                跟随系统：系统切换亮暗时实时跟随；亮 / 暗：手动覆盖。全部页面即时生效，无需保存。
              </div>
            </div>
            <div class="seg field-control">
              <label v-for="t in themes" :key="t.value" class="seg-opt">
                <input type="radio" :value="t.value" v-model="themePref" @change="applyThemePref" />
                <span>{{ t.label }}</span>
              </label>
            </div>
          </div>
        </section>

        <!-- 主题工坊：皮肤导入/导出/管理 -->
        <section class="card">
          <h2>主题工坊</h2>
          <div class="settings-banner">
            <span class="banner-icon">🎨</span>
            <span>
              主题包 = 声明式 CSS（配色 token 覆盖 + 样式），<strong>不执行任何脚本</strong>。文件可导入/导出分享；
              主题面向应用内部样式约定编写，应用大版本更新可能使第三方主题错位。
            </span>
          </div>
          <div v-for="row in themeRows" :key="row.id || 'default'" class="field-row">
            <div class="field-main">
              <div class="field-label">
                {{ row.name }}
                <span v-if="currentThemeId === row.id" class="card-badge reco">当前</span>
              </div>
              <div class="field-desc">
                {{ row.author ? `${row.author} · ` : '' }}v{{ row.version }} ·
                {{ row.builtin ? '内置' : '已导入' }}
              </div>
            </div>
            <div class="field-control theme-actions">
              <button v-if="currentThemeId !== row.id" @click="selectTheme(row.id)">应用</button>
              <button @click="exportTheme(row)">导出</button>
              <button v-if="!row.builtin" class="danger" @click="removeTheme(row)">删除</button>
            </div>
          </div>
          <div class="row">
            <button class="primary" @click="importTheme">导入主题…</button>
          </div>
          <p v-if="themeMessage" class="message">{{ themeMessage }}</p>
        </section>
      </template>

      <!-- 阅读：排版偏好 -->
      <template v-else-if="active === 'reading'">
        <section class="card">
          <h2>阅读</h2>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">列表样式</div>
              <div class="field-desc">左侧帖子列表的行形态：悬浮行（默认）/ 卡片流 / 紧凑密排，即时生效</div>
            </div>
            <div class="seg field-control">
              <label v-for="l in listStyles" :key="l.value" class="seg-opt">
                <input
                  type="radio"
                  :value="l.value"
                  :checked="reading.listStyle === l.value"
                  @change="updateReading({ listStyle: l.value })"
                />
                <span>{{ l.label }}</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">正文字号</div>
              <div class="field-desc">正文与主题标题的基础字号（14–20px）</div>
            </div>
            <div class="stepper field-control">
              <button
                :disabled="reading.fontSize <= 14"
                aria-label="减小字号"
                @click="updateReading({ fontSize: reading.fontSize - 1 })"
              >
                −
              </button>
              <span class="stepper-val">{{ reading.fontSize }}px</span>
              <button
                :disabled="reading.fontSize >= 20"
                aria-label="增大字号"
                @click="updateReading({ fontSize: reading.fontSize + 1 })"
              >
                ＋
              </button>
            </div>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">行距</div>
              <div class="field-desc">正文行高倍数</div>
            </div>
            <div class="seg field-control">
              <label v-for="l in lineHeights" :key="l.value" class="seg-opt">
                <input
                  type="radio"
                  :value="l.value"
                  :checked="reading.lineHeight === l.value"
                  @change="updateReading({ lineHeight: l.value })"
                />
                <span>{{ l.label }}</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">正文字体族</div>
              <div class="field-desc">仅作用于正文渲染区（代码块保持等宽字体）</div>
            </div>
            <div class="seg field-control">
              <label v-for="f in fontFamilies" :key="f.value" class="seg-opt">
                <input
                  type="radio"
                  :value="f.value"
                  :checked="reading.fontFamily === f.value"
                  @change="updateReading({ fontFamily: f.value })"
                />
                <span>{{ f.label }}</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">阅读宽度</div>
              <div class="field-desc">主题页内容列最大宽度，居中显示（时间轴不参与）</div>
            </div>
            <div class="seg field-control">
              <label v-for="w in widths" :key="String(w.value)" class="seg-opt">
                <input
                  type="radio"
                  :value="w.value"
                  :checked="reading.width === w.value"
                  @change="updateReading({ width: w.value })"
                />
                <span>{{ w.label }}</span>
              </label>
            </div>
          </div>
          <div class="row">
            <button @click="resetReading">恢复默认</button>
          </div>
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
        <!-- 上游代理（FluxDO network/proxy 同款能力：手动配置最可靠，系统探测易随 Clash 开关漂移） -->
        <section class="card">
          <h2>上游代理</h2>
          <div class="settings-banner">
            <span class="banner-icon">🛰️</span>
            <span>
              应用出站统一经本机代理转发（保存即时生效）。
              <strong>ECH 直连</strong>：本地网关加密 SNI 出站，不开 Clash 也能穿 SNI 阻断（实测 2026-10-19）；
              「手动」填 Clash 混合端口（如 127.0.0.1:7897）为降级备选。
            </span>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">代理来源</div>
              <div class="field-desc">
                ECH 直连：本地网关加密 SNI 出站，不开 Clash 根治 SNI 阻断（推荐） · 手动：固定地址端口（Clash 混合口） ·
                跟随系统：探测系统代理 · 关闭：仅 DoH 直连（无 SNI 阻断的纯污染网络用）
              </div>
            </div>
            <div class="seg field-control">
              <label class="seg-opt">
                <input type="radio" value="ech" v-model="proxyMode" />
                <span>ECH 直连</span>
              </label>
              <label class="seg-opt">
                <input type="radio" value="manual" v-model="proxyMode" />
                <span>手动</span>
              </label>
              <label class="seg-opt">
                <input type="radio" value="system" v-model="proxyMode" />
                <span>跟随系统</span>
              </label>
              <label class="seg-opt">
                <input type="radio" value="off" v-model="proxyMode" />
                <span>关闭</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">代理地址</div>
              <div class="field-desc">HTTP CONNECT 上游（Clash 混合端口/V2Ray HTTP 均可），仅「手动」模式生效；ECH 直连档失败时自动降级到该地址</div>
            </div>
            <div class="field-control">
              <input v-model="proxyHost" class="proxy-host" placeholder="127.0.0.1" :disabled="proxyMode !== 'manual'" />
              <input v-model="proxyPort" class="proxy-port" type="number" min="1" max="65535" placeholder="7890" :disabled="proxyMode !== 'manual'" />
            </div>
          </div>
          <div class="row">
            <button class="primary" :disabled="proxySaving" @click="saveNetwork">
              {{ proxySaving ? '保存中…' : '保存' }}
            </button>
            <button :disabled="proxyTesting || proxyMode === 'off'" @click="testProxy">
              {{ proxyTesting ? '测试中…' : '测试上游连通' }}
            </button>
          </div>
          <p v-if="proxyMessage" class="message">{{ proxyMessage }}</p>
          <p v-if="proxyTestMsg" class="tip dns-result">{{ proxyTestMsg }}</p>
        </section>

        <section class="card">
          <h2>加密 DNS（DoH）</h2>
          <div class="settings-banner">
            <span class="banner-icon">🔒</span>
            <span>
              <strong>本地代理解析已生效</strong>：开启后应用流量统一经本机代理出站（保存即时生效，无需重启）。
              链路=上方「上游代理」配置（经其远程解析）；无上游时用 DoH 解析直连（纯 DNS 污染网络适用）。
            </span>
          </div>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">启用 DoH</div>
              <div class="field-desc">
                默认关闭。用加密解析绕过 DNS 污染（linux.do 位于 Cloudflare，部分网络直连不稳）；关闭则与系统默认行为一致。
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

      <!-- 同步（WebDAV 手动推送/拉取） -->
      <template v-else-if="active === 'sync'">
        <section class="card">
          <h2>WebDAV 同步（手动）</h2>
          <p class="tip">
            把阅读进度、阅读偏好与非凭据设置（网络/通知/翻译端点）推送/拉取到你自备的 WebDAV
            （坚果云 / InfiniCloud / 自建等）。同步数据不含任何密码或登录凭据；无自动合并，冲突时自行选择方向。
          </p>
          <input v-model="wdServer" placeholder="服务器地址，如 https://dav.jianguoyun.com/dav/" />
          <input v-model="wdUsername" placeholder="用户名" />
          <input
            v-model="wdPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="wdHasPassword ? '密码已保存（留空表示不修改）' : '密码（坚果云请用「应用密码」）'"
          />
          <input v-model="wdRemoteDir" placeholder="远端目录（默认 /linuxdo-desktop/）" />
          <div class="row">
            <button class="primary" :disabled="wdTesting || !wdServer" @click="testWebdav">
              {{ wdTesting ? '测试中…' : '测试连接' }}
            </button>
          </div>
          <p v-if="wdTestMessage" class="message">{{ wdTestMessage }}</p>
          <div class="row">
            <button :disabled="wdBusy || !wdServer" @click="pushWebdav">
              {{ wdBusy ? '处理中…' : '推送到云端' }}
            </button>
            <button :disabled="wdBusy || !wdServer" @click="pullWebdav">
              {{ wdBusy ? '处理中…' : '从云端拉取' }}
            </button>
            <span class="tip">推送=本地覆盖云端；拉取=云端覆盖本地</span>
          </div>
          <p v-if="wdOpMessage" class="message">{{ wdOpMessage }}</p>
        </section>
      </template>

      <!-- 全局快捷键（应用最小化/失焦时仍可触发） -->
      <template v-else-if="active === 'shortcuts'">
        <section class="card">
          <h2>全局快捷键</h2>
          <p class="tip">
            应用最小化、隐藏到托盘或失焦时仍可触发，切换即时生效（无需重启）。全局组合键可能与系统 / 其他应用冲突，
            默认仅启用呼出主窗；某项注册失败只影响该项，不影响另一项。
          </p>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">呼出主窗 <code class="accel">Alt+Shift+L</code></div>
              <div class="field-desc">从最小化 / 托盘 / 失焦状态恢复并聚焦主窗口</div>
            </div>
            <label class="switch field-control">
              <input type="checkbox" v-model="scCallWindow" :disabled="scSaving" @change="saveShortcut('callWindow')" />
              <span class="switch-track"></span>
              <span class="switch-thumb"></span>
            </label>
          </div>
          <p v-if="scErrors.callWindow" class="message">⚠️ {{ scErrors.callWindow }}</p>
          <div class="field-row">
            <div class="field-main">
              <div class="field-label">队列下一贴 <code class="accel">Alt+Shift+N</code></div>
              <div class="field-desc">
                按入队顺序切到阅读队列的下一个主题（需正在阅读队列中的主题，无下一贴不动作；默认关闭）
              </div>
            </div>
            <label class="switch field-control">
              <input type="checkbox" v-model="scNextTopic" :disabled="scSaving" @change="saveShortcut('nextTopic')" />
              <span class="switch-track"></span>
              <span class="switch-thumb"></span>
            </label>
          </div>
          <p v-if="scErrors.nextTopic" class="message">⚠️ {{ scErrors.nextTopic }}</p>
          <p v-if="scMessage" class="message">{{ scMessage }}</p>
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
