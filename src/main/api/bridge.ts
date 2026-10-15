import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { setTCookieManually } from './auth'
import {
  getBridgeConfig,
  setBridgeEnabled as persistBridgeEnabled,
  regenBridgePair as regenPairCode
} from './settings'

/**
 * 伴生扩展桥接收口（方案 C）：Edge 里的 MV3 扩展把 linux.do 的 _t cookie
 * POST 到本机回环端口，走 setTCookieManually 落登录态（与手动粘贴同通道）。
 *
 * 安全边界：
 * - 仅绑定 127.0.0.1（不暴露局域网）
 * - 6 位数字配对码校验，码错 401；重新生成后旧码立即失效
 * - _t 属敏感会话凭据：响应与日志绝不回显（本文件不出现任何 console 输出 cookie 的路径）
 */
export const BRIDGE_PORT = 17366

/** 请求体上限：_t 值实际几百字节，16KB 已远超需要，防异常大包 */
const MAX_BODY_BYTES = 16 * 1024

export interface BridgeStatus {
  enabled: boolean
  pairCode: string
  listening: boolean
  lastPushTime: string | null
  lastPushOk: boolean | null
  /** 端口占用等启动失败原因，透出到 UI */
  lastError: string | null
}

let server: Server | null = null
let listening = false
let startError: string | null = null
let lastPushTime: string | null = null
let lastPushOk: boolean | null = null

function status(): BridgeStatus {
  const cfg = getBridgeConfig()
  return {
    enabled: cfg.enabled,
    pairCode: cfg.pairCode,
    listening,
    lastPushTime,
    lastPushOk,
    lastError: startError
  }
}

function cors(res: ServerResponse): void {
  // 扩展 SW 有 host_permissions 本不受 CORS 限制，此头仅为 curl/页面调试便利
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function reply(res: ServerResponse, code: number, payload: Record<string, unknown>): void {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size <= MAX_BODY_BYTES) chunks.push(c)
    })
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) reject(new Error(`请求体超过 ${MAX_BODY_BYTES} 字节`))
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const u = new URL(req.url ?? '/', `http://127.0.0.1:${BRIDGE_PORT}`)
  if (req.method !== 'POST' || u.pathname !== '/ingest') {
    reply(res, 404, { ok: false, error: 'not found' })
    return
  }
  lastPushTime = new Date().toISOString()
  try {
    const parsed = JSON.parse(await readBody(req)) as { pairCode?: unknown; tCookie?: unknown }
    const cfg = getBridgeConfig()
    if (typeof parsed.pairCode !== 'string' || !cfg.pairCode || parsed.pairCode !== cfg.pairCode) {
      lastPushOk = false
      reply(res, 401, { ok: false, error: '配对码不正确' })
      return
    }
    if (typeof parsed.tCookie !== 'string' || !parsed.tCookie.trim()) {
      lastPushOk = false
      reply(res, 400, { ok: false, error: '缺少 tCookie' })
      return
    }
    const st = await setTCookieManually(parsed.tCookie)
    lastPushOk = true
    // 只回用户名供扩展展示，绝不回显 cookie 本体
    reply(res, 200, { ok: true, username: st.user?.username ?? null })
  } catch (e) {
    lastPushOk = false
    const msg = e instanceof Error ? e.message : String(e)
    reply(res, msg.includes('请求体超过') ? 413 : 500, { ok: false, error: msg })
  }
}

export function startBridge(): BridgeStatus {
  if (server) return status() // 已在监听（或正在启动）
  startError = null
  const s = createServer((req, res) => {
    handle(req, res).catch(() => {
      /* 兜底：连接中途断开等，忽略（避免 unhandled rejection） */
    })
  })
  s.on('error', (e) => {
    // 端口被占用等：记入状态透出 UI，不阻塞应用其余功能
    startError = `端口 ${BRIDGE_PORT} 监听失败：${e.message}`
    listening = false
    server = null
  })
  s.listen(BRIDGE_PORT, '127.0.0.1', () => {
    listening = true
  })
  server = s
  return status()
}

export function stopBridge(): BridgeStatus {
  if (server) {
    const s = server
    server = null
    listening = false
    s.close()
  }
  return status()
}

/** IPC 开关：持久化设置 + 即时启停监听 */
export function setBridgeEnabled(enabled: boolean): BridgeStatus {
  const cfg = persistBridgeEnabled(Boolean(enabled))
  if (cfg.enabled) startBridge()
  else stopBridge()
  return status()
}

export function regenBridgePair(): BridgeStatus {
  regenPairCode()
  return status()
}

export function getBridgeStatus(): BridgeStatus {
  return status()
}

/** 应用启动时按已持久化的开关决定是否自动开始监听（whenReady 后调用） */
export function initBridge(): void {
  if (getBridgeConfig().enabled) startBridge()
}
