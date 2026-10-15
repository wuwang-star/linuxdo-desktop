import { net } from 'electron'
import { randomUUID } from 'node:crypto'
import { BASE_URL, USER_AGENT, pushDiag } from './client'

/**
 * MessageBus 长轮询（独立生命周期，不走 client.ts 统一封装——
 * 429 退避/自动重试语义不适用于 30s 挂起的长轮询；凭据仍来自共享 cookie 会话）。
 *
 * ⚠️ 协议细节未经登录态实测，待手工验收确认（SPEC 不变量：端点先抓包核实）：
 * - 频道名按 /notification/<user_id> 实现
 * - 请求编码：表单体，key=频道名，value=last_seen_id
 * - 响应形态：完整 JSON 数组 或 流式分块（/频道\n消息id\njson\n），解析器自适应兼容两种
 */
export interface MessageBusMessage {
  channel: string
  messageId: number
  data: unknown
}

export interface MessageBusStatus {
  running: boolean
  /** 连续失败达上限后进入回退模式（renderer 退回手动轮询），本会话不再自动重启 */
  failed: boolean
  failures: number
  channel: string | null
  lastSeenId: number
}

const POLL_TIMEOUT_MS = 65_000 // 服务端长轮询挂起约 30-60s，我方超时按一次空轮询处理
const MAX_FAILURES = 3
const BACKOFF_CAP_MS = 30_000

let clientId = randomUUID()
let sub: { channel: string; lastSeenId: number } | null = null
let running = false
let failed = false
let failures = 0
let controller: AbortController | null = null
let onMessages: ((msgs: MessageBusMessage[]) => void) | null = null

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function status(): MessageBusStatus {
  return {
    running,
    failed,
    failures,
    channel: sub?.channel ?? null,
    lastSeenId: sub?.lastSeenId ?? 0
  }
}

/** 启动订阅。重复启动同一频道为 no-op；进入回退模式后不自动复活（重新登录换账号可重置） */
export function messageBusStart(
  userId: number,
  cb: (msgs: MessageBusMessage[]) => void
): MessageBusStatus {
  const channel = `/notification/${userId}`
  if (running && sub?.channel === channel) return status()
  const channelChanged = sub?.channel !== channel
  sub = { channel, lastSeenId: 0 }
  onMessages = cb
  if (failed && !channelChanged) return status()
  failed = false
  failures = 0
  if (!running) {
    running = true
    void loop()
  }
  return status()
}

export function messageBusStop(): void {
  running = false
  controller?.abort()
  controller = null
}

export function messageBusStatus(): MessageBusStatus {
  return status()
}

async function loop(): Promise<void> {
  while (running && sub && !failed) {
    await pollOnce()
    if (!running || failed) break
    if (failures > 0) await sleep(Math.min(BACKOFF_CAP_MS, 1000 * 2 ** failures))
  }
  running = false
}

async function pollOnce(): Promise<void> {
  if (!sub) return
  // 局部引用：stop→start 换代后，旧 poll 的 finally 不得抹掉新会话的 controller
  const mine = new AbortController()
  controller = mine
  const killer = setTimeout(() => mine.abort(), POLL_TIMEOUT_MS)
  const url = `${BASE_URL}/message-bus/${clientId}/poll`
  const started = Date.now()
  try {
    const body = new URLSearchParams()
    body.set(sub.channel, String(sub.lastSeenId))
    const res = await net.fetch(url, {
      method: 'POST',
      credentials: 'include',
      signal: mine.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })
    pushDiag({
      time: new Date().toISOString(),
      method: 'POST',
      url,
      status: res.status,
      ms: Date.now() - started
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} <- ${url}`)
    const msgs = await parseResponse(res)
    if (!running || !sub) return
    for (const m of msgs) {
      if (m.channel === sub.channel && m.messageId > sub.lastSeenId) sub.lastSeenId = m.messageId
    }
    failures = 0
    failed = false
    if (msgs.length > 0) onMessages?.(msgs)
  } catch (err) {
    if (!running) return // stop() 触发的 abort，正常退出
    if (err instanceof Error && err.name === 'AbortError') return // 我方超时 → 视为空轮询
    failures++
    if (failures >= MAX_FAILURES) failed = true
    pushDiag({
      time: new Date().toISOString(),
      method: 'POST',
      url,
      status: 0,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err)
    })
  } finally {
    clearTimeout(killer)
    if (controller === mine) controller = null
  }
}

/**
 * 自适应解析：先按流式增量读（chunk 模式逐块产出）；
 * 若连接直接完整返回 JSON 数组，则在读完后整体解析。
 */
async function parseResponse(res: Response): Promise<MessageBusMessage[]> {
  const reader = res.body?.getReader()
  if (!reader) return parseFullArray(await res.text())
  const decoder = new TextDecoder()
  let buffer = ''
  let mode: 'unknown' | 'array' | 'chunk' = 'unknown'
  const out: MessageBusMessage[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (value) {
      buffer += decoder.decode(value, { stream: true })
      if (mode === 'unknown') {
        const trimmed = buffer.replace(/^\s+/, '')
        if (trimmed.startsWith('[')) mode = 'array'
        else if (trimmed.startsWith('/')) mode = 'chunk'
      }
      if (mode === 'chunk') buffer = extractChunks(buffer, out)
    }
    if (done) break
  }
  buffer += decoder.decode()
  if (mode === 'chunk') buffer = extractChunks(buffer, out)
  else out.push(...parseFullArray(buffer))
  return out
}

/** 整体响应按 JSON 数组解析（message_id 缺失时退化用 global_id） */
function parseFullArray(text: string): MessageBusMessage[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  try {
    const arr: unknown = JSON.parse(trimmed)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => ({
        channel: String(m.channel ?? ''),
        messageId: Number(m.message_id ?? m.global_id ?? 0),
        data: m.data
      }))
  } catch {
    return []
  }
}

/**
 * 流式分块解析：每块三行 `/频道\n<消息id>\n<json>\n`；
 * 返回剩余的不完整尾巴，留待下个数据事件续拼。
 */
function extractChunks(buf: string, out: MessageBusMessage[]): string {
  const lines = buf.split('\n')
  const tail = lines.pop() ?? '' // 尾段后未见换行，可能不完整，留待下个数据事件续拼
  let i = 0
  while (i + 2 < lines.length) {
    const channel = lines[i]
    const idStr = lines[i + 1]
    const json = lines[i + 2]
    if (channel.startsWith('/') && /^\d+$/.test(idStr)) {
      try {
        out.push({ channel, messageId: Number(idStr), data: JSON.parse(json) })
      } catch {
        /* 单块坏数据跳过，不影响其余 */
      }
      i += 3
    } else {
      i += 1 // 异常行丢弃，向后重同步
    }
  }
  const leftover = lines.slice(i)
  // 剩余完整行属于未凑齐三行的半块，原样保留（它们在原缓冲里各自以 \n 结尾）
  return leftover.length > 0 ? leftover.join('\n') + '\n' + tail : tail
}
