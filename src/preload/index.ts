import { contextBridge, ipcRenderer } from 'electron'
import type { TopPeriod } from '../main/api/client'
import type { ThemePackage } from '../main/themes'

const api = {
  fetchLatest: (page: number) => ipcRenderer.invoke('discourse:latest', page),
  fetchHot: (page: number) => ipcRenderer.invoke('discourse:hot', page),
  fetchTop: (period: TopPeriod, page: number) => ipcRenderer.invoke('discourse:top', period, page),
  fetchCategories: () => ipcRenderer.invoke('discourse:categories'),
  fetchCategoryTopics: (slug: string, id: number, page: number) =>
    ipcRenderer.invoke('discourse:categoryTopics', slug, id, page),
  fetchTopic: (id: number) => ipcRenderer.invoke('discourse:topic', id),
  fetchSearch: (q: string, page: number) => ipcRenderer.invoke('discourse:search', q, page),
  fetchPosts: (topicId: number, postIds: number[]) => ipcRenderer.invoke('discourse:posts', topicId, postIds),
  loginStatus: () => ipcRenderer.invoke('auth:status'),
  openLogin: () => ipcRenderer.invoke('auth:openLogin'),
  openUserApiKeyLogin: (mode?: 'system-browser' | 'embedded') =>
    ipcRenderer.invoke('auth:openUserApiKeyLogin', mode),
  cancelUserApiKey: () => ipcRenderer.invoke('auth:cancelUserApiKey'),
  setTCookie: (value: string) => ipcRenderer.invoke('auth:setTCookie', value),
  setApiKey: (key: string, username: string) => ipcRenderer.invoke('auth:setApiKey', key, username),
  clearApiKey: () => ipcRenderer.invoke('auth:clearApiKey'),
  diagnostics: () => ipcRenderer.invoke('diag:list'),
  createReply: (topicId: number, raw: string, replyTo?: number) =>
    ipcRenderer.invoke('topic:reply', topicId, raw, replyTo),
  likePost: (postId: number) => ipcRenderer.invoke('post:like', postId),
  unlikePost: (postId: number) => ipcRenderer.invoke('post:unlike', postId),
  bookmarkTopic: (topicId: number) => ipcRenderer.invoke('topic:bookmark', topicId),
  getPostRaw: (postId: number) => ipcRenderer.invoke('post:getRaw', postId),
  updatePost: (postId: number, raw: string) => ipcRenderer.invoke('post:update', postId, raw),
  fetchNotifications: (page: number) => ipcRenderer.invoke('notifications:list', page),
  markNotificationsRead: () => ipcRenderer.invoke('notifications:markRead'),
  translatePost: (postId: number, text: string) => ipcRenderer.invoke('translate:post', postId, text),
  getTranslateConfig: () => ipcRenderer.invoke('settings:getTranslate'),
  setTranslateConfig: (baseUrl: string, model: string, key?: string) =>
    ipcRenderer.invoke('settings:setTranslate', baseUrl, model, key),
  getDohConfig: () => ipcRenderer.invoke('settings:getDoh'),
  setDohConfig: (enabled: boolean, mode: string, template: string) =>
    ipcRenderer.invoke('settings:setDoh', enabled, mode, template),
  getNotificationConfig: () => ipcRenderer.invoke('settings:getNotification'),
  setNotificationConfig: (enabled: boolean) => ipcRenderer.invoke('settings:setNotification', enabled),
  resolveDns: () => ipcRenderer.invoke('diag:resolveDns'),
  getConnectStatus: () => ipcRenderer.invoke('connect:getStatus'),
  saveConnectConfig: (clientId: string, callbackMode: 'protocol' | 'loopback', clientSecret?: string) =>
    ipcRenderer.invoke('connect:saveConfig', clientId, callbackMode, clientSecret),
  connectLogin: () => ipcRenderer.invoke('connect:login'),
  messageBusStart: (userId: number) => ipcRenderer.invoke('messagebus:start', userId),
  messageBusStop: () => ipcRenderer.invoke('messagebus:stop'),
  messageBusStatus: () => ipcRenderer.invoke('messagebus:status'),
  getBridgeStatus: () => ipcRenderer.invoke('bridge:getStatus'),
  setBridgeEnabled: (enabled: boolean) => ipcRenderer.invoke('bridge:setEnabled', enabled),
  regenBridgePair: () => ipcRenderer.invoke('bridge:regenPair'),
  installWizard: () => ipcRenderer.invoke('bridge:installWizard'),
  openSystemLogin: () => ipcRenderer.invoke('bridge:openSystemLogin'),
  saveOffline: (id: number) => ipcRenderer.invoke('offline:save', id),
  offlineList: () => ipcRenderer.invoke('offline:list'),
  offlineGet: (id: number) => ipcRenderer.invoke('offline:get', id),
  offlineRemove: (id: number) => ipcRenderer.invoke('offline:remove', id),
  themesList: () => ipcRenderer.invoke('themes:list'),
  themesGet: (id: string) => ipcRenderer.invoke('themes:get', id),
  themesImport: () => ipcRenderer.invoke('themes:import'),
  themesExportData: (theme: ThemePackage) => ipcRenderer.invoke('themes:exportData', theme),
  themesRemove: (id: string) => ipcRenderer.invoke('themes:remove', id),
  getUser: (username: string) => ipcRenderer.invoke('user:get', username),
  getUserSummary: (username: string) => ipcRenderer.invoke('user:summary', username),
  getUserActions: (username: string, filter?: number, offset?: number) =>
    ipcRenderer.invoke('user:actions', username, filter, offset),
  // 上游代理（网络设置）：读/存（保存即时生效）/测试上游 CONNECT linux.do
  getNetworkConfig: () => ipcRenderer.invoke('settings:getNetwork'),
  setNetworkConfig: (mode: string, host: string, port: number) => ipcRenderer.invoke('settings:setNetwork', mode, host, port),
  testUpstream: (host: string, port: number) => ipcRenderer.invoke('net:testUpstream', host, port),
  // AI 数据接口（kb-api）
  getExternalApiConfig: () => ipcRenderer.invoke('settings:getExternal'),
  setExternalApiConfig: (enabled: boolean, port: number) => ipcRenderer.invoke('settings:setExternal', enabled, port),
  // WebDAV 手动同步（配置/测试/推送/拉取）
  getWebdavConfig: () => ipcRenderer.invoke('webdav:getConfig'),
  setWebdavConfig: (server: string, username: string, remoteDir: string, password?: string) =>
    ipcRenderer.invoke('webdav:setConfig', server, username, remoteDir, password),
  webdavTestConn: () => ipcRenderer.invoke('webdav:testConn'),
  webdavPush: () => ipcRenderer.invoke('webdav:push'),
  webdavPull: () => ipcRenderer.invoke('webdav:pull'),
  // 全局快捷键（呼出主窗 / 队列下一贴；切换即时生效）
  getShortcutsStatus: () => ipcRenderer.invoke('shortcuts:getStatus'),
  setShortcutEnabled: (kind: 'callWindow' | 'nextTopic', enabled: boolean) =>
    ipcRenderer.invoke('shortcuts:setEnabled', kind, enabled),
  // 主进程 Alt+Shift+N 广播 → renderer 执行队列下一贴跳转（App.vue），返回解绑函数
  onQueueNext: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('queue:next', listener)
    return () => {
      ipcRenderer.removeListener('queue:next', listener)
    }
  },
  // 同步数据交换：主进程发起 progress/prefs 请求（token 匹配），renderer 注册响应器并经 syncReply 应答
  onSyncRequest: (
    cb: (channel: 'prefs:getAll' | 'prefs:applyAll' | 'progress:getAll' | 'progress:applyAll', token: string, payload: unknown) => void
  ) => {
    const channels = ['prefs:getAll', 'prefs:applyAll', 'progress:getAll', 'progress:applyAll'] as const
    const listener = (
      _e: Electron.IpcRendererEvent,
      channel: (typeof channels)[number],
      token: string,
      payload: unknown
    ): void => cb(channel, token, payload)
    for (const ch of channels) ipcRenderer.on(ch, listener)
    return () => {
      for (const ch of channels) ipcRenderer.removeListener(ch, listener)
    }
  },
  syncReply: (token: string, data: unknown) => ipcRenderer.send('syncdata:reply', token, data),
  // 阅读回传（/topics/timings）：posts_read/time_read 统计数据源
  sendTopicTimings: (topicId: number, timings: Record<number, number>, topicTimeMs: number) =>
    ipcRenderer.invoke('topic:timings', topicId, timings, topicTimeMs),
  // 自绘窗口钮（单向 send，无回执）：关闭在主进程被拦截为隐藏到托盘
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winToggleMaximize: () => ipcRenderer.send('win:maximize'),
  winClose: () => ipcRenderer.send('win:close'),
  // 窗口观感：主题模式镜像到主进程（nativeTheme.themeSource，亮暗全局跟随）
  setTheme: (theme: 'system' | 'light' | 'dark') => ipcRenderer.invoke('window:setTheme', theme),
  // 主进程推送订阅：返回解绑函数
  onNotificationPush: (cb: (payload: unknown) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on('notification:push', listener)
    return () => {
      ipcRenderer.removeListener('notification:push', listener)
    }
  },
  // 原生通知点击（主进程已聚焦主窗）：renderer 负责路由跳转，返回解绑函数
  onNotificationOpen: (cb: (payload: { topicId: number; postNumber: number | null }) => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { topicId: number; postNumber: number | null }
    ): void => cb(payload)
    ipcRenderer.on('notification:open', listener)
    return () => {
      ipcRenderer.removeListener('notification:open', listener)
    }
  },
  // 离线保存进度（offline:save 进行中回传 n/N），返回解绑函数
  onSaveProgress: (cb: (payload: { id: number; loaded: number; total: number }) => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { id: number; loaded: number; total: number }
    ): void => cb(payload)
    ipcRenderer.on('offline:save:progress', listener)
    return () => {
      ipcRenderer.removeListener('offline:save:progress', listener)
    }
  }
}

export type ApiBridge = typeof api

contextBridge.exposeInMainWorld('api', api)
