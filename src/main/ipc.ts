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
  setTCookieManually
} from './api/auth'
import {
  getTranslateConfig,
  setTranslateConfig,
  getDohConfig,
  setDohConfig,
  getNotificationConfig,
  setNotificationConfig,
  type DohMode
} from './api/settings'
import { translatePostText } from './api/translate'
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
import { fetchUser, fetchUserSummary } from './api/client'
import {
  getWebdavConfig,
  setWebdavConfig,
  testWebdavConn
} from './api/webdav'
import { pushBundle, pullBundle, initSyncReply } from './api/syncdata'

/** 推送广播给所有窗口的 renderer */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIpc(): void {
  initAuth()

  ipcMain.handle('discourse:latest', (_e, page: number) => fetchLatest(page ?? 0))
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
  ipcMain.handle('auth:setApiKey', (_e, key: string, username: string) => {
    setApiKey(key, username)
    return loginStatus()
  })
  ipcMain.handle('auth:clearApiKey', () => {
    clearApiKey()
    return true
  })
  ipcMain.handle('diag:list', () => getDiag())

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
  ipcMain.handle('notifications:list', (_e, page: number) => fetchNotifications(page ?? 1))
  ipcMain.handle('notifications:markRead', () => markNotificationsRead())
  ipcMain.handle('translate:post', (_e, postId: number, text: string) =>
    translatePostText(postId, text)
  )
  ipcMain.handle('settings:getTranslate', () => getTranslateConfig())
  ipcMain.handle('settings:setTranslate', (_e, baseUrl: string, model: string, key?: string) => {
    return setTranslateConfig(baseUrl, model, key)
  })
  // ---------- DoH 加密 DNS（改动重启后生效） ----------
  ipcMain.handle('settings:getDoh', () => getDohConfig())
  ipcMain.handle('settings:setDoh', (_e, enabled: boolean, mode: DohMode, template: string) =>
    setDohConfig(enabled, mode, template)
  )
  // ---------- 原生通知开关（内存即时生效，notify.ts 发送前读取） ----------
  ipcMain.handle('settings:getNotification', () => getNotificationConfig())
  ipcMain.handle('settings:setNotification', (_e, enabled: boolean) => setNotificationConfig(enabled))
  // resolveHost 走 Chromium host resolver（secure 模式下即 DoH 客户端），结果仅作诊断展示。
  // 注：设计稿写的 resolveDNS 在 Electron 44 已移除，此处用替代 API resolveHost。
  ipcMain.handle('diag:resolveDns', async () => {
    try {
      const { endpoints } = await session.defaultSession.resolveHost('linux.do')
      return { ok: true, addresses: endpoints.map((ep) => ep.address) }
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
