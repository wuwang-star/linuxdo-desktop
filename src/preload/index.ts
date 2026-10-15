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
  setApiKey: (key: string, username: string) => ipcRenderer.invoke('auth:setApiKey', key, username),
  clearApiKey: () => ipcRenderer.invoke('auth:clearApiKey'),
  diagnostics: () => ipcRenderer.invoke('diag:list')
}

export type ApiBridge = typeof api

contextBridge.exposeInMainWorld('api', api)
