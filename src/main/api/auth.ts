import { app, BrowserWindow, safeStorage, session } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { generateKeyPairSync, privateDecrypt, randomBytes, constants as cryptoConstants } from 'node:crypto'
import type { KeyObject } from 'node:crypto'
import { setAuthHeadersProvider, fetchCurrentUser, type CurrentUserResponse } from './client'

export type AuthKind = 'user-api-key' | 'admin-api-key'

interface StoredAuth {
  apiKey: string
  apiUsername: string
  kind: AuthKind
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
    if (parsed.apiKey && (parsed.kind === 'user-api-key' || parsed.apiUsername)) return parsed
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
    if (stored.kind === 'user-api-key') {
      // Discourse 用户 API Key 官方认证头
      return { 'User-Api-Key': stored.apiKey }
    }
    return {
      'Api-Key': stored.apiKey,
      'Api-Username': stored.apiUsername
    }
  })
}

/** 手动填入的管理员/用户级 Api-Key（Api-Key + Api-Username 头） */
export function setApiKey(apiKey: string, apiUsername: string): void {
  stored = { apiKey: apiKey.trim(), apiUsername: apiUsername.trim(), kind: 'admin-api-key' }
  persistStored(stored)
}

/** user-api-key 流程拿到 key 后落存（并回填用户名） */
async function setUserApiKey(apiKey: string): Promise<string> {
  stored = { apiKey, apiUsername: '', kind: 'user-api-key' }
  let username = ''
  try {
    const me = await fetchCurrentUser()
    username = me.current_user?.username ?? ''
  } catch {
    /* session_info 失败不影响 key 有效性 */
  }
  stored = { apiKey, apiUsername: username, kind: 'user-api-key' }
  persistStored(stored)
  return username
}

export function clearApiKey(): void {
  stored = null
  persistStored(null)
}

export function hasApiKey(): boolean {
  return stored !== null
}

export function apiKeyKind(): AuthKind | null {
  return stored?.kind ?? null
}

/** Discourse 登录 cookie 是否存在（默认 session，与 API 请求共享） */
export async function hasCookie(): Promise<boolean> {
  const cookies = await session.defaultSession.cookies.get({ url: 'https://linux.do' })
  return cookies.some((c) => c.name === '_t')
}

export interface LoginStatus {
  cookie: boolean
  apiKey: boolean
  apiKeyKind: AuthKind | null
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
  return { cookie, apiKey: hasApiKey(), apiKeyKind: apiKeyKind(), user }
}

/** 登录成功后立刻落盘 cookie 库，避免异常退出丢失会话 */
async function flushCookies(): Promise<void> {
  try {
    await session.defaultSession.cookies.flushStore()
  } catch {
    /* flush 失败不阻塞 */
  }
}

/**
 * 方式一（推荐）：Discourse User API Key 官方流程。
 * 生成 RSA 密钥对 → 内嵌窗口打开授权页 → 用户点授权 →
 * 站点把 {key, nonce} 用公钥加密回传到 auth_redirect → 解密校验后 safeStorage 落存。
 * Key 长期有效，不依赖 cookie，重启即恢复。
 */
export function openUserApiKeyLogin(timeoutMs = 5 * 60 * 1000): Promise<{
  ok: boolean
  username?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const clientId = randomBytes(16).toString('hex')
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const redirect = 'linuxdo-desktop://user-api-key'

    const url = new URL('https://linux.do/user_api_key/new')
    url.searchParams.set('application_name', 'LinuxDo Desktop')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('scopes', 'read,write,session_info,notifications,message_bus')
    url.searchParams.set('public_key', pubPem)
    url.searchParams.set('auth_redirect', redirect)

    const win = new BrowserWindow({
      width: 900,
      height: 900,
      title: '授权 LinuxDo Desktop',
      autoHideMenuBar: true,
      webPreferences: {
        session: session.defaultSession,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    let settled = false
    const finish = (result: { ok: boolean; username?: string; error?: string }): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      if (!win.isDestroyed()) win.close()
      resolve(result)
    }

    let timer: NodeJS.Timeout | undefined = setTimeout(() => finish({ ok: false, error: '授权超时' }), timeoutMs)
    win.on('closed', () => finish({ ok: false, error: '授权窗口已关闭' }))

    // 解密回传 payload（兼容 OAEP-SHA256 / OAEP-SHA1 / PKCS1 三种填充）
    const handlePayload = async (payloadHex: string): Promise<void> => {
      try {
        const buf = Buffer.from(payloadHex, 'hex')
        const attempts: Array<{ padding: number; oaepHash?: string }> = [
          { padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          { padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
          { padding: cryptoConstants.RSA_PKCS1_PADDING }
        ]
        let json: string | undefined
        for (const opt of attempts) {
          try {
            json = privateDecrypt(
              { key: privateKey as KeyObject, padding: opt.padding, oaepHash: opt.oaepHash } as Parameters<
                typeof privateDecrypt
              >[0],
              buf
            ).toString('utf8')
            break
          } catch {
            /* 尝试下一种填充 */
          }
        }
        if (!json) throw new Error('payload 解密失败')
        const parsed = JSON.parse(json) as { key?: string; nonce?: string }
        if (parsed.nonce !== clientId) throw new Error('nonce 校验失败（可能被篡改）')
        if (!parsed.key) throw new Error('站点未返回 key')
        const username = await setUserApiKey(parsed.key)
        finish({ ok: true, username })
      } catch (e) {
        finish({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const intercept = (event: Electron.Event, targetUrl: string): void => {
      try {
        const u = new URL(targetUrl)
        if (u.protocol === 'linuxdo-desktop:') {
          event.preventDefault()
          const payload = u.searchParams.get('payload')
          if (payload) void handlePayload(payload)
          else finish({ ok: false, error: '回调缺少 payload' })
        }
      } catch {
        /* 非 URL 目标忽略 */
      }
    }
    win.webContents.on('will-navigate', intercept)
    win.webContents.on('will-redirect', intercept)

    void win.loadURL(url.toString())
  })
}

/**
 * 方式二（兜底）：嵌入式真实浏览器登录。
 * 支持 linux.do 全部登录途径（Connect/OAuth/账密/2FA），CF 挑战在真实浏览器环境完成。
 * 检测到 _t cookie 即成功，并 flushStore 落盘。
 */
export function openCookieLogin(timeoutMs = 5 * 60 * 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 900,
      height: 900,
      title: '登录 linux.do',
      autoHideMenuBar: true,
      webPreferences: {
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
      if (ok) void flushCookies().then(() => resolve(true))
      else resolve(false)
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

/**
 * 方式三（测试利器）：手动粘贴浏览器里的 _t cookie 值，注入默认 session。
 */
export async function setTCookieManually(value: string): Promise<LoginStatus> {
  const v = value.trim()
  if (v) {
    await session.defaultSession.cookies.set({
      url: 'https://linux.do',
      name: '_t',
      value: v,
      httpOnly: true,
      secure: true,
      sameSite: 'no_restriction',
      expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
    })
    await flushCookies()
  }
  return loginStatus()
}
