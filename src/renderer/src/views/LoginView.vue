<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import type { BridgeStatus, WizardResult } from '../../../main/api/bridge'

const auth = useAuthStore()
const apiKey = ref('')
const apiUsername = ref('')

// ---- 登录方式 ----
const tCookie = ref('')

// ---- Edge 扩展桥接（方式二卡片内） ----
const bridgeStatus = ref<BridgeStatus | null>(null)
const bridgeEnabled = ref(false)
const bridgeBusy = ref(false)
let bridgeTimer: ReturnType<typeof setInterval> | undefined
let lastSeenPush: string | null = null

async function loadBridge(): Promise<void> {
  try {
    const st = await window.api.getBridgeStatus()
    bridgeStatus.value = st
    bridgeEnabled.value = st.enabled
    // 向导浮层打开时：收到成功推送即切「安装成功」态
    if (wizardOpen.value && st.lastPushOk === true) wizardDone.value = true
    // 有新推送（无论成败）就刷新登录态，让「已登录」状态 10s 内可见
    if (st.lastPushTime && st.lastPushTime !== lastSeenPush) {
      lastSeenPush = st.lastPushTime
      await auth.refresh()
    }
  } catch {
    /* 主进程未就绪等，忽略本次轮询 */
  }
}

async function toggleBridge(): Promise<void> {
  if (bridgeBusy.value) return
  bridgeBusy.value = true
  try {
    bridgeStatus.value = await window.api.setBridgeEnabled(bridgeEnabled.value)
    bridgeEnabled.value = bridgeStatus.value.enabled
  } catch (e) {
    bridgeEnabled.value = !bridgeEnabled.value // 失败回弹开关
    auth.message = e instanceof Error ? e.message : String(e)
  } finally {
    bridgeBusy.value = false
  }
}

async function regenPair(): Promise<void> {
  if (bridgeBusy.value) return
  bridgeBusy.value = true
  try {
    bridgeStatus.value = await window.api.regenBridgePair()
  } finally {
    bridgeBusy.value = false
  }
}

// ---- 安装向导（R6）：浮层三步指引，收到首次成功推送自动切成功态 ----
const wizardOpen = ref(false)
const wizardDone = ref(false)
const wizardBusy = ref(false)
const wizard = ref<WizardResult | null>(null)

async function openWizard(): Promise<void> {
  if (wizardBusy.value) return
  wizardBusy.value = true
  try {
    wizard.value = await window.api.installWizard()
    wizardDone.value = false
    wizardOpen.value = true
  } catch (e) {
    auth.message = e instanceof Error ? e.message : String(e)
  } finally {
    wizardBusy.value = false
  }
}

function closeWizard(): void {
  wizardOpen.value = false
}

function lastPushText(st: BridgeStatus): string {
  if (!st.lastPushTime) return '尚无推送'
  const t = new Date(st.lastPushTime).toLocaleTimeString()
  if (st.lastPushOk === true) return `${t} 推送成功`
  if (st.lastPushOk === false) return `${t} 推送被拒${st.lastError ? `（${st.lastError}）` : '（配对码不正确或请求异常）'}`
  return t
}

// ---- 配对码一键复制（R7）：桥接行与向导浮层共用 ----
const pairCopied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyPair(): Promise<void> {
  const code = bridgeStatus.value?.pairCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    pairCopied.value = true
    if (copyTimer !== undefined) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      pairCopied.value = false
    }, 1500)
  } catch {
    auth.message = '复制失败，请手动选择配对码复制'
  }
}

// ---- 记住账密（safeStorage 密文落盘；登录窗自动填充，不自动提交；登出不联动） ----
const credSt = ref<{ remembered: boolean; username: string }>({ remembered: false, username: '' })
const credEdit = ref(false)
const credUser = ref('')
const credPass = ref('')
const credBusy = ref(false)

async function loadCredStatus(): Promise<void> {
  try {
    credSt.value = await window.api.loginCredStatus()
  } catch {
    /* 主进程未就绪等，忽略 */
  }
}

async function saveCred(): Promise<void> {
  if (credBusy.value) return
  credBusy.value = true
  try {
    credSt.value = await window.api.saveLoginCred(credUser.value, credPass.value)
    credPass.value = ''
    credEdit.value = false
  } catch (e) {
    auth.message = e instanceof Error ? e.message : String(e)
  } finally {
    credBusy.value = false
  }
}

async function clearCred(): Promise<void> {
  try {
    credSt.value = await window.api.clearLoginCred()
  } catch (e) {
    auth.message = e instanceof Error ? e.message : String(e)
  }
}

// ---- 方式一联动（R7）：系统浏览器登录，靠扩展桥接自动同步 ----
const sysLoginReady = computed(() => Boolean(bridgeStatus.value?.enabled && bridgeStatus.value?.extConnectedAt))

async function openSystemLogin(): Promise<void> {
  try {
    await window.api.openSystemLogin()
    auth.message = '已在系统浏览器打开 linux.do 登录页，登录成功会自动同步到应用'
  } catch (e) {
    auth.message = e instanceof Error ? e.message : String(e)
  }
}

// ---- Connect 身份登录 ----
const connClientId = ref('')
const connClientSecret = ref('')
const connMode = ref<'protocol' | 'loopback'>('loopback')
const connSaving = ref(false)
const connLogging = ref(false)
const connMessage = ref('')
const connIdentity = ref<{ username: string; trust_level?: number; email?: string } | null>(null)

async function saveConnect(): Promise<void> {
  if (connSaving.value || !connClientId.value.trim()) return
  connSaving.value = true
  connMessage.value = ''
  try {
    const st = await window.api.saveConnectConfig(
      connClientId.value,
      connMode.value,
      connClientSecret.value ? connClientSecret.value : undefined
    )
    connIdentity.value = st.identity
    connClientSecret.value = ''
    connMessage.value = 'Connect 配置已保存'
  } catch (e) {
    connMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    connSaving.value = false
  }
}

async function connectLoginNow(): Promise<void> {
  if (connLogging.value) return
  connLogging.value = true
  connMessage.value = '已在系统浏览器打开 Connect 授权页…'
  try {
    const res = await window.api.connectLogin()
    if (res.ok) {
      connMessage.value = `Connect 身份验证成功：@${res.username}`
      const st = await window.api.getConnectStatus()
      connIdentity.value = st.identity
    } else {
      connMessage.value = `Connect 授权失败：${res.error ?? '未知错误'}`
    }
  } finally {
    connLogging.value = false
  }
}

async function pasteCookie(): Promise<void> {
  if (!tCookie.value.trim() || auth.loading) return
  await auth.pasteTCookie(tCookie.value)
  tCookie.value = ''
}

onMounted(async () => {
  await auth.refresh()
  await loadCredStatus()
  const conn = await window.api.getConnectStatus()
  connClientId.value = conn.identity ? connClientId.value || '' : connClientId.value
  connMode.value = conn.callbackMode
  connIdentity.value = conn.identity
  await loadBridge()
  // 桥接轮询：捕捉扩展自动推送并刷新登录态（5s，页面卸载即停）
  bridgeTimer = setInterval(() => {
    void loadBridge()
  }, 5000)
})

onUnmounted(() => {
  if (bridgeTimer !== undefined) clearInterval(bridgeTimer)
  if (copyTimer !== undefined) clearTimeout(copyTimer)
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

    <!-- ② 方式一：浏览器窗口登录（推荐，放大置顶；Edge 扩展桥接并入此卡） -->
    <section class="card card-hero">
      <h2>方式一：浏览器窗口登录<span class="card-badge reco">推荐</span></h2>
      <p class="tip">弹出的窗口就是真实浏览器，支持 Connect / OAuth / 账密 / 2FA；检测到登录态后自动关闭并落盘 cookie（重启保留）。</p>
      <div class="row">
        <button class="primary" :disabled="auth.loading" @click="auth.openLogin()">打开登录窗口</button>
        <button :disabled="auth.loading || !sysLoginReady" @click="openSystemLogin">在系统浏览器登录（需扩展桥接）</button>
      </div>

      <!-- 记住账密：加密落盘，登录窗口自动填充（仅填充，由用户确认后手动提交） -->
      <div class="field-row" style="margin-top:8px">
        <div class="field-main">
          <div class="field-label">记住账密</div>
          <div class="field-desc">
            <template v-if="credSt.remembered">
              已记住 <strong>@{{ credSt.username }}</strong>，打开登录窗口时自动填充（需你自己点「登录」，不会自动提交）；登出不会清除，仅点「清除」删除。
            </template>
            <template v-else>
              保存用户名和密码（系统加密存储，仅本机可解），登录窗口打开时自动填充。
            </template>
          </div>
        </div>
        <div class="row" style="margin:0">
          <button @click="credEdit = !credEdit">{{ credSt.remembered ? '更新' : '记住' }}</button>
          <button v-if="credSt.remembered" @click="clearCred">清除</button>
        </div>
      </div>
      <div v-if="credEdit" class="row" style="flex-direction:column; align-items:stretch; gap:6px; margin-bottom:8px">
        <input v-model="credUser" autocomplete="off" :placeholder="credSt.username ? `用户名（当前：@${credSt.username}）` : '用户名'" />
        <input v-model="credPass" type="password" autocomplete="new-password" placeholder="密码" />
        <div class="row">
          <button class="primary" :disabled="credBusy || !credUser.trim() || !credPass" @click="saveCred">
            {{ credBusy ? '保存中…' : '保存' }}
          </button>
          <button @click="credEdit = false; credPass = ''">取消</button>
        </div>
      </div>
      <p v-if="!sysLoginReady" class="tip">系统浏览器登录需先在下方开启「Edge 扩展桥接」并完成扩展安装（未就绪时按钮置灰）。</p>
      <p v-else class="tip">已在系统浏览器登录过？点上方按钮打开 linux.do 登录页，登录成功会自动同步到应用。</p>

      <!-- Edge 扩展桥接：浏览器登录一次，应用自动跟随 -->
      <div class="field-row" style="margin-top:8px">
        <div class="field-main">
          <div class="field-label">Edge 扩展桥接</div>
          <div class="field-desc">
            在 Edge 加载仓库 <code>extension/</code> 目录的扩展并填入配对码后，浏览器里 linux.do
            的 <code>_t</code> 登录态变化会自动同步进应用（仅本机回环 127.0.0.1:17366 + 配对码，详见 extension/README.md）。
          </div>
        </div>
        <label class="switch field-control">
          <input type="checkbox" v-model="bridgeEnabled" :disabled="bridgeBusy" @change="toggleBridge" />
          <span class="switch-track"></span>
          <span class="switch-thumb"></span>
        </label>
      </div>
      <div class="row" style="margin-top:4px">
        <button :disabled="wizardBusy" @click="openWizard">安装到 Edge（向导）</button>
      </div>
      <template v-if="bridgeStatus?.enabled">
        <div class="row" style="align-items:center">
          <code style="font-family:Consolas,monospace; font-size:20px; letter-spacing:6px">
            {{ bridgeStatus.pairCode || '……' }}
          </code>
          <button :disabled="!bridgeStatus.pairCode || pairCopied" @click="copyPair">{{ pairCopied ? '已复制' : '复制' }}</button>
          <button :disabled="bridgeBusy" @click="regenPair">重新生成</button>
          <span class="tip" style="margin:0">
            {{ bridgeStatus.listening ? '监听中' : '未监听' }}
            · {{ bridgeStatus.extConnectedAt ? '扩展已连接' : '扩展未连接' }}
            {{ bridgeStatus.lastError ? ` · ${bridgeStatus.lastError}` : '' }}
          </span>
        </div>
        <p class="tip">最近推送：{{ lastPushText(bridgeStatus) }}</p>
      </template>
      <p v-else class="tip">桥接当前关闭；开启后立即开始监听，关闭即停止（端口不占用）。</p>
    </section>

    <!-- ③ LINUX DO Connect 身份（次级入口） -->
    <section class="card">
      <h2>LINUX DO Connect 身份（OAuth2，实验）</h2>
      <p class="tip">
        用你在 Connect 后台创建的应用（/dash/sso）做身份验证，拿到用户名/信任等级等信息。
        <strong>注意：这只提供身份，无论坛 API 权限</strong>；回帖/通知仍走上面的论坛登录。
      </p>
      <div v-if="connIdentity" class="tr-block" style="margin-bottom:8px">
        <div class="tr-label">Connect 身份</div>
        <div class="tr-text">
          @{{ connIdentity.username }}
          <span v-if="connIdentity.trust_level !== undefined">（信任等级 {{ connIdentity.trust_level }}）</span>
          <span v-if="connIdentity.email"> · {{ connIdentity.email }}</span>
        </div>
      </div>
      <input v-model="connClientId" placeholder="Client ID" />
      <input v-model="connClientSecret" placeholder="Client Secret（留空表示不修改）" type="password" />
      <div class="row">
        <select v-model="connMode" style="flex:1; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--text)">
          <option value="loopback">回调：本地回环 http://127.0.0.1:17365/callback</option>
          <option value="protocol">回调：协议 linuxdo-desktop://connect</option>
        </select>
      </div>
      <p class="tip">回调方式必须与 Connect 后台登记的「回调地址」一致。</p>
      <div class="row">
        <button :disabled="connSaving || !connClientId.trim()" @click="saveConnect">
          {{ connSaving ? '保存中…' : '保存配置' }}
        </button>
        <button class="primary" :disabled="connLogging" @click="connectLoginNow">
          {{ connLogging ? '等待浏览器回调…' : '系统浏览器授权（身份）' }}
        </button>
      </div>
      <p v-if="connMessage" class="message">{{ connMessage }}</p>
    </section>

    <!-- ④ 高级 / 其他方式：原生 details 默认折叠，展开态仅存于本页（不持久化） -->
    <details class="card adv">
      <summary>高级 / 其他方式<span class="sum-hint">_t 注入 · User API Key（已禁用） · 手动 Api-Key</span></summary>

      <section class="card">
        <h2>方式二：粘贴 _t cookie（测试用，秒切会话）</h2>
        <p class="tip">浏览器 F12 → Application → Cookies → linux.do → 复制 <code>_t</code> 的值粘贴到这里。</p>
        <div class="row">
          <input v-model="tCookie" placeholder="_t cookie 值" style="flex:1" />
          <button class="primary" :disabled="auth.loading || !tCookie.trim()" @click="pasteCookie">注入</button>
        </div>
      </section>

    <section class="card">
      <h2>方式三：User API Key 授权<span class="card-badge off">已禁用</span></h2>
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
    </details>

    <section class="card">
      <h2>设置</h2>
      <p class="tip">网络（加密 DNS）、通知、翻译与请求诊断均已移至设置中心。</p>
      <div class="row">
        <RouterLink class="act settings-entry" to="/settings">打开设置中心</RouterLink>
      </div>
    </section>

    <!-- 扩展安装向导浮层：三步指引，桥接口收到首次成功推送即自动切成功态 -->
    <div v-if="wizardOpen" class="overlay" @click.self="closeWizard">
      <div class="card">
        <template v-if="!wizardDone">
          <h2>安装扩展到 Edge</h2>
          <div class="wiz-step">
            <span class="wiz-num">1</span>
            <div>
              已尝试打开 Edge 扩展管理页（<code>edge://extensions</code>，未弹出请手动打开）；在左栏打开<strong>「开发人员模式」</strong>开关。
              <span class="tip">（此步无检测接口，请自行确认已开启）</span>
            </div>
          </div>
          <div class="wiz-step">
            <span class="wiz-num">2</span>
            <div>
              <template v-if="wizard?.mode === 'paste'">
                Edge 已打开：地址栏粘贴 <code>edge://extensions</code>（<strong>已复制到剪贴板</strong>）→ <strong>回车</strong>。
                <span class="tip">（点「加载解压缩」时在弹出的文件夹框中手动导航到下方扩展路径，路径可选中复制）</span>
              </template>
              <template v-else>
                点上方<strong>「加载解压缩」</strong>，在路径栏 <strong>Ctrl+V</strong> 粘贴（扩展路径已复制到剪贴板），选中 <code>extension</code> 文件夹后确认。
              </template>
              <br />
              <strong v-if="bridgeStatus?.extConnectedAt" style="color:var(--accent)">✅ 已检测到扩展</strong>
              <span v-else class="tip">⏳ 等待扩展安装…（实时检测，每 5s 刷新）</span>
            </div>
          </div>
          <div class="wiz-step">
            <span class="wiz-num">3</span>
            <div>完成。点击 Edge 工具栏的扩展图标，填入下方配对码；之后在浏览器里登录 linux.do，登录态会自动同步进应用。</div>
          </div>
          <p class="tip">扩展路径：<code style="user-select:all">{{ wizard?.extPath }}</code></p>
          <p v-if="bridgeStatus?.enabled" class="tip" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            配对码：<code style="font-family:Consolas,monospace; font-size:16px; letter-spacing:3px">{{ bridgeStatus.pairCode }}</code>
            <button :disabled="!bridgeStatus.pairCode || pairCopied" @click="copyPair">{{ pairCopied ? '已复制' : '复制' }}</button>
          </p>
          <p v-else class="tip">桥接未开启：请先关闭本浮层，打开「Edge 扩展桥接」开关生成配对码。</p>
          <p v-if="wizard?.error" class="tip">{{ wizard.error }}</p>
          <p class="tip">等待扩展首次推送…（每 5s 自动检查，成功后本浮层自动关闭指引）</p>
          <div class="row">
            <button @click="closeWizard">关闭</button>
          </div>
        </template>
        <template v-else>
          <h2>✅ 安装成功，登录态已同步</h2>
          <p class="tip">应用已收到扩展推送，登录态更新完成。回到浏览器即可正常使用，无需手动粘贴。</p>
          <div class="row">
            <button class="primary" @click="closeWizard">完成</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
