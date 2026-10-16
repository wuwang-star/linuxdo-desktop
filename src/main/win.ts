import { BrowserWindow, nativeTheme } from 'electron'

/**
 * titleBarOverlay 配色常量，与 src/renderer/src/assets/styles.css 顶栏 token 对齐：
 * .topbar 背景 = --panel（亮 #ffffff / 暗 #1d2126），按钮符号色 = --text（亮 #1b1f24 / 暗 #e6e8ea）。
 */
const TOPBAR_OVERLAY = {
  light: { color: '#ffffff', symbolColor: '#1b1f24' },
  dark: { color: '#1d2126', symbolColor: '#e6e8ea' }
} as const

/** overlay 高度 = .topbar-inner 48px + .topbar border-bottom 1px（styles.css .topbar/.topbar-inner） */
const TOPBAR_HEIGHT = 49

/** 按当前生效亮暗（themeSource 跟随后的 shouldUseDarkColors）取 overlay 配置 */
export function titleBarOverlay(): Electron.TitleBarOverlay {
  const palette = nativeTheme.shouldUseDarkColors ? TOPBAR_OVERLAY.dark : TOPBAR_OVERLAY.light
  return { ...palette, height: TOPBAR_HEIGHT }
}

/**
 * 窗口观感主题联动：themeSource（含 system 模式下 OS 亮暗切换）变化触发 nativeTheme
 * 'updated'，把所有窗口的 titleBarOverlay 刷成对应配色。renderer 经 window:setTheme
 * ipc 设 themeSource 即可，overlay 由这里统一跟随，无双轨。
 */
export function initThemeOverlay(): void {
  nativeTheme.on('updated', () => {
    const overlay = titleBarOverlay()
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        win.setTitleBarOverlay(overlay)
      } catch {
        /* 未启用 overlay 或平台不支持：静默 */
      }
    }
  })
}

/**
 * 恢复并聚焦主窗：托盘点击/托盘菜单、原生通知点击、second-instance 三处共用。
 * 覆盖三种状态：普通失焦（仅 focus）、最小化（restore）、隐藏到托盘（show）。
 */
export function focusMainWindow(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
  }
}
