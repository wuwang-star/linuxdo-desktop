import { BrowserWindow } from 'electron'

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
