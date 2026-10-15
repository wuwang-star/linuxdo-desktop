import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { USER_AGENT, fetchLatest } from './api/client'
import { probeP1 } from './api/probe'

app.whenReady().then(() => {
  // 浏览器级 UA（去 Electron 痕迹），登录窗口与渲染进程共用默认 session
  session.defaultSession.setUserAgent(USER_AGENT)

  registerIpc()

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'LinuxDo Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  // 外链走系统浏览器，不在应用内打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 冒烟模式：窗口可见后输出 SMOKE_OK 并自动退出（CI/验收用）
  if (process.argv.includes('--smoke')) {
    win.once('ready-to-show', () => {
      console.log('SMOKE_OK')
      setTimeout(() => {
        app.quit()
      }, 2000)
    })
  }

  // API 自检模式：用 Electron 网络栈实测 linux.do 连通性（CI/验收用）
  if (process.argv.includes('--api-probe')) {
    void (async () => {
      try {
        const res = await fetchLatest()
        const n = res.topic_list?.topics?.length ?? 0
        console.log(`API_PROBE_OK topics=${n}`)
        if (n > 0) console.log(`API_PROBE_FIRST=${res.topic_list.topics[0]?.title ?? ''}`)
        try {
          await probeP1()
        } catch (e) {
          console.log(`P1_PROBE_SKIP ${e instanceof Error ? e.message : String(e)}`)
        }
      } catch (e) {
        console.error(`API_PROBE_FAIL ${e instanceof Error ? e.message : String(e)}`)
        process.exitCode = 1
      } finally {
        app.quit()
      }
    })()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
