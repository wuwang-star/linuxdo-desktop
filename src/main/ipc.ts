import { ipcMain } from 'electron'
import {
  fetchLatest,
  fetchCategories,
  fetchCategoryTopics,
  fetchTopic,
  fetchPostsByIds,
  getDiag
} from './api/client'
import { initAuth, loginStatus, openCookieLogin, setApiKey, clearApiKey } from './api/auth'

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
  ipcMain.handle('auth:setApiKey', (_e, key: string, username: string) => {
    setApiKey(key, username)
    return loginStatus()
  })
  ipcMain.handle('auth:clearApiKey', () => {
    clearApiKey()
    return true
  })
  ipcMain.handle('diag:list', () => getDiag())
}
