/**
 * 诊断面板 + 网络错误 toast 的轻量总线（10-21-golden-path）。
 * 纯 renderer 响应式单例：AppShell 挂载面板/浮层，任意入口（错误钩子、设置→网络诊断）触发。
 * 文案规范 R8：任何错误给结论+下一步动作，零裸状态码。
 */
import { ref } from 'vue'

/** 三步检测的展示文案（WelcomeView 检测屏与 DiagPanel 共用，顺序与主进程 netdetect 一致） */
export const DETECT_STEPS = [
  { title: 'DNS 解析', desc: '绕过污染，安全的通道查询', bad: '域名解析不到地址，先确认网络已连接' },
  { title: 'ECH 直连测试', desc: '加密服务器名称，绕过 SNI 阻断', bad: 'ECH 引擎不可用，可改走代理' },
  { title: '站点连通', desc: 'linux.do 可达性验证', bad: '无法建立连接：直连被拦或网络中断' }
] as const

// ---------- 诊断面板开关 ----------

export const diagOpen = ref(false)

export function openDiag(): void {
  diagOpen.value = true
}

export function closeDiag(): void {
  diagOpen.value = false
}

// ---------- 网络错误 toast（节流：8s 内多条错误只弹最新一条，防断网刷屏） ----------

export const netToast = ref<{ text: string } | null>(null)

let toastTimer: number | undefined
let lastAt = 0

/** 主进程错误信息 → 面向新用户的一句话（R8：零裸状态码，结论+可行动作） */
export function describeNetError(info: { status: number; kind: 'http' | 'network' }): string {
  if (info.kind === 'network') return '网络请求失败：连接被重置或超时，可点「查看诊断」定位原因'
  if (info.status === 403) return '访问被站点拦截：安全验证临时收紧，稍等 1 分钟通常自动恢复'
  if (info.status === 429) return '操作太快被限流：稍等半分钟再继续即可'
  if (info.status >= 500) return '站点服务临时异常：稍后重试即可'
  return '请求未成功：可点「查看诊断」定位原因'
}

export function showNetErrorToast(info: { status: number; kind: 'http' | 'network'; message: string }): void {
  const now = Date.now()
  if (now - lastAt < 8000) return
  lastAt = now
  netToast.value = { text: describeNetError(info) }
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(dismissNetToast, 8000)
}

export function dismissNetToast(): void {
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer)
    toastTimer = undefined
  }
  netToast.value = null
}
