import { app, BrowserWindow, globalShortcut } from 'electron'
import { getShortcutsConfig, setShortcutEnabled } from './settings'
import { focusMainWindow } from '../win'

/**
 * 全局快捷键（应用最小化/隐藏到托盘/失焦时仍可触发）：
 * - Alt+Shift+L 呼出主窗（默认开）：复用 win.ts focusMainWindow（托盘点击/通知点击同一恢复语义）
 * - Alt+Shift+N 队列下一贴（默认关）：全局组合键易与系统/其他应用冲突；主进程广播 queue:next，
 *   由 renderer（App.vue）执行既有队列 neighbors().next 跳转，无下一贴自然忽略（无副作用）
 */
const ACCEL_CALL_WINDOW = 'Alt+Shift+L'
const ACCEL_NEXT_TOPIC = 'Alt+Shift+N'

export type ShortcutKind = 'callWindow' | 'nextTopic'

/** 单个快捷键状态：enabled=配置开关；registered=当前实际注册成功；error=注册失败原因（透出 UI） */
export interface ShortcutItemStatus {
  enabled: boolean
  registered: boolean
  error: string | null
}

export interface ShortcutsStatus {
  callWindow: ShortcutItemStatus
  nextTopic: ShortcutItemStatus
}

const registered: Record<ShortcutKind, boolean> = { callWindow: false, nextTopic: false }
const errors: Record<ShortcutKind, string | null> = { callWindow: null, nextTopic: null }

function accelOf(kind: ShortcutKind): string {
  return kind === 'callWindow' ? ACCEL_CALL_WINDOW : ACCEL_NEXT_TOPIC
}

/** 队列下一贴：广播给所有窗口 renderer（与 notification:push 同通道模式），跳转逻辑在 App.vue */
function broadcastQueueNext(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('queue:next')
  }
}

/** 按开关注册/注销单个快捷键。先 unregister 清自身残留（幂等，no-op 安全），再按需注册 */
function syncOne(kind: ShortcutKind, enabled: boolean): void {
  const accel = accelOf(kind)
  globalShortcut.unregister(accel)
  if (!enabled) {
    registered[kind] = false
    errors[kind] = null
    return
  }
  const ok = globalShortcut.register(accel, () => {
    if (kind === 'callWindow') focusMainWindow()
    else broadcastQueueNext()
  })
  registered[kind] = ok
  // 组合键被其他应用占用时 register 返回 false：记错误透出 UI，不影响另一快捷键（AC3）
  errors[kind] = ok ? null : `注册失败：${accel} 可能已被其他应用占用`
}

function status(): ShortcutsStatus {
  const cfg = getShortcutsConfig()
  return {
    callWindow: { enabled: cfg.callWindow, registered: registered.callWindow, error: errors.callWindow },
    nextTopic: { enabled: cfg.nextTopic, registered: registered.nextTopic, error: errors.nextTopic }
  }
}

/** 按持久化配置对齐两个快捷键的注册状态（启动与每次切换后调用） */
export function applyShortcuts(): ShortcutsStatus {
  const cfg = getShortcutsConfig()
  syncOne('callWindow', cfg.callWindow)
  syncOne('nextTopic', cfg.nextTopic)
  return status()
}

/** 单独切换一个快捷键（持久化 + 即时注册/注销），互不影响另一项 */
export function setShortcutsEnabled(kind: ShortcutKind, enabled: boolean): ShortcutsStatus {
  setShortcutEnabled(kind, Boolean(enabled))
  return applyShortcuts()
}

export function getShortcutsStatus(): ShortcutsStatus {
  return status()
}

/** 应用启动时按配置注册（whenReady 后调用）；退出统一解绑，避免组合键占用残留 */
export function initShortcuts(): void {
  app.once('will-quit', () => {
    try {
      globalShortcut.unregisterAll()
    } catch {
      /* 退出期解绑失败无意义，静默 */
    }
  })
  applyShortcuts()
}
