import { app, BrowserWindow, safeStorage, session, shell } from 'electron'
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
  loadLoginCred()
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
 * 生成 RSA 密钥对 → 打开授权页（系统浏览器或内嵌窗口）→ 用户点授权 →
 * 站点把 {key, nonce} 用公钥加密回传到 linuxdo-desktop:// → 解密校验后 safeStorage 落存。
 * Key 长期有效，不依赖 cookie，重启即恢复。
 *
 * 系统浏览器模式：授权页带着用户浏览器里已登录的 linux.do 会话打开，
 * 一点授权即可；回调经 OS 协议拉起应用（单实例锁转发到本进程）。
 */

export type UserApiKeyResult = { ok: boolean; username?: string; error?: string }
export type AuthCallback = (result: UserApiKeyResult) => void

interface PendingAuth {
  privateKey: KeyObject
  clientId: string
  finish: AuthCallback
}

let pendingAuth: PendingAuth | null = null

/** 用户手动取消等待浏览器回调（如站点未开放授权页时） */
export function cancelPendingUserApiKey(): void {
  const pending = pendingAuth
  if (!pending) return
  pendingAuth = null
  pending.finish({ ok: false, error: '已取消等待授权' })
}

/** 处理 linuxdo-desktop://user-api-key?payload=... 回调（来自 second-instance / open-url / 内嵌窗口拦截） */
export function handleAuthCallbackUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'linuxdo-desktop:') return false
  // 只处理 user-api-key 回调（payload）；其余（如 connect 的 code）交由 connect 模块处理
  if (!u.searchParams.has('payload')) return false
  const pending = pendingAuth
  if (!pending) return true // 无待授权请求（如冷启动误触发），静默忽略
  const payload = u.searchParams.get('payload')
  pendingAuth = null
  if (!payload) {
    pending.finish({ ok: false, error: '回调缺少 payload' })
    return true
  }
  void decryptAndStore(pending.privateKey, pending.clientId, payload, pending.finish)
  return true
}

/** 解密回传 payload（兼容 OAEP-SHA256 / OAEP-SHA1 / PKCS1 三种填充），校验 nonce 后落存 */
async function decryptAndStore(
  privateKey: KeyObject,
  clientId: string,
  payloadHex: string,
  finish: AuthCallback
): Promise<void> {
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
          { key: privateKey, padding: opt.padding, oaepHash: opt.oaepHash } as Parameters<
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

function buildAuthorizeUrl(clientId: string, pubPem: string): URL {
  const url = new URL('https://linux.do/user_api_key/new')
  url.searchParams.set('application_name', 'LinuxDo Desktop')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scopes', 'read,write,session_info,notifications,message_bus')
  url.searchParams.set('public_key', pubPem)
  url.searchParams.set('auth_redirect', 'linuxdo-desktop://user-api-key')
  return url
}

export function openUserApiKeyLogin(mode: 'system-browser' | 'embedded' = 'system-browser'): Promise<UserApiKeyResult> {
  return new Promise((resolve) => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const clientId = randomBytes(16).toString('hex')
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const url = buildAuthorizeUrl(clientId, pubPem)
    const timeoutMs = mode === 'system-browser' ? 10 * 60 * 1000 : 5 * 60 * 1000

    let win: BrowserWindow | null = null
    let settled = false
    const finish = (result: UserApiKeyResult): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      pendingAuth = null
      if (win && !win.isDestroyed()) win.close()
      resolve(result)
    }
    let timer: NodeJS.Timeout | undefined = setTimeout(
      () => finish({ ok: false, error: mode === 'system-browser' ? '授权超时（未收到浏览器回调，可改用应用内窗口授权）' : '授权超时' }),
      timeoutMs
    )
    pendingAuth = { privateKey, clientId, finish }

    if (mode === 'system-browser') {
      void shell
        .openExternal(url.toString())
        .catch((e: unknown) => finish({ ok: false, error: `无法打开系统浏览器：${String(e)}` }))
      return
    }

    win = new BrowserWindow({
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
    win.on('closed', () => finish({ ok: false, error: '授权窗口已关闭' }))
    const intercept = (event: Electron.Event, targetUrl: string): void => {
      if (handleAuthCallbackUrl(targetUrl)) event.preventDefault()
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

    if (cred) injectCredFill(win, cred.username, cred.password)
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

// ---------- 登录账密记忆（safeStorage 密文落盘，供登录窗口自动填充；仅填充不自动提交） ----------

export interface LoginCredStatus {
  remembered: boolean
  username: string
}

const credFile = (): string => join(app.getPath('userData'), 'login.enc')

let cred: { username: string; password: string } | null = null

function loadLoginCred(): void {
  try {
    if (!existsSync(credFile()) || !safeStorage.isEncryptionAvailable()) return
    const parsed = JSON.parse(safeStorage.decryptString(readFileSync(credFile()))) as {
      username?: string
      password?: string
    }
    if (parsed.username && parsed.password) cred = { username: parsed.username, password: parsed.password }
  } catch {
    cred = null
  }
}

export function saveLoginCred(username: string, password: string): LoginCredStatus {
  const u = username.trim()
  if (!u || !password) throw new Error('用户名和密码不能为空')
  cred = { username: u, password }
  try {
    if (safeStorage.isEncryptionAvailable()) {
      writeFileSync(credFile(), safeStorage.encryptString(JSON.stringify(cred)))
    }
    // 加密不可用时不落盘：凭据仅留在内存，本会话仍可自动填充
  } catch {
    /* 落盘失败不阻塞，内存态保留 */
  }
  return { remembered: true, username: u }
}

export function clearLoginCred(): LoginCredStatus {
  cred = null
  try {
    if (existsSync(credFile())) rmSync(credFile())
  } catch {
    /* 删除失败不影响内存态清除 */
  }
  return { remembered: false, username: '' }
}

export function getLoginCredStatus(): LoginCredStatus {
  return { remembered: cred !== null, username: cred?.username ?? '' }
}

/**
 * 向登录窗口注入账密填充：轮询等 Discourse 登录表单出现后写入，**不点击登录按钮**
 * （用户确认后自己提交；规避连续失败锁定，兼容 2FA/盾）。选择器变更时静默降级为手动输入。
 */
function injectCredFill(win: BrowserWindow, username: string, password: string): void {
  const user = JSON.stringify(username)
  const pass = JSON.stringify(password)
  void win.webContents
    .executeJavaScript(`(() => {
      let n = 0
      const timer = setInterval(() => {
        const u = document.querySelector('#login-account-name')
        const p = document.querySelector('#login-account-password')
        if (u && p) {
          clearInterval(timer)
          const set = (el, val) => {
            const desc = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')
            if (desc && desc.set) desc.set.call(el, val)
            else el.value = val
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
          if (!u.value) set(u, ${user})
          if (!p.value) set(p, ${pass})
          return
        }
        if (++n > 60) clearInterval(timer)
      }, 500)
    })()`)
    .catch(() => {})
}
