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
  openUserApiKeyLogin: () => ipcRenderer.invoke('auth:openUserApiKeyLogin'),
  setTCookie: (value: string) => ipcRenderer.invoke('auth:setTCookie', value),
  setApiKey: (key: string, username: string) => ipcRenderer.invoke('auth:setApiKey', key, username),
  clearApiKey: () => ipcRenderer.invoke('auth:clearApiKey'),
  diagnostics: () => ipcRenderer.invoke('diag:list'),
  createReply: (topicId: number, raw: string, replyTo?: number) =>
    ipcRenderer.invoke('topic:reply', topicId, raw, replyTo),
  likePost: (postId: number) => ipcRenderer.invoke('post:like', postId),
  unlikePost: (postId: number) => ipcRenderer.invoke('post:unlike', postId),
  bookmarkTopic: (topicId: number) => ipcRenderer.invoke('topic:bookmark', topicId),
  fetchNotifications: (page: number) => ipcRenderer.invoke('notifications:list', page),
  markNotificationsRead: () => ipcRenderer.invoke('notifications:markRead'),
  translatePost: (postId: number, text: string) => ipcRenderer.invoke('translate:post', postId, text),
  getTranslateConfig: () => ipcRenderer.invoke('settings:getTranslate'),
  setTranslateConfig: (baseUrl: string, model: string, key?: string) =>
    ipcRenderer.invoke('settings:setTranslate', baseUrl, model, key)
}

export type ApiBridge = typeof api

contextBridge.exposeInMainWorld('api', api)
