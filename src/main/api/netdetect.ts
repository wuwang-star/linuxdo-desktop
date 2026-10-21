/**
 * 冷启动黄金路径·网络检测编排（10-21-golden-path，分区 A）。
 *
 * 三步检测（交互真源 research/golden-path-mockup.html 屏 2）：DNS 解析 → ECH 直连测试 → 站点连通。
 * 只读复用既有能力、不改 dohProxy/echGateway 内部：diagResolve（DoH/系统解析链）、
 * ensureRunning/gatewayAvailable（ECH 网关既有探测与幂等拉起）、net.fetch（defaultSession
 * 既有代理接管态出站）。结论三态：direct-ok / need-shield / fail；整体 15s 超时落 fail。
 *
 * need-shield 判据（SNI 阻断特征）：DNS 可达 + 直连出站网络层失败（未拿到任何 HTTP 响应）
 * + ECH 引擎可用——三者同时成立才引导过盾，杜绝把可直连用户带进过盾流程的假阳性。
 * 文案规范 R8：note/reason 一律给结论+下一步动作，不裸奔状态码。
 */
import { net, session } from 'electron'
import { USER_AGENT } from './client'
import { diagResolve } from './dohProxy'
import { ensureRunning, gatewayAvailable } from './echGateway'
import { getDohConfig } from './settings'

export type DetectVerdict = 'direct-ok' | 'need-shield' | 'fail'
export type DetectStepIndex = 0 | 1 | 2
export type DetectStepState = 'run' | 'ok' | 'bad'

/** 步骤进度事件（net:detect:step 通道，渲染层逐步点亮） */
export interface DetectStepEvent {
  step: DetectStepIndex
  state: DetectStepState
}

export interface DetectStepResult {
  ok: boolean
  /** 人类可读结论（R8） */
  note: string
}

export interface DetectResult {
  verdict: DetectVerdict
  steps: [DetectStepResult, DetectStepResult, DetectStepResult]
  /** 总结论一句话（R8：结论+下一步动作） */
  reason: string
}

const OVERALL_TIMEOUT_MS = 15_000
const PROBE_TIMEOUT_MS = 8_000

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function tup(s: DetectStepResult[]): [DetectStepResult, DetectStepResult, DetectStepResult] {
  return [s[0], s[1], s[2]]
}

async function detect(emit: (e: DetectStepEvent) => void): Promise<DetectResult> {
  const steps: DetectStepResult[] = [
    { ok: false, note: '未检测' },
    { ok: false, note: '未检测' },
    { ok: false, note: '未检测' }
  ]
  const skip: DetectStepResult = { ok: false, note: '已跳过（前面步骤未通过）' }

  // ---- 步 1 · DNS 解析：DoH 优先（绕污染），失败回退系统解析 ----
  emit({ step: 0, state: 'run' })
  let dnsOk = false
  try {
    const r = await diagResolve('linux.do')
    const via = r.via === 'doh' ? '加密 DNS' : r.via === 'fallback' ? '系统 DNS' : '本机地址'
    steps[0] = { ok: true, note: `解析成功（${via}）` }
    dnsOk = true
  } catch {
    try {
      const { endpoints } = await session.defaultSession.resolveHost('linux.do')
      if (endpoints.length > 0) {
        steps[0] = { ok: true, note: '解析成功（系统 DNS）' }
        dnsOk = true
      } else {
        steps[0] = { ok: false, note: '域名解析不到地址：DNS 服务异常或网络未连接' }
      }
    } catch {
      steps[0] = { ok: false, note: '域名解析不到地址：DNS 服务异常或网络未连接' }
    }
  }
  emit({ step: 0, state: steps[0].ok ? 'ok' : 'bad' })
  if (!dnsOk) {
    emit({ step: 1, state: 'bad' })
    emit({ step: 2, state: 'bad' })
    return {
      verdict: 'fail',
      steps: [steps[0], skip, skip],
      reason: '域名无法解析：请先确认本机网络已连接，再点「重新检测」'
    }
  }

  // ---- 步 2 · ECH 直连测试：复用 echGateway 既有探测/幂等拉起能力 ----
  emit({ step: 1, state: 'run' })
  let echOk = false
  if (!gatewayAvailable()) {
    steps[1] = { ok: false, note: 'ECH 引擎缺失（安装不完整），可改用代理' }
  } else {
    try {
      const port = await ensureRunning(getDohConfig().template)
      steps[1] = { ok: true, note: `ECH 引擎就绪（本地 ${port} 端口）` }
      echOk = true
    } catch (e) {
      steps[1] = { ok: false, note: `ECH 引擎未能启动：${errText(e)}` }
    }
  }
  emit({ step: 1, state: echOk ? 'ok' : 'bad' })

  // ---- 步 3 · 站点连通：about.json 轻探（拿到任何 HTTP 响应即算连通） ----
  emit({ step: 2, state: 'run' })
  let reachable = false
  try {
    const res = await net.fetch('https://linux.do/about.json', {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    reachable = true
    steps[2] = res.ok
      ? { ok: true, note: 'linux.do 可达' }
      : { ok: true, note: 'linux.do 已连通（站点校验层会随登录自动处理）' }
  } catch {
    steps[2] = { ok: false, note: '无法建立到 linux.do 的连接：直连被拦截或网络中断' }
  }
  emit({ step: 2, state: steps[2].ok ? 'ok' : 'bad' })

  if (reachable) {
    return { verdict: 'direct-ok', steps: tup(steps), reason: '直连正常：无需过盾，登录后即可使用' }
  }
  if (echOk) {
    return {
      verdict: 'need-shield',
      steps: tup(steps),
      reason: '解析正常但直连被拦（SNI 阻断特征）：将自动启用 ECH 加密直连绕过'
    }
  }
  return {
    verdict: 'fail',
    steps: tup(steps),
    reason: '直连不通且 ECH 引擎不可用：请开启代理工具后点「重新检测」'
  }
}

/** 单飞 + 15s 整体门（AC3：超时落 fail）。超时后内部探测继续，但事件静默、结果作废。 */
let inflight: Promise<DetectResult> | null = null

export function runDetect(onStep: (e: DetectStepEvent) => void): Promise<DetectResult> {
  if (inflight) return inflight
  const p = doRun(onStep)
  inflight = p
  void p
    .catch(() => {})
    .then(() => {
      if (inflight === p) inflight = null
    })
  return p
}

async function doRun(onStep: (e: DetectStepEvent) => void): Promise<DetectResult> {
  let aborted = false
  const emit = (e: DetectStepEvent): void => {
    if (!aborted) onStep(e)
  }
  const detectPromise = detect(emit)
  detectPromise.catch(() => {}) // 超时路径不再 await 它，防 unhandled rejection
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      detectPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('detect-timeout')), OVERALL_TIMEOUT_MS)
        timer.unref?.()
      })
    ])
  } catch {
    aborted = true
    const bad: DetectStepResult = { ok: false, note: '检测超时（超过 15 秒无响应）' }
    return {
      verdict: 'fail',
      steps: [bad, bad, bad],
      reason: '网络响应过慢：请确认代理工具已开启系统代理，稍后点「重新检测」'
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
