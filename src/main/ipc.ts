import { ipcMain, BrowserWindow, session, nativeTheme } from 'electron'
import {
  fetchLatest,
  fetchHot,
  fetchTop,
  fetchCategories,
  fetchCategoryTopics,
  fetchSearch,
  fetchTopic,
  fetchPostsByIds,
  createReply,
  likePost,
  unlikePost,
  bookmarkTopic,
  fetchPostRaw,
  updatePost,
  sendTopicTimings,
  fetchNotifications,
  markNotificationsRead,
  getDiag,
  type TopPeriod
} from './api/client'
import {
  initAuth,
  loginStatus,
  openCookieLogin,
  openUserApiKeyLogin,
  cancelPendingUserApiKey,
  setApiKey,
  clearApiKey,
  setTCookieManually,
  saveLoginCred,
  clearLoginCred,
  getLoginCredStatus
} from './api/auth'
import {
  getExternalApiConfig,
  setExternalApiConfig,
  getTranslateConfig,
  setTranslateConfig,
  getDohConfig,
  setDohConfig,
  getNetworkConfig,
  setNetworkConfig,
  getNotificationConfig,
  setNotificationConfig,
  type DohMode,
  type ProxyMode
} from './api/settings'
import { translatePostText } from './api/translate'
import { applyDohRuntime, diagResolve, echDegradeNote, hasUpstreamProxy, isDohProxyActive, testUpstream, upstreamProxyLabel } from './api/dohProxy'
import { applyExternalApiRuntime } from './api/externalApi'
import { connectLogin, getConnectConfig, saveConnectConfig, type ConnectCallbackMode } from './api/connect'
import {
  messageBusStart,
  messageBusStop,
  messageBusStatus,
  type MessageBusMessage
} from './api/messagebus'
import {
  getBridgeStatus,
  setBridgeEnabled,
  regenBridgePair,
  installWizard,
  openSystemLogin
} from './api/bridge'
import { showPushNotification } from './notify'
import { getShortcutsStatus, setShortcutsEnabled, type ShortcutKind } from './api/shortcuts'
import { saveTopic, listTopics, getTopic, removeTopic } from './api/offline'
import { listThemes, getTheme, importTheme, exportThemeData, removeTheme } from './themes'
import { fetchUser, fetchUserSummary, fetchUserActions } from './api/client'
import {
  getWebdavConfig,
  setWebdavConfig,
  testWebdavConn
} from './api/webdav'
import { pushBundle, pullBundle, initSyncReply } from './api/syncdata'
// @scope: golden-path —— 冷启动网络检测编排 + 网络错误广播钩子（10-21-golden-path）
import { runDetect } from './api/netdetect'
import { setNetErrorListener } from './api/client'

/** 推送广播给所有窗口的 renderer */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIpc(): void {
  initAuth()

  ipcMain.handle('discourse:latest', (_e, page: number, order?: 'views' | 'likes' | 'posts') => fetchLatest(page ?? 0, order))
  ipcMain.handle('discourse:hot', (_e, page: number) => fetchHot(page ?? 0))
  ipcMain.handle('discourse:top', (_e, period: TopPeriod, page: number) => fetchTop(period, page ?? 0))
  ipcMain.handle('discourse:categories', () => fetchCategories())
  ipcMain.handle(
    'discourse:categoryTopics',
    (_e, slug: string, id: number, page: number) => fetchCategoryTopics(slug, id, page ?? 0)
  )
  ipcMain.handle('discourse:topic', (_e, id: number) => fetchTopic(id))
  ipcMain.handle('discourse:search', (_e, q: string, page: number) => fetchSearch(q ?? '', page ?? 0))
  ipcMain.handle('discourse:posts', (_e, topicId: number, postIds: number[]) =>
    fetchPostsByIds(topicId, postIds ?? [])
  )
  ipcMain.handle('auth:status', () => loginStatus())
  ipcMain.handle('auth:openLogin', () => openCookieLogin())
  ipcMain.handle('auth:openUserApiKeyLogin', (_e, mode?: 'system-browser' | 'embedded') =>
    openUserApiKeyLogin(mode ?? 'system-browser')
  )
  ipcMain.handle('auth:cancelUserApiKey', () => {
    cancelPendingUserApiKey()
    return true
  })
  ipcMain.handle('auth:setTCookie', (_e, value: string) => setTCookieManually(value ?? ''))
  ipcMain.handle('auth:saveLoginCred', (_e, username: string, password: string) => {
    saveLoginCred(username ?? '', password ?? '')
    return getLoginCredStatus()
  })
  ipcMain.handle('auth:loginCredStatus', () => getLoginCredStatus())
  ipcMain.handle('auth:clearLoginCred', () => clearLoginCred())
  ipcMain.handle('auth:setApiKey', (_e, key: string, username: string) => {
    setApiKey(key, username)
    return loginStatus()
  })
  ipcMain.handle('auth:clearApiKey', () => {
    clearApiKey()
    return true
  })
  ipcMain.handle('diag:list', () => getDiag())
  ipcMain.handle('diag:echNote', () => echDegradeNote())

  // ---------- P1：写操作 / 通知 / 翻译 ----------
  ipcMain.handle('topic:reply', (_e, topicId: number, raw: string, replyTo?: number) =>
    createReply(topicId, raw, replyTo)
  )
  ipcMain.handle('post:like', (_e, postId: number) => likePost(postId))
  ipcMain.handle('post:unlike', (_e, postId: number) => unlikePost(postId))
  ipcMain.handle('topic:bookmark', (_e, topicId: number) => bookmarkTopic(topicId))
  // ---------- 帖子编辑 ----------
  ipcMain.handle('post:getRaw', (_e, postId: number) => fetchPostRaw(postId))
  ipcMain.handle('post:update', (_e, postId: number, raw: string) => updatePost(postId, raw))
  // 阅读回传（10-19-ux-batch）：timings 键=楼层号，值=毫秒；高频小请求，失败由 renderer 静默
  ipcMain.handle('topic:timings', (_e, topicId: number, timings: Record<number, number>, topicTimeMs: number) =>
    sendTopicTimings(Number(topicId ?? 0), timings ?? {}, Number(topicTimeMs ?? 0))
  )
  ipcMain.handle('notifications:list', (_e, page: number) => fetchNotifications(page ?? 1))
  ipcMain.handle('notifications:markRead', () => markNotificationsRead())
  ipcMain.handle('translate:post', (_e, postId: number, text: string) =>
    translatePostText(postId, text)
  )
  ipcMain.handle('settings:getTranslate', () => getTranslateConfig())
  ipcMain.handle('settings:setTranslate', (_e, baseUrl: string, model: string, key?: string) => {
    return setTranslateConfig(baseUrl, model, key)
  })
  // ---------- DoH 加密 DNS（本地代理真实现，保存即时生效；契约见 index.d.ts） ----------
  ipcMain.handle('settings:getDoh', () => getDohConfig())
  ipcMain.handle('settings:setDoh', async (_e, enabled: boolean, mode: DohMode, template: string) => {
    const cfg = setDohConfig(enabled, mode, template)
    try {
      await applyDohRuntime()
    } catch {
      /* 代理启停失败不回滚已保存的配置，下次启动 applyDohRuntime 重试 */
    }
    return cfg
  })
  // ---------- 上游代理（10-18 网络设置 FluxDO 化：手动配置最可靠，保存即时生效） ----------
  ipcMain.handle('settings:getNetwork', () => getNetworkConfig())
  ipcMain.handle('settings:setNetwork', async (_e, mode: ProxyMode, host: string, port: number) => {
    const cfg = setNetworkConfig(mode, String(host ?? ''), Number(port ?? 0))
    try {
      await applyDohRuntime()
    } catch {
      /* 启停失败不回滚已保存配置，下次启动重试 */
    }
    return cfg
  })
  ipcMain.handle('net:testUpstream', (_e, host: string, port: number) => testUpstream(String(host ?? ''), Number(port ?? 0)))

  // ---------- @scope: golden-path 冷启动黄金路径（10-21）：三步检测 + ECH 一键接入 + 错误广播 ----------
  // 三步检测编排（复用 dohProxy.diagResolve / echGateway 幂等拉起，只读不改内部）；
  // 步骤进度经同一 webContents 事件通道逐步回传（渲染层三步点亮，AC3）
  ipcMain.handle('net:detect', (e) =>
    runDetect((step) => {
      if (!e.sender.isDestroyed()) e.sender.send('net:detect:step', step)
    })
  )
  // Welcome 过盾出口：启用 DoH+ECH 并应用运行时——只调用既有配置/运行时机制，不动过盾内部（R4）
  ipcMain.handle('net:applyEch', async () => {
    const doh = getDohConfig()
    setDohConfig(true, 'auto', doh.template)
    const cfg = setNetworkConfig('ech', '', 0)
    try {
      await applyDohRuntime()
    } catch {
      /* 启动失败不回滚配置：屏上有「仍然失败→降级指引」出口 */
    }
    return cfg
  })
  // 使用中网络错误（discourseRequest 最终失败：403/429/5xx/断网）→ 渲染层 toast（R6 诊断入口）
  setNetErrorListener((info) => broadcast('net:error', info))

  // ---------- AI 数据接口（kb-api）：保存即时启停回环监听 ----------
  ipcMain.handle('settings:getExternal', () => getExternalApiConfig())
  ipcMain.handle('settings:setExternal', async (_e, enabled: boolean, port: number) => {
    const cfg = setExternalApiConfig(Boolean(enabled), Number(port ?? 0))
    try {
      await applyExternalApiRuntime()
    } catch (e) {
      return { ...cfg, error: e instanceof Error ? e.message : String(e) }
    }
    return cfg
  })

  // ---------- 原生通知开关（内存即时生效，notify.ts 发送前读取） ----------
  ipcMain.handle('settings:getNotification', () => getNotificationConfig())
  ipcMain.handle('settings:setNotification', (_e, enabled: boolean) => setNotificationConfig(enabled))
  // 诊断按钮按运行态实测：DoH 代理启用且链到系统代理 → 上游转发（via=upstream）；
  // 启用但直连 → 代理解析链路（via=doh/fallback）；未启用走 Chromium host resolver（via=system）。
  // 注：设计稿写的 resolveDNS 在 Electron 44 已移除，系统路径用替代 API resolveHost。
  ipcMain.handle('diag:resolveDns', async () => {
    try {
      if (isDohProxyActive() && hasUpstreamProxy()) {
        return { ok: true, addresses: [upstreamProxyLabel()], via: 'upstream' as const }
      }
      if (isDohProxyActive()) {
        const r = await diagResolve('linux.do')
        return { ok: true, addresses: r.addresses, via: r.via }
      }
      const { endpoints } = await session.defaultSession.resolveHost('linux.do')
      return { ok: true, addresses: endpoints.map((ep) => ep.address), via: 'system' as const }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
  // ---------- Connect 身份登录（OAuth2，仅身份信息） ----------
  ipcMain.handle('connect:getStatus', () => getConnectConfig())
  ipcMain.handle(
    'connect:saveConfig',
    (_e, clientId: string, callbackMode: ConnectCallbackMode, clientSecret?: string) =>
      saveConnectConfig(clientId, callbackMode, clientSecret)
  )
  ipcMain.handle('connect:login', () => connectLogin())

  // ---------- 窗口控制（自绘窗口钮：最小化/最大化切换/关闭；close 经 index.ts 拦截=隐藏到托盘） ----------
  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  // ---------- MessageBus 实时通知（cookie 登录态由 renderer 在就绪后调用 start） ----------
  ipcMain.handle('messagebus:start', (_e, userId: number) =>
    messageBusStart(userId, (msgs: MessageBusMessage[]) => {
      const notif = msgs.find((m) => m.channel.startsWith('/notification/'))
      if (notif) {
        broadcast('notification:push', notif)
        showPushNotification(notif) // 系统原生通知；点击聚焦主窗，带 topic_id 时跳转楼层
      }
    })
  )
  ipcMain.handle('messagebus:stop', () => {
    messageBusStop()
    return true
  })
  ipcMain.handle('messagebus:status', () => messageBusStatus())

  // ---------- 伴生扩展桥接（Edge 自动同步 _t；开关即启停 127.0.0.1:17366 监听） ----------
  ipcMain.handle('bridge:getStatus', () => getBridgeStatus())
  ipcMain.handle('bridge:setEnabled', (_e, enabled: boolean) => setBridgeEnabled(Boolean(enabled)))
  ipcMain.handle('bridge:regenPair', () => regenBridgePair())
  ipcMain.handle('bridge:installWizard', () => installWizard())
  ipcMain.handle('bridge:openSystemLogin', () => openSystemLogin())

  // ---------- 离线 Topic（保存/列表/读取/删除） ----------
  // 全量拉取进度经同一 webContents 事件通道回传（按钮内文字 n/N 用，非进度条事件）
  ipcMain.handle('offline:save', (e, id: number) =>
    saveTopic(id, (loaded, total) => {
      if (!e.sender.isDestroyed()) e.sender.send('offline:save:progress', { id, loaded, total })
    })
  )
  ipcMain.handle('offline:list', () => listTopics())
  ipcMain.handle('offline:get', (_e, id: number) => getTopic(id))
  ipcMain.handle('offline:remove', (_e, id: number) => removeTopic(id))

  // ---------- 主题工坊（导入/导出/列表/读取/删除；应用与选择在 renderer utils/themes.ts） ----------
  ipcMain.handle('themes:list', () => listThemes())
  ipcMain.handle('themes:get', (_e, id: string) => getTheme(id))
  ipcMain.handle('themes:import', () => importTheme())
  ipcMain.handle('themes:exportData', (_e, theme: unknown) => exportThemeData(theme))
  ipcMain.handle('themes:remove', (_e, id: string) => removeTheme(id))

  // ---------- 用户卡/详情页（Discourse 核心端点） ----------
  ipcMain.handle('user:get', (_e, username: string) => fetchUser(username))
  ipcMain.handle('user:summary', (_e, username: string) => fetchUserSummary(username))
  // 用户动作流（个人页「回复」tab）：filter 归一默认 5=回复，offset 默认 0
  ipcMain.handle('user:actions', (_e, username: string, filter?: number, offset?: number) =>
    fetchUserActions(String(username ?? ''), Number(filter ?? 5), Number(offset ?? 0))
  )

  // ---------- WebDAV 手动同步（推送/拉取 + 进度/偏好的 main↔renderer 交换） ----------
  // renderer 应答通道一次性注册（progress/prefs 请求经 token 匹配，见 syncdata.ts askRenderer）
  initSyncReply()
  ipcMain.handle('webdav:getConfig', () => getWebdavConfig())
  ipcMain.handle(
    'webdav:setConfig',
    (_e, server: string, username: string, remoteDir: string, password?: string) =>
      setWebdavConfig(server, username, remoteDir, password)
  )
  ipcMain.handle('webdav:testConn', () => testWebdavConn())
  ipcMain.handle('webdav:push', (e) => pushBundle(e.sender))
  ipcMain.handle('webdav:pull', (e) => pullBundle(e.sender))

  // ---------- 全局快捷键（呼出主窗 / 队列下一贴；切换即时注册/注销，无需重启） ----------
  ipcMain.handle('shortcuts:getStatus', () => getShortcutsStatus())
  ipcMain.handle('shortcuts:setEnabled', (_e, kind: ShortcutKind, enabled: boolean) =>
    setShortcutsEnabled(kind, Boolean(enabled))
  )

  // ---------- 窗口观感：主题模式（renderer prefs 是单源，此处只做镜像） ----------
  // 设 nativeTheme.themeSource：overlay 配色经 win.ts 的 'updated' 监听统一跟随；
  // themeSource 同时驱动 renderer prefers-color-scheme，与 prefs 的 matchMedia 单轨一致。
  ipcMain.handle('window:setTheme', (_e, theme: 'system' | 'light' | 'dark') => {
    if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return false
    nativeTheme.themeSource = theme
    return true
  })
}
