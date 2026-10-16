/**
 * DoH 真实现：本地 HTTP CONNECT 代理 + DoH 上游解析（10-16-doh-real）。
 *
 * 背景：Electron 44 网络服务不消费 Chromium 的 dns-over-https-* 命令行开关（v44 源码核实见
 * SPEC），运行时唯一可控的 DNS 路径是 session.setProxy + 本地代理：CONNECT 隧道建立前由
 * Node 侧解析目标域名。TLS 由 Chromium 端到端完成，本代理只做「解析 + TCP 隧道」，不见明文。
 *
 * 模式语义（沿用 SPEC / p2-doh 定义）：secure = 仅 DoH（失败即断）；auto = DoH 优先、
 * 失败回退系统解析（短 TTL，仿 FluxDO 行为）。
 * DoH 查询用 Node 全局 fetch（undici）：不经 defaultSession，防递归走自身代理；
 * 模板为域名时由 undici 的 dns.lookup 隐式 bootstrap（系统 DNS 解 DoH 服务器自身域名）。
 */
import { session } from 'electron'
import http from 'node:http'
import net from 'node:net'
import dns from 'node:dns'
import { randomInt } from 'node:crypto'
import { getDohConfig, type DohConfig } from './settings'

interface CacheEntry {
  ips: string[]
  expires: number
  via: 'doh' | 'fallback'
}

const cache = new Map<string, CacheEntry>()
let server: http.Server | null = null
let active = false

const DOH_TIMEOUT_MS = 5000
const UPSTREAM_TIMEOUT_MS = 8000
const TTL_MIN_MS = 60_000
const TTL_MAX_MS = 600_000
const FALLBACK_TTL_MS = 120_000 // auto 回退结果短缓存（FluxDO 同款语义）
const CACHE_MAX = 500

// ---------- DNS 报文（RFC 1035 查询 / RFC 8484 载荷） ----------

/** 构造查询报文：12 字节 header + QNAME + QTYPE（A=1 / AAAA=28），RD 置位。 */
function buildQuery(name: string, type: number): Buffer {
  const labels = name.split('.').filter(Boolean)
  let qlen = 1
  for (const l of labels) qlen += l.length + 1
  const buf = Buffer.alloc(12 + qlen + 4)
  buf.writeUInt16BE(randomInt(0, 65536), 0)
  buf.writeUInt16BE(0x0100, 2) // flags: RD
  buf.writeUInt16BE(1, 4) // QDCOUNT = 1
  let off = 12
  for (const l of labels) {
    buf[off++] = l.length
    buf.write(l, off, 'ascii')
    off += l.length
  }
  buf[off++] = 0
  buf.writeUInt16BE(type, off)
  buf.writeUInt16BE(1, off + 2) // QCLASS = IN
  return buf
}

/** IPv6 rdata 转未压缩字面量（net.connect 接受）；A 记录不经过此函数。 */
function formatIpv6(b: Buffer): string {
  const parts: string[] = []
  for (let i = 0; i < 16; i += 2) parts.push(b.readUInt16BE(i).toString(16))
  return parts.join(':')
}

/** 跳过（可能压缩的）域名字段：指针 0xC0 占 2 字节，否则逐 label 走到 0。 */
function skipName(buf: Buffer, off: number): number {
  while (off < buf.length) {
    const len = buf[off]
    if (len === 0) return off + 1
    if ((len & 0xc0) === 0xc0) return off + 2
    off += len + 1
  }
  return off
}

/** 解析响应 answer 段，取首条 wantType 记录的地址与 TTL。 */
function parseAnswer(buf: Buffer, wantType: number): { ips: string[]; ttl: number } {
  const qd = buf.readUInt16BE(4)
  const an = buf.readUInt16BE(6)
  let off = 12
  for (let i = 0; i < qd && off < buf.length; i++) {
    off = skipName(buf, off)
    off += 4
  }
  const ips: string[] = []
  let ttl = 300
  const rlen = wantType === 1 ? 4 : 16
  for (let i = 0; i < an && off + 10 <= buf.length; i++) {
    off = skipName(buf, off)
    if (off + 10 > buf.length) break
    const type = buf.readUInt16BE(off)
    const recTtl = buf.readUInt32BE(off + 4)
    const rdlen = buf.readUInt16BE(off + 8)
    off += 10
    if (type === wantType && rdlen === rlen && ips.length === 0) {
      const rd = buf.subarray(off, off + rdlen)
      ips.push(wantType === 1 ? Array.from(rd).join('.') : formatIpv6(rd))
      ttl = recTtl
    }
    off += rdlen
  }
  return { ips, ttl }
}

// ---------- DoH 查询与解析 ----------

async function dohQuery(cfg: DohConfig, name: string, type: number): Promise<{ ips: string[]; ttl: number }> {
  const url = new URL(cfg.template)
  url.searchParams.set('dns', buildQuery(name, type).toString('base64url'))
  const res = await fetch(url, {
    headers: { accept: 'application/dns-message' },
    signal: AbortSignal.timeout(DOH_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`)
  const body = Buffer.from(await res.arrayBuffer())
  const a = parseAnswer(body, type)
  if (!a.ips.length) throw new Error('DoH 响应无目标记录')
  return a
}

/** host 为 IP 字面量（含 [v6] 括号形）时免解析。 */
function asIpLiteral(host: string): string | null {
  if (net.isIPv4(host)) return host
  if (net.isIPv6(host)) return host
  if (host.startsWith('[') && host.endsWith(']') && net.isIPv6(host.slice(1, -1))) return host.slice(1, -1)
  return null
}

function cacheGet(host: string): CacheEntry | null {
  const e = cache.get(host)
  if (!e) return null
  if (e.expires <= Date.now()) {
    cache.delete(host)
    return null
  }
  return e
}

function cachePut(host: string, ips: string[], ttlMs: number, via: 'doh' | 'fallback'): void {
  const clamped = Math.min(Math.max(ttlMs, TTL_MIN_MS), TTL_MAX_MS)
  if (cache.size >= CACHE_MAX) {
    const now = Date.now()
    for (const [k, v] of cache) {
      if (v.expires <= now) cache.delete(k)
      if (cache.size < CACHE_MAX) break
    }
    if (cache.size >= CACHE_MAX) {
      const first = cache.keys().next().value
      if (first !== undefined) cache.delete(first)
    }
  }
  cache.set(host, { ips, expires: Date.now() + clamped, via })
}

/**
 * CONNECT 目标解析（代理数据面，也供诊断复用）。
 * secure：DoH 失败直接抛；auto：DoH 失败回退系统解析并按短 TTL 缓存。
 */
async function resolveHost(cfg: DohConfig, host: string): Promise<{ ips: string[]; via: 'doh' | 'fallback' | 'literal' }> {
  const lit = asIpLiteral(host)
  if (lit) return { ips: [lit], via: 'literal' }
  const hit = cacheGet(host)
  if (hit) return { ips: hit.ips, via: hit.via }
  try {
    let r: { ips: string[]; ttl: number }
    try {
      r = await dohQuery(cfg, host, 1) // A
    } catch {
      r = await dohQuery(cfg, host, 28) // 无 A 时回退 AAAA
    }
    cachePut(host, r.ips, r.ttl * 1000, 'doh')
    return { ips: r.ips, via: 'doh' }
  } catch (e) {
    if (cfg.mode !== 'auto') throw e
    const addrs = await dns.promises.lookup(host, { all: true, verbatim: true })
    if (!addrs.length) throw new Error('DoH 失败且系统解析无结果')
    const ips = addrs.map((a) => a.address)
    cachePut(host, ips, FALLBACK_TTL_MS, 'fallback')
    return { ips, via: 'fallback' }
  }
}

// ---------- CONNECT 隧道 ----------

/** 逐 IP 尝试上游 TCP（简化 happy-eyeballs：单个 8s 超时后换下一个）。 */
function connectAny(ips: string[], port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const tryNext = (i: number): void => {
      if (i >= ips.length) {
        reject(new Error('上游全部连接失败'))
        return
      }
      const sock = net.connect({ host: ips[i], port })
      const timer = setTimeout(() => {
        sock.destroy()
        tryNext(i + 1)
      }, UPSTREAM_TIMEOUT_MS)
      sock.once('connect', () => {
        clearTimeout(timer)
        resolve(sock)
      })
      sock.once('error', () => {
        clearTimeout(timer)
        tryNext(i + 1)
      })
    }
    tryNext(0)
  })
}

/** CONNECT 处理：解析 → 上游 TCP → 200 → 双向 pipe。失败只影响当前连接（secure 即 502 断开）。 */
async function handleConnect(cfg: DohConfig, req: http.IncomingMessage, client: net.Socket, head: Buffer): Promise<void> {
  try {
    const authority = req.url ?? ''
    const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(authority)
    const host = m?.[1] ?? ''
    const port = m?.[2] ? Number(m[2]) : 443
    if (!host) throw new Error(`非法 CONNECT 目标：${authority}`)
    const { ips } = await resolveHost(cfg, host)
    const upstream = await connectAny(ips, port)
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length) upstream.write(head)
    const cleanup = (): void => {
      client.destroy()
      upstream.destroy()
    }
    upstream.pipe(client)
    client.pipe(upstream)
    client.on('error', cleanup)
    upstream.on('error', cleanup)
    client.on('close', cleanup)
    upstream.on('close', cleanup)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (client.writable) client.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n${msg}`)
    client.destroy()
  }
}

// ---------- 生命周期 ----------

function startServer(cfg: DohConfig): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const s = http.createServer((_req, res) => {
      res.destroy() // 非 CONNECT 明文请求不该出现（应用流量全 https，localhost 已 bypass）
    })
    s.on('connect', (req, clientSocket, head) => {
      // @types/node 把 'connect' 回调的 socket 声明为 Duplex，运行时实为 net.Socket
      void handleConnect(cfg, req, clientSocket as net.Socket, head)
    })
    s.on('clientError', (_err, socket) => socket.destroy())
    s.on('error', () => {
      // 运行期错误（端口异常等）：置空待下次 apply 重建，不拖垮主进程
      active = false
      if (server === s) server = null
    })
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      server = s
      active = true
      resolvePort(typeof addr === 'object' && addr ? addr.port : 0)
    })
    s.once('error', reject) // listen 阶段失败（理论上随机端口不会冲突）
  })
}

export async function startDohProxy(cfg: DohConfig): Promise<number> {
  await stopDohProxy()
  return startServer(cfg)
}

export async function stopDohProxy(): Promise<void> {
  const s = server
  server = null
  active = false
  if (!s) return
  await new Promise<void>((resolve) => {
    s.closeAllConnections()
    s.close(() => resolve())
  })
}

export function isDohProxyActive(): boolean {
  return active
}

/**
 * 读配置启停代理并接管/还原 defaultSession 代理（app ready 与设置保存两处共用）。
 * enabled=false 时还原系统代理，与禁用前行为一致。
 */
export async function applyDohRuntime(): Promise<void> {
  const cfg = getDohConfig()
  if (cfg.enabled) {
    const port = await startDohProxy(cfg)
    await session.defaultSession.setProxy({
      proxyRules: `127.0.0.1:${port}`,
      proxyBypassRules: 'localhost;127.0.0.1;<local>'
    })
  } else {
    await stopDohProxy()
    await session.defaultSession.setProxy({ mode: 'system' })
  }
}

/**
 * 诊断：按当前配置实测解析链路（secure 失败会抛出，由调用方转错误响应）。
 * 代理未启用时调用方应走 session.resolveHost 展示系统解析结果。
 */
export async function diagResolve(host: string): Promise<{ addresses: string[]; via: 'doh' | 'fallback' | 'literal' }> {
  const r = await resolveHost(getDohConfig(), host)
  return { addresses: r.ips, via: r.via }
}

/** 纯逻辑自检（smoke 用）：QNAME/QTYPE 编码 + 压缩指针 A 记录解析的往返断言。 */
export function dohSelfCheck(): boolean {
  const q = buildQuery('linux.do', 1)
  const labels: string[] = []
  let off = 12
  while (q[off] !== 0) {
    labels.push(q.toString('ascii', off + 1, off + 1 + q[off]))
    off += q[off] + 1
  }
  off++ // 越过 0 终止符
  const qend = off + 4 // QTYPE + QCLASS
  if (labels.join('.') !== 'linux.do' || q.readUInt16BE(off) !== 1 || q.readUInt16BE(4) !== 1) return false
  // 合成应答：复用查询的 header+question 段，answer 用 0xC00C 指针 + A 记录 1.2.3.4 / TTL 300
  const rr = Buffer.alloc(14)
  rr.writeUInt16BE(0xc00c, 0) // name 指针 → offset 12
  rr.writeUInt16BE(1, 2) // A
  rr.writeUInt16BE(1, 4) // IN
  rr.writeUInt32BE(300, 6) // TTL
  rr.writeUInt16BE(4, 10) // rdlength
  rr[12] = 1
  rr[13] = 2
  const ans = Buffer.concat([q.subarray(0, qend), rr, Buffer.from([3, 4])])
  ans.writeUInt16BE(1, 6) // ANCOUNT = 1
  const r = parseAnswer(ans, 1)
  return r.ips.length === 1 && r.ips[0] === '1.2.3.4' && r.ttl === 300
}
