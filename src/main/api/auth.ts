import { app, BrowserWindow, safeStorage, session } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { setAuthHeadersProvider, fetchCurrentUser, type CurrentUserResponse } from './client'

interface StoredAuth {
  apiKey: string
  apiUsername: string
}

const keyFile = (): string => join(app.getPath('userData'), 'auth.enc')

let stored: StoredAuth | null = null

function loadStored(): StoredAuth | null {
  try {
    const file = keyFile()
    if (!existsSync(file)) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    const raw = readFileSync(file)
    const plain = safeStorage.decryptString(raw)
    const parsed = JSON.parse(plain) as StoredAuth
    if (parsed.apiKey && parsed.apiUsername) return parsed
    return null
  } catch {
    return null
  }
}

function persistStored(auth: StoredAuth | null): void {
  const file = keyFile()
  try {
    if (!auth) {
      if (existsSync(file)) rmSync(file)
      return
    }
    if (!safeStorage.isEncryptionAvailable()) {
      // 加密不可用时退化为不落盘（凭据只留在内存，进程退出即失效）
      return
    }
    writeFileSync(file, safeStorage.encryptString(JSON.stringify(auth)))
  } catch {
    /* 存储失败不阻塞主流程 */
  }
}

export function initAuth(): void {
  stored = loadStored()
  setAuthHeadersProvider((): Record<string, string> => {
    if (!stored) return {}
    return {
      'Api-Key': stored.apiKey,
      'Api-Username': stored.apiUsername
    }
  })
}

export function setApiKey(apiKey: string, apiUsername: string): void {
  stored = { apiKey: apiKey.trim(), apiUsername: apiUsername.trim() }
  persistStored(stored)
}

export function clearApiKey(): void {
  stored = null
  persistStored(null)
}

export function hasApiKey(): boolean {
  return stored !== null
}

/** Discourse 登录 cookie 是否存在（默认 session，与 API 请求共享） */
export async function hasCookie(): Promise<boolean> {
  const cookies = await session.defaultSession.cookies.get({ url: 'https://linux.do' })
  return cookies.some((c) => c.name === '_t')
}

export interface LoginStatus {
  cookie: boolean
  apiKey: boolean
  user: CurrentUserResponse['current_user'] | null
}

export async function loginStatus(): Promise<LoginStatus> {
  const cookie = await hasCookie()
  let user: LoginStatus['user'] = null
  if (cookie || hasApiKey()) {
    try {
      const res = await fetchCurrentUser()
      user = res.current_user ?? null
    } catch {
      user = null
    }
  }
  return { cookie, apiKey: hasApiKey(), user }
}

/**
 * 嵌入式登录：打开真实浏览器窗口加载 linux.do/login（默认 session），
 * 轮询 _t cookie 出现即判定成功。Cloudflare 挑战也在真实浏览器环境内完成。
 */
export function openCookieLogin(timeoutMs = 5 * 60 * 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 900,
      height: 900,
      title: '登录 linux.do',
      autoHideMenuBar: true,
      webPreferences: {
        // 登录窗口就是真实浏览器页面：不注入 preload，共享默认 session
        session: session.defaultSession,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    let settled = false
    const finish = (ok: boolean): void => {
      if (settled) return
      settled = true
      clearInterval(timer)
      if (!win.isDestroyed()) win.close()
      resolve(ok)
    }

    const timer = setInterval(() => {
      void hasCookie().then((ok) => {
        if (ok) finish(true)
      })
    }, 1200)

    win.on('closed', () => finish(false))
    setTimeout(() => finish(false), timeoutMs)

    void win.loadURL('https://linux.do/login')
  })
}
