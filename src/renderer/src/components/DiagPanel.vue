<script setup lang="ts">
/**
 * 使用中网络诊断面板（10-21-golden-path，PRD R6）。
 * 三步检测结论 + 重试 / ECH 一键接入 / 降级出口；入口：全局错误 toast「查看诊断」、设置→网络诊断。
 * 结论规范 R8：任何错误给结论+下一步动作，零裸状态码；检测进度为主进程真实事件（不造假进度）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DETECT_STEPS, closeDiag } from '../utils/diagBus'
import GpFallbackGuide from './GpFallbackGuide.vue'

type StepState = '' | 'run' | 'ok' | 'bad'
type Verdict = 'direct-ok' | 'need-shield' | 'fail' | null

const stepState = ref<StepState[]>(['', '', ''])
const running = ref(false)
const verdict = ref<Verdict>(null)
const reason = ref('')
const showFallback = ref(false)
const echBusy = ref(false)
let offStep: (() => void) | null = null
let seq = 0

function stepMark(state: StepState, i: number): string {
  if (state === 'run') return '…'
  if (state === 'ok') return '✓'
  if (state === 'bad') return '✗'
  return String(i + 1)
}

async function run(): Promise<void> {
  const my = ++seq
  running.value = true
  stepState.value = ['', '', '']
  verdict.value = null
  reason.value = ''
  offStep?.()
  offStep = window.api.onNetDetectStep((s) => {
    if (my === seq) stepState.value[s.step] = s.state as 'run' | 'ok' | 'bad'
  })
  try {
    const r = await window.api.netDetect()
    if (my !== seq) return
    verdict.value = r.verdict
    reason.value = r.reason
  } catch {
    if (my === seq) {
      verdict.value = 'fail'
      reason.value = '诊断无法启动：请重启应用后再试'
    }
  } finally {
    if (my === seq) running.value = false
  }
}

/** need-shield 出口：一键启用 ECH（复用既有配置+运行时机制）后复测，给真实结论 */
async function enableEch(): Promise<void> {
  if (echBusy.value) return
  echBusy.value = true
  try {
    await window.api.applyEchOnboarding()
  } catch {
    /* 接入失败不中断：复测给结论 */
  }
  await run()
  echBusy.value = false
}

const verdictLine = computed(() => {
  switch (verdict.value) {
    case 'direct-ok':
      return '结论：连接正常——刚才的问题多半是站点临时验证。建议：稍等 1 分钟重试刚才的操作'
    case 'need-shield':
      return '结论：线路被拦截，ECH 直连可绕过。建议：点「一键启用 ECH 直连」'
    case 'fail':
      return '结论：当前线路无法直连。建议：开启代理工具的系统代理后点「重试」，或查看降级指引'
    default:
      return ''
  }
})

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeDiag()
}

onMounted(() => {
  void run()
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  offStep?.()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="overlay gp-diag-overlay" @click.self="closeDiag()">
    <div class="gp-panel">
      <button class="gp-close" aria-label="关闭诊断" @click="closeDiag()">×</button>
      <h2>连接出现问题</h2>
      <p class="gp-sub">正在诊断网络，完成后给出结论与下一步建议</p>
      <div class="gp-diag">
        <h4>诊断结论</h4>
        <div v-for="(s, i) in DETECT_STEPS" :key="i" class="gp-step" :class="stepState[i]">
          <span class="st">{{ stepMark(stepState[i], i) }}</span>
          <div>{{ s.title }}<small>{{ stepState[i] === 'bad' ? s.bad : s.desc }}</small></div>
        </div>
      </div>
      <p v-if="verdict" class="gp-verdict" :class="verdict">{{ verdictLine }}</p>
      <p v-else-if="reason" class="gp-verdict">{{ reason }}</p>
      <div class="gp-actions">
        <button class="gp-btn" :disabled="running" @click="run">{{ running ? '诊断中…' : '重试' }}</button>
        <button
          v-if="verdict === 'need-shield'"
          class="gp-btn"
          :disabled="echBusy"
          @click="enableEch"
        >
          {{ echBusy ? '启用中…' : '一键启用 ECH 直连' }}
        </button>
        <button class="gp-btn ghost" @click="showFallback = !showFallback">查看降级指引</button>
      </div>
      <GpFallbackGuide v-if="showFallback" style="margin-top: 14px" />
      <p class="gp-foot" style="position: static; margin-top: 14px">
        诊断入口常驻：设置 → 网络诊断（任何时候可手动触发）
      </p>
    </div>
  </div>
</template>
