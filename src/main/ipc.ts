import { ipcMain, BrowserWindow, session } from 'electron'
import {
  fetchLatest,
  fetchCategories,
  fetchCategoryTopics,
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
  getDiag
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

/** 推送广播给所有窗口的 renderer */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIpc(): void {
  initAuth()

  ipcMain.handle('discourse:latest', (_e, page: number) => fetchLatest(page ?? 0))
  ipcMain.handle('discourse:categories', () => fetchCategories())
  ipcMain.handle(
    'discourse:categoryTopics',
    (_e, slug: string, id: number, page: number) => fetchCategoryTopics(slug, id, page ?? 0)
  )
  ipcMain.handle('discourse:topic', (_e, id: number) => fetchTopic(id))
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
}
