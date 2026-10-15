import { app, safeStorage } from 'electron'
import { createServer, type Server } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export const CONNECT_ISSUER = 'https://connect.linux.do'
export const LOOPBACK_PORT = 17365
export const CONNECT_PROTOCOL_HOST = 'linuxdo-desktop'

export type ConnectCallbackMode = 'protocol' | 'loopback'

export interface ConnectIdentity {
  username: string
  name?: string
  email?: string
  avatar_url?: string
  trust_level?: number
  silenced?: boolean
  active?: boolean
}

export interface ConnectStatus {
  configured: boolean
  callbackMode: ConnectCallbackMode
  identity: ConnectIdentity | null
}

const cfgFile = (): string => join(app.getPath('userData'), 'connect-config.json')
const secretFile = (): string => join(app.getPath('userData'), 'connect.enc')

interface PlainConfig {
  clientId: string
  callbackMode: ConnectCallbackMode
  identity: ConnectIdentity | null
}

interface Secrets {
  clientSecret: string
  accessToken: string
  refreshToken: string
}

let plain: PlainConfig | null = null
let secrets: Secrets | null = null

function loadOnce(): void {
  if (plain) return
  plain = { clientId: '', callbackMode: 'loopback', identity: null }
  try {
    if (existsSync(cfgFile())) {
      const raw = JSON.parse(readFileSync(cfgFile(), 'utf8')) as Partial<PlainConfig>
      plain = {
        clientId: raw.clientId ?? '',
        callbackMode: raw.callbackMode === 'protocol' ? 'protocol' : 'loopback',
        identity: raw.identity ?? null
      }
    }
  } catch {
    /* 保持默认 */
  }
  try {
    if (existsSync(secretFile()) && safeStorage.isEncryptionAvailable()) {
      secrets = JSON.parse(safeStorage.decryptString(readFileSync(secretFile()))) as Secrets
    }
  } catch {
    secrets = null
  }
}

function persist(): void {
  loadOnce()
  try {
    writeFileSync(cfgFile(), JSON.stringify({ clientId: plain!.clientId, callbackMode: plain!.callbackMode, identity: plain!.identity }, null, 2), 'utf8')
  } catch {
    /* 忽略 */
  }
  try {
    if (secrets && safeStorage.isEncryptionAvailable()) {
      writeFileSync(secretFile(), safeStorage.encryptString(JSON.stringify(secrets)))
    }
  } catch {
    /* 忽略 */
  }
}

export function getConnectConfig(): ConnectStatus {
  loadOnce()
  return {
    configured: Boolean(plain!.clientId && secrets?.clientSecret),
    callbackMode: plain!.callbackMode,
    identity: plain!.identity
  }
}

export function saveConnectConfig(clientId: string, callbackMode: ConnectCallbackMode, clientSecret?: string): ConnectStatus {
  loadOnce()
  if (clientId.trim()) plain!.clientId = clientId.trim()
  plain!.callbackMode = callbackMode
  if (clientSecret !== undefined) {
    if (!secrets) secrets = { clientSecret: '', accessToken: '', refreshToken: '' }
    secrets.clientSecret = clientSecret.trim()
  }
  persist()
  return getConnectConfig()
}

export function clearConnectIdentity(): void {
  loadOnce()
  plain!.identity = null
  if (secrets) secrets.accessToken = ''
  persist()
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface PendingConnect {
  state: string
  resolve: (code: string) => void
  reject: (err: Error) => void
}

let pendingConnect: PendingConnect | null = null
let loopbackServer: Server | null = null

/** 协议回调：linuxdo-desktop://connect?code=...&state=...（由单实例锁转发进来） */
export function handleConnectCallbackUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  const code = u.searchParams.get('code')
  if (!code) return false
  const pending = pendingConnect
  if (!pending) return true // 无待授权，忽略冷启动误触发
  pendingConnect = null
  if (u.searchParams.get('state') !== pending.state) {
    pending.reject(new Error('state 校验失败'))
  } else {
    pending.resolve(code)
  }
  return true
}

/** 本地回环：监听 127.0.0.1:17365/callback 接授权码 */
function waitLoopbackCallback(state: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let server: Server | null = null
    let timer: NodeJS.Timeout | undefined
    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      if (server) {
        server.close()
        loopbackServer = null
      }
    }
    const done = (err: Error | null, code?: string): void => {
      cleanup()
      if (err) reject(err)
      else resolve(code!)
    }
    server = createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1:17365')
      if (u.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const err = u.searchParams.get('error')
      const code = u.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (code && u.searchParams.get('state') === state) {
        res.end('<meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding-top:80px"><h2>✅ 授权成功</h2><p>请回到 LinuxDo Desktop 继续使用，本页可以关闭。</p></body>')
        done(null, code)
      } else {
        res.end('<meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding-top:80px"><h2>❌ 授权失败</h2><p>请回到应用重新发起。</p></body>')
        done(new Error(err ? `站点返回错误：${err}` : '回调缺少 code 或 state 不匹配'))
      }
    })
    loopbackServer = server
    server.on('error', (e) => done(new Error(`本地端口 ${LOOPBACK_PORT} 监听失败（被占用？）：${e.message}`)))
    server.listen(LOOPBACK_PORT, '127.0.0.1', () => {
      timer = setTimeout(() => done(new Error('授权超时（未收到浏览器回调）')), timeoutMs)
    })
  })
}

async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<void> {
  loadOnce()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: plain!.clientId,
    client_secret: secrets?.clientSecret ?? '',
    code_verifier: verifier
  })
  const res = await fetch(`${CONNECT_ISSUER}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`token 交换失败 HTTP ${res.status} ${text.slice(0, 160)}`)
  }
  const data = (await res.json()) as { access_token?: string; refresh_token?: string }
  if (!data.access_token) throw new Error('token 交换未返回 access_token')
  if (!secrets) secrets = { clientSecret: '', accessToken: '', refreshToken: '' }
  secrets.accessToken = data.access_token
  secrets.refreshToken = data.refresh_token ?? secrets.refreshToken ?? ''
}

async function fetchIdentity(): Promise<ConnectIdentity> {
  const res = await fetch(`${CONNECT_ISSUER}/api/user`, {
    headers: { Authorization: `Bearer ${secrets?.accessToken ?? ''}` }
  })
  if (!res.ok) throw new Error(`身份拉取失败 HTTP ${res.status}`)
  const raw = (await res.json()) as Record<string, unknown>
  return {
    username: String(raw.username ?? ''),
    name: raw.name ? String(raw.name) : undefined,
    email: raw.email ? String(raw.email) : undefined,
    avatar_url: raw.avatar_url ? String(raw.avatar_url) : undefined,
    trust_level: typeof raw.trust_level === 'number' ? raw.trust_level : undefined,
    silenced: Boolean(raw.silenced),
    active: Boolean(raw.active)
  }
}

/**
 * Connect 身份登录（系统浏览器）：PKCE + state 防护的 OAuth2 授权码流程。
 * 拿到的是身份信息（用户名/邮箱/信任等级等），无论坛 API 权限——
 * 论坛会话仍由浏览器窗口登录（_t cookie）承担，两者互补。
 */
export async function connectLogin(timeoutMs = 10 * 60 * 1000): Promise<{
  ok: boolean
  username?: string
  error?: string
}> {
  loadOnce()
  if (!plain!.clientId || !secrets?.clientSecret) {
    return { ok: false, error: '请先在上方填写并保存 Client ID / Client Secret' }
  }
  const verifier = base64url(randomBytes(48))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = randomBytes(16).toString('hex')
  const redirectUri =
    plain!.callbackMode === 'protocol'
      ? `${CONNECT_PROTOCOL_HOST}://connect`
      : `http://127.0.0.1:${LOOPBACK_PORT}/callback`

  const url = new URL(`${CONNECT_ISSUER}/oauth2/authorize`)
  url.searchParams.set('client_id', plain!.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')

  const waitCallback: Promise<string> =
    plain!.callbackMode === 'protocol'
      ? new Promise<string>((resolve, reject) => {
          pendingConnect = { state, resolve, reject }
          setTimeout(() => {
            if (pendingConnect?.state === state) {
              pendingConnect = null
              reject(new Error('授权超时（未收到浏览器回调）'))
            }
          }, timeoutMs)
        })
      : waitLoopbackCallback(state, timeoutMs)

  const { shell } = await import('electron')
  await shell.openExternal(url.toString())

  try {
    const code = await waitCallback
    await exchangeCode(code, verifier, redirectUri)
    const identity = await fetchIdentity()
    plain!.identity = identity
    persist()
    return { ok: true, username: identity.username }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 测试期退出清理用 */
export function resetConnectForTest(): void {
  loadOnce()
  plain!.identity = null
  secrets = null
  if (existsSync(secretFile())) rmSync(secretFile())
  persist()
}
