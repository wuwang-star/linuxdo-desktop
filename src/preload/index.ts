import { contextBridge, ipcRenderer } from 'electron'

const api = {
  fetchLatest: (page: number) => ipcRenderer.invoke('discourse:latest', page),
  fetchCategories: () => ipcRenderer.invoke('discourse:categories'),
  fetchCategoryTopics: (slug: string, id: number, page: number) =>
    ipcRenderer.invoke('discourse:categoryTopics', slug, id, page),
  fetchTopic: (id: number) => ipcRenderer.invoke('discourse:topic', id),
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
