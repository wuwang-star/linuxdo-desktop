import { app, net, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * WebDAV 客户端 + 配置存储（自备坚果云 / InfiniCloud / 自建等，手动推送/拉取）。
 *
 * - 配置：`webdav.json`（server/username/remoteDir 明文，原子写）+ `webdav.enc`（密码 safeStorage 加密）。
 *   密码绝不回显（对外只出 hasPassword 布尔）、绝不进同步 bundle。
 * - 客户端：net.fetch 走 Chromium 网络栈（系统代理）。PROPFIND/MKCOL 非常规 method 已实测支持
 *   （Electron 44 探针核对，见任务 research/webdav-method-probe.mjs，2026-10-16），无需降级 net.request。
 * - 动词集：PROPFIND(测连接) / MKCOL(建目录) / PUT(推送) / GET(拉取)，统一 20s 超时。
 */

export interface WebdavConfig {
  server: string
  username: string
  remoteDir: string
  /** 密码是否已保存（不回显密码本身） */
  hasPassword: boolean
}

export interface WebdavTestResult {
  ok: boolean
  /** true = 远端目录不存在（推送时将自动 MKCOL 创建，非致命） */
  needMkCol?: boolean
  error?: string
}

/** 远端目录默认值（远端根下单独一层，不与其他应用混用） */
export const WEBDAV_REMOTE_DIR_DEFAULT = '/linuxdo-desktop/'
/** 同步 bundle 在远端目录内的固定文件名 */
const BUNDLE_FILE = 'linuxdo-sync.json'

const cfgFile = (): string => join(app.getPath('userData'), 'webdav.json')
const passFile = (): string => join(app.getPath('userData'), 'webdav.enc')

interface PlainConfig {
  server: string
  username: string
  remoteDir: string
}

let plain: PlainConfig | null = null
let password: string | null = null

function loadOnce(): void {
  if (plain) return
  plain = { server: '', username: '', remoteDir: WEBDAV_REMOTE_DIR_DEFAULT }
  try {
    if (existsSync(cfgFile())) {
      const raw = JSON.parse(readFileSync(cfgFile(), 'utf8')) as Partial<PlainConfig>
      plain = {
        server: typeof raw.server === 'string' ? raw.server : '',
        username: typeof raw.username === 'string' ? raw.username : '',
        remoteDir: typeof raw.remoteDir === 'string' ? raw.remoteDir : WEBDAV_REMOTE_DIR_DEFAULT
      }
    }
  } catch {
    /* 保持默认 */
  }
  try {
    if (existsSync(passFile()) && safeStorage.isEncryptionAvailable()) {
      password = safeStorage.decryptString(readFileSync(passFile())) || null
    }
  } catch {
    password = null
  }
}

/** 原子写盘：临时文件 + rename（同目录保证同卷），防半截 JSON */
function persistPlain(): void {
  const target = cfgFile()
  const tmp = `${target}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(plain, null, 2), 'utf8')
  renameSync(tmp, target)
}

/** 服务器地址归一：去尾斜杠；非法（非 http/https）返回空串（由 setter 落为未配置） */
function normalizeServer(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '')
  if (!s) return ''
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    return s
  } catch {
    return ''
  }
}

/** 远端目录归一：空 → 默认；补齐前导/结尾斜杠 */
function normalizeRemoteDir(raw: string): string {
  let d = raw.trim()
  if (!d) return WEBDAV_REMOTE_DIR_DEFAULT
  if (!d.startsWith('/')) d = `/${d}`
  if (!d.endsWith('/')) d = `${d}/`
  return d
}

export function getWebdavConfig(): WebdavConfig {
  loadOnce()
  return {
    server: plain?.server ?? '',
    username: plain?.username ?? '',
    remoteDir: plain?.remoteDir ?? WEBDAV_REMOTE_DIR_DEFAULT,
    hasPassword: password !== null && password !== ''
  }
}

/**
 * 保存配置。password 传 undefined = 保持现状（不改密码），传空串 = 清除。
 * 密码 safeStorage 加密落盘；加密不可用时仅保存在内存（进程退出即失效）。
 */
export function setWebdavConfig(server: string, username: string, remoteDir: string, pwd?: string): WebdavConfig {
  loadOnce()
  plain = {
    server: normalizeServer(server),
    username: username.trim(),
    remoteDir: normalizeRemoteDir(remoteDir)
  }
  try {
    persistPlain()
  } catch {
    /* 配置写失败不阻塞，内存态仍生效 */
  }
  if (pwd !== undefined) {
    try {
      if (!pwd) {
        password = null
        if (existsSync(passFile())) rmSync(passFile())
      } else if (safeStorage.isEncryptionAvailable()) {
        password = pwd
        writeFileSync(passFile(), safeStorage.encryptString(pwd))
      } else {
        password = pwd
      }
    } catch {
      /* 密码写失败不阻塞 */
    }
  }
  return getWebdavConfig()
}

// ---------- 客户端（net.fetch + Basic Auth） ----------

/** Basic Auth：user:pass 按 UTF-8 字节 base64（中文用户名/密码兼容；等价浏览器 btoa(TextEncoder) 写法） */
function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`
}

/** 内部用完整配置；未配置完整时抛出明确文案 */
function requireFull(): { server: string; username: string; remoteDir: string; password: string } {
  loadOnce()
  const c = {
    server: plain?.server ?? '',
    username: plain?.username ?? '',
    remoteDir: plain?.remoteDir ?? WEBDAV_REMOTE_DIR_DEFAULT,
    password: password ?? ''
  }
  if (!c.server) throw new Error('请先填写并保存 WebDAV 服务器地址')
  if (!c.password) throw new Error('尚未保存密码，请先在表单填写密码后保存/测试')
  return c
}

/** 目录/文件 URL（encodeURI 兼容目录名含中文/空格） */
function dirUrl(c: { server: string; remoteDir: string }): string {
  return encodeURI(`${c.server}${c.remoteDir}`)
}

function fileUrl(c: { server: string; remoteDir: string }): string {
  return encodeURI(`${c.server}${c.remoteDir}${BUNDLE_FILE}`)
}

async function davFetch(
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string }
): Promise<Response> {
  return net.fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
}

/**
 * 测试连接：PROPFIND 远端目录（Depth: 0）。
 * 207/200 = 成功；401/403 = 凭据错误（坚果云需应用密码）；404 = 目录不存在（needMkCol，非致命）；其余透出。
 */
export async function testWebdavConn(): Promise<WebdavTestResult> {
  let c: ReturnType<typeof requireFull>
  try {
    c = requireFull()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  try {
    const res = await davFetch(dirUrl(c), {
      method: 'PROPFIND',
      headers: { Depth: '0', Authorization: basicAuth(c.username, c.password) }
    })
    if (res.status === 207 || res.status === 200) return { ok: true }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: `认证失败 HTTP ${res.status}（检查用户名/密码；坚果云需用「应用密码」而非网页登录密码）`
      }
    }
    if (res.status === 404) {
      return { ok: false, needMkCol: true, error: '远端目录不存在，推送时将自动创建（MKCOL）' }
    }
    return { ok: false, error: `服务器返回 HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 确保远端目录存在：先整条 MKCOL，失败（如不支持一次建多级）再逐段补建；405 = 已存在视为成功 */
export async function ensureWebdavDir(): Promise<void> {
  const c = requireFull()
  const auth = basicAuth(c.username, c.password)
  const segments = c.remoteDir.split('/').filter(Boolean)
  try {
    const direct = await davFetch(`${dirUrl(c)}/`, { method: 'MKCOL', headers: { Authorization: auth } })
    if (direct.ok || direct.status === 405) return
  } catch {
    /* 落到逐段建 */
  }
  // 逐段补建（服务器不支持一次建多级时）：任一段失败即中止
  let cur = ''
  for (const seg of segments) {
    cur += `/${seg}`
    const res = await davFetch(`${encodeURI(`${c.server}${cur}`)}/`, {
      method: 'MKCOL',
      headers: { Authorization: auth }
    })
    if (!res.ok && res.status !== 405) {
      throw new Error(`创建远端目录失败 HTTP ${res.status}（${cur}）`)
    }
  }
}

/** 推送：确保目录后 PUT bundle JSON（本地覆盖云端） */
export async function putBundle(json: string): Promise<void> {
  const c = requireFull()
  await ensureWebdavDir()
  const res = await davFetch(fileUrl(c), {
    method: 'PUT',
    headers: {
      Authorization: basicAuth(c.username, c.password),
      'Content-Type': 'application/json'
    },
    body: json
  })
  if (!res.ok) throw new Error(`推送失败 HTTP ${res.status}`)
}

/** 拉取：GET bundle JSON 文本（404 给出明确文案）；返回原始文本，解析/校验由调用方负责 */
export async function getBundle(): Promise<string> {
  const c = requireFull()
  const res = await davFetch(fileUrl(c), {
    method: 'GET',
    headers: { Authorization: basicAuth(c.username, c.password) }
  })
  if (res.status === 404) throw new Error('远端还没有同步数据（请先「推送到云端」）')
  if (!res.ok) throw new Error(`拉取失败 HTTP ${res.status}`)
  return res.text()
}
