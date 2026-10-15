import { app, BrowserWindow, Menu, session, Tray, nativeImage, shell } from 'electron'
import { join, resolve } from 'node:path'
import { registerIpc } from './ipc'
import { USER_AGENT, fetchLatest } from './api/client'
import { probeP1 } from './api/probe'
import { handleAuthCallbackUrl } from './api/auth'
import { handleConnectCallbackUrl } from './api/connect'
import { loadDohEarly } from './api/settings'
import { focusMainWindow } from './win'
import { initUpdater } from './updater'

const AUTH_PROTOCOL = 'linuxdo-desktop'

// 关窗 ≠ 退出：点 × 隐藏到托盘，托盘菜单「退出」（或系统退出）才真正退出
let appIsQuitting = false
app.on('before-quit', () => {
  appIsQuitting = true
})

// DoH 命令行开关接线（保留）。注意：dns-over-https-mode/templates 是 Chrome 浏览器层开关，
// Electron 44 的网络服务不消费（v44.0.0 源码核实：system_network_context_manager.cc 的
// OnNetworkServiceCreated 硬编码 SecureDnsMode::kOff），当前实际不生效、DNS 走系统解析；
// 保留接线以备上游支持，真实现（本地 DoH 代理 / host-resolver-rules）另立任务，见 SPEC。
// loadDohEarly 只读 JSON 配置、不碰 safeStorage，可在模块顶层安全调用；enabled=false 时零开关。
const doh = loadDohEarly()
if (doh.enabled) {
  app.commandLine.appendSwitch('enable-features', 'DnsOverHttps')
  app.commandLine.appendSwitch('dns-over-https-mode', doh.mode)
  app.commandLine.appendSwitch('dns-over-https-templates', doh.template)
}

function isAuthCallbackUrl(arg: string): boolean {
  return arg.startsWith(`${AUTH_PROTOCOL}://`)
}

// 单实例锁：浏览器协议回调会拉起第二个实例，必须转发给已运行实例（持有 RSA 私钥）
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    for (const arg of argv) {
      if (isAuthCallbackUrl(arg)) {
        // 路由：payload= → user-api-key；code= → Connect OAuth
        if (!handleAuthCallbackUrl(arg)) handleConnectCallbackUrl(arg)
      }
    }
    focusMainWindow()
  })

  // 注册自定义协议（dev 模式下把入口路径一并写进注册表）
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
  }

  // macOS：系统通过 open-url 事件投递协议回调
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthCallbackUrl(url)
  })

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

  // 托盘常驻：图标 dev 态取 build/，打包态取资源目录（electron-builder extraResources 复制）
  const trayIconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../build/icon.png')
  const trayImage = nativeImage.createFromPath(trayIconPath)
  const tray = new Tray(process.platform === 'win32' ? trayImage.resize({ width: 16, height: 16 }) : trayImage)
  tray.setToolTip('LinuxDo Desktop')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗', click: () => focusMainWindow() },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          appIsQuitting = true
          app.quit()
        }
      }
    ])
  )
  // Windows 左键单击托盘图标恢复窗口（右键弹菜单）
  tray.on('click', () => focusMainWindow())

  // 点 × 隐藏到托盘而非退出；托盘「退出」/before-quit 置位后放行
  win.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  // 自动更新：仅打包态启用，publish 未配置/失败一律静默
  initUpdater()

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
}
