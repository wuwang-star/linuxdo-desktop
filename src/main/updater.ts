import { app, Notification } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import { focusMainWindow } from './win'

const CHECK_DELAY_MS = 30_000

/**
 * 自动更新（GitHub Releases 通道，electron-updater）。
 *
 * 降级链（保证「未就绪不报错」）：
 * - dev 态（!app.isPackaged）完全不启用；
 * - builder.yml 未配置 publish 时打包产物无 resources/app-update.yml → 检测不到即不初始化；
 * - 检查/下载任何失败（离线、无版本、404）一律静默：logger 关闭 + catch 吞掉。
 *
 * 行为：启动延迟 30s 检查一次；下载完成弹原生通知，点击聚焦主窗（重启应用即完成安装）。
 */
export function initUpdater(): void {
  if (!app.isPackaged) return
  if (!existsSync(join(process.resourcesPath, 'app-update.yml'))) return
  autoUpdater.logger = null
  autoUpdater.autoDownload = true
  autoUpdater.on('update-downloaded', () => {
    if (!Notification.isSupported()) return
    const n = new Notification({
      title: 'LinuxDo Desktop 更新已就绪',
      body: '新版本下载完成，重启应用即可完成安装'
    })
    n.on('click', () => focusMainWindow())
    n.show()
  })
  setTimeout(() => {
    try {
      void autoUpdater.checkForUpdates().catch(() => {})
    } catch {
      /* 静默 */
    }
  }, CHECK_DELAY_MS)
}
