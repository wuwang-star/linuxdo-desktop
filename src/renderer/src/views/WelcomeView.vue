<script setup lang="ts">
/**
 * 冷启动黄金路径流程壳（10-21-golden-path，PRD R2/R3/R4/R5）。
 * 交互真源 research/golden-path-mockup.html，逐屏实现：welcome → detect →
 * (shield → connected | fallback) → login → 完成（写 onboardingDone + 进主框架）。
 * mockup 的 ready 屏=主框架缩影+badge，产品化为「进主框架 + AppShell 一次性 badge」（PRD R7）。
 * 检测进度来自主进程 net:detect 真实三步事件（AC4 不造假进度）；过盾屏只包进度 UI，
 * ECH 接入复用既有 DoH+ECH 配置与运行时机制（net:applyEch，机制内部零改动）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { DETECT_STEPS } from '../utils/diagBus'
import { markOnboardingDone } from '../utils/prefs'
import GpFallbackGuide from '../components/GpFallbackGuide.vue'

type Screen = 'welcome' | 'detect' | 'shield' | 'connected' | 'fallback' | 'login'
type StepState = '' | 'run' | 'ok' | 'bad'

const screen = ref<Screen>('welcome')
const router = useRouter()
const auth = useAuthStore()

function go(s: Screen): void {
  screen.value = s
  if (s === 'detect') void runDetect()
  if (s === 'shield') void startShield()
}

// ---- 检测三步（步骤序号→run/ok/bad 逐步点亮；进度事件来自主进程真实探测） ----
const stepState = ref<StepState[]>(['', '', ''])
const detectTip = ref('检测中…')
const verdict = ref<'direct-ok' | 'need-shield' | 'fail' | null>(null)
let offStep: (() => void) | null = null
let detectSeq = 0

function stepMark(state: StepState, i: number): string {
  if (state === 'run') return '…'
  if (state === 'ok') return '✓'
  if (state === 'bad') return '✗'
  return String(i + 1)
}

async function runDetect(): Promise<void> {
  const seq = ++detectSeq
  stepState.value = ['', '', '']
  detectTip.value = '检测中…'
  verdict.value = null
  offStep?.()
  offStep = window.api.onNetDetectStep((s) => {
    if (seq !== detectSeq) return
    stepState.value[s.step] = s.state as 'run' | 'ok' | 'bad'
  })
  try {
    const r = await window.api.netDetect()
    if (seq !== detectSeq) return
    verdict.value = r.verdict
    detectTip.value = r.verdict === 'fail' ? r.reason : '检测完成：本线路可直连，无需过盾'
    if (r.verdict === 'need-shield') detectTip.value = '检测完成：本线路存在 SNI 阻断，将自动启用 ECH 直连'
    const next: Screen = r.verdict === 'need-shield' ? 'shield' : r.verdict === 'fail' ? 'fallback' : 'connected'
    window.setTimeout(() => {
      if (seq === detectSeq) go(next)
    }, 900)
  } catch {
    if (seq === detectSeq) {
      detectTip.value = '检测无法启动：请重启应用后再试'
      go('fallback')
    }
  }
}

// ---- ECH 过盾屏（R4）：只包进度 UI；链路=net:applyEch（既有配置+运行时机制）→ 复测三步 ----
const shieldStep2 = ref<StepState>('run')
const shieldNote = ref('')
let shieldSeq = 0

async function startShield(): Promise<void> {
  const seq = ++shieldSeq
  shieldStep2.value = 'run'
  shieldNote.value = ''
  try {
    await window.api.applyEchOnboarding()
  } catch {
    /* 接入失败不中断：复测会给真实结论 */
  }
  const r = await window.api.netDetect().catch(() => null)
  if (seq !== shieldSeq || !r) return
  verdict.value = r.verdict
  if (r.verdict === 'fail') {
    shieldStep2.value = 'bad'
    shieldNote.value = 'ECH 直连暂未成功：可用下方降级指引改走代理'
  } else {
    go('connected')
  }
}

const connectedSub = computed(() =>
  verdict.value === 'direct-ok'
    ? '直连正常 · 以后每次启动自动连接，无需任何操作'
    : 'ECH 直连已就绪 · 以后每次启动自动连接，无需任何操作'
)

// ---- 登录屏：复用既有登录能力（R2 不重写）——浏览器窗口登录就地完成，其余方式跳 LoginView ----
const loginBusy = ref(false)
const loginMsg = ref('')

async function browserLogin(): Promise<void> {
  if (loginBusy.value) return
  loginBusy.value = true
  loginMsg.value = ''
  try {
    await window.api.openLogin()
    await auth.refresh()
    if (auth.status?.user) {
      finish()
      return
    }
    loginMsg.value = '登录窗口已关闭（未检测到登录态）；可改用其他方式，或先离线逛逛'
  } catch (e) {
    loginMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    loginBusy.value = false
  }
}

/** 完成 onboarding：写标记 + 进主框架（badge 由 AppShell 一次性展示） */
function finish(): void {
  markOnboardingDone()
  void router.push('/')
}

onBeforeUnmount(() => {
  offStep?.()
})
</script>

<template>
  <div class="gp-flow">
    <!-- 1 首启 -->
    <div v-if="screen === 'welcome'" class="gp-screen">
      <div class="gp-logo">L</div>
      <h2>linux.do 桌面端</h2>
      <p class="gp-sub">下载即用，免配置<small>内置 ECH 直连引擎，无需自备代理 · 首次启动将自动检测网络</small></p>
      <div class="gp-btncol">
        <button class="gp-btn" @click="go('detect')">开始检测网络</button>
        <button class="gp-btn ghost" @click="go('login')">跳过，直接登录</button>
      </div>
      <p class="gp-foot">检测全程约 10 秒 · 不上传任何数据</p>
    </div>

    <!-- 2 网络检测（三步真实进度） -->
    <div v-else-if="screen === 'detect'" class="gp-screen">
      <h2>正在检测网络环境</h2>
      <p class="gp-sub">为选择最优连接方式</p>
      <div class="gp-steps">
        <div v-for="(s, i) in DETECT_STEPS" :key="i" class="gp-step" :class="stepState[i]">
          <span class="st">{{ stepMark(stepState[i], i) }}</span>
          <div>{{ s.title }}<small>{{ s.desc }}</small></div>
        </div>
      </div>
      <p class="gp-foot">{{ detectTip }}</p>
    </div>

    <!-- 3 ECH 过盾（进度可视化，机制零改动） -->
    <div v-else-if="screen === 'shield'" class="gp-screen">
      <div class="gp-logo shield">🛡</div>
      <h2>检测到防火墙拦截</h2>
      <p class="gp-sub">正在通过 ECH 加密直连绕过（全自动，无需操作）</p>
      <div class="gp-steps">
        <div class="gp-step ok">
          <span class="st">✓</span>
          <div>拦截原因已确认<small>SNI 阻断 · 运营商线路特征</small></div>
        </div>
        <div class="gp-step" :class="shieldStep2">
          <span class="st">{{ shieldStep2 === 'ok' ? '✓' : shieldStep2 === 'bad' ? '✗' : '…' }}</span>
          <div>
            ECH 隧道建立中
            <small>{{ shieldStep2 === 'bad' ? '本次未能自动建立' : '通常 3–8 秒' }}</small>
          </div>
        </div>
      </div>
      <p v-if="shieldNote" class="gp-sub" style="margin-bottom: 12px">{{ shieldNote }}</p>
      <div class="gp-actions">
        <button class="gp-btn ghost" @click="go('fallback')">仍然失败？查看降级指引</button>
      </div>
    </div>

    <!-- 4 连接成功 -->
    <div v-else-if="screen === 'connected'" class="gp-screen">
      <div class="gp-logo ok">✓</div>
      <h2>连接成功</h2>
      <p class="gp-sub">{{ connectedSub }}</p>
      <div class="gp-btncol">
        <button class="gp-btn" @click="go('login')">下一步：登录 linux.do</button>
      </div>
    </div>

    <!-- 5 登录（复用既有登录能力；Connect/账密跳登录页） -->
    <div v-else-if="screen === 'login'" class="gp-screen">
      <h2>登录 linux.do</h2>
      <p class="gp-sub">三种方式任选，推荐浏览器窗口登录</p>
      <div class="gp-btncol">
        <button class="gp-btn" :disabled="loginBusy" @click="browserLogin">
          {{ loginBusy ? '等待登录窗口…' : '浏览器窗口登录（推荐）' }}
        </button>
        <button class="gp-btn ghost" @click="router.push('/login')">Connect 授权</button>
        <button class="gp-btn ghost" @click="router.push('/login')">账号密码 / API Key</button>
      </div>
      <p v-if="loginMsg" class="gp-sub" style="margin: 14px 0 0">{{ loginMsg }}</p>
      <p class="gp-sub" style="margin: 14px 0 0">
        <a class="gp-link" @click="finish">暂不登录，先离线逛逛</a>
      </p>
      <p class="gp-foot">登录后自动同步已读进度与收藏夹（可在设置配置 WebDAV）</p>
    </div>

    <!-- 7 降级指引（出路 A/B） -->
    <div v-else-if="screen === 'fallback'" class="gp-screen">
      <h2>自动连接未能成功</h2>
      <p class="gp-sub">你的网络对 linux.do 存在深度阻断。两条出路，任选其一：</p>
      <GpFallbackGuide />
      <div class="gp-actions">
        <button class="gp-btn" @click="go('detect')">重新检测</button>
        <button class="gp-btn ghost" @click="finish">先跳过，离线逛</button>
      </div>
    </div>
  </div>
</template>
