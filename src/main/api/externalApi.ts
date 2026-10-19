/**
 * AI 数据接口（kb-api）：把应用的登录态出口外暴露为本机 HTTP JSON API。
 * 定位：本机 AI（ZCode/Claude 等）借应用的 cookie/ECH 链路拉总榜、读帖、搜索、查进度，
 * 配合 userData/kb/ 的 Markdown 知识库约定实现「刷榜→总结→沉淀」工作流。
 * 安全：仅 127.0.0.1 绑定 + X-KB-Token 弱凭据（同 bridge 配对码定位，防误撞不防本机恶意）。
 * 使用文档：docs/ai-api.md（面向 AI，可直接喂给模型）。
 */
import http from 'node:http'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import {
  fetchCurrentUser,
  fetchHot,
  fetchSearch,
  fetchTopic,
  fetchTop,
  fetchUserSummary,
  type TopPeriod
} from './client'
import { getExternalApiConfig } from './settings'

const PERIODS: TopPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all']

let server: http.Server | null = null

export function kbDir(): string {
  return join(app.getPath('userData'), 'kb')
}

// ---------- 工具 ----------

/** cooked HTML → 可读纯文本（AI 输入用：剥标签+常见实体+折叠空白，代码块保留原文） */
function cookedToText(html: string): string {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, (m) => '\n```\n' + m.replace(/<[^>]+>/g, '') + '\n```\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sendJson(res: http.ServerResponse, code: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

// ---------- 端点实现 ----------

function handleTop(period: string, pageRaw: string | null): Promise<unknown> {
  const p = (PERIODS as string[]).includes(period) ? (period as TopPeriod) : 'weekly'
  const page = Math.max(0, Number(pageRaw ?? 0) || 0)
  return fetchTop(p, page)
}

async function handleTopic(idRaw: string, format: string | null): Promise<unknown> {
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) throw new Error('bad topic id')
  const t = await fetchTopic(id)
  const posts = (t.post_stream?.posts ?? []).map((p) => ({
    post_number: p.post_number,
    username: p.username,
    created_at: p.created_at,
    like_count: p.like_count ?? 0,
    content: format === 'text' ? cookedToText(p.cooked) : p.cooked
  }))
  return {
    id: t.id,
    title: t.title,
    created_at: t.created_at,
    posts_count: t.posts_count,
    posts
  }
}

async function handleMe(): Promise<unknown> {
  const cur = await fetchCurrentUser()
  const u = cur.current_user
  if (!u) throw new Error('未登录')
  let summary: unknown = null
  try {
    summary = (await fetchUserSummary(u.username)).user_summary
  } catch {
    /* 未登录摘要失败容忍 */
  }
  return { username: u.username, trust_level: (u as { trust_level?: number }).trust_level, summary }
}

function kbList(): unknown {
  const dir = kbDir()
  if (!existsSync(dir)) return { files: [] }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const st = (a: string) => {
        try {
          return readFileSync(join(dir, a), 'utf8')
        } catch {
          return ''
        }
      }
      const md = st(f)
      const title = /^title:\s*(.+)$/m.exec(md)?.[1] ?? f
      return { file: f, title: title.trim() }
    })
  return { files }
}

function kbWrite(body: Record<string, unknown>): unknown {
  const title = String(body.title ?? '').trim()
  const summary = String(body.summary ?? '').trim()
  if (!title || !summary) throw new Error('title 与 summary 必填')
  const topicId = Number(body.topicId ?? 0)
  const name = topicId > 0 ? `topic-${topicId}.md` : `note-${Date.now()}.md`
  const dir = kbDir()
  mkdirSync(dir, { recursive: true })
  const fm = [
    '---',
    `title: ${title}`,
    topicId > 0 ? `topic_id: ${topicId}` : '',
    body.category ? `category: ${String(body.category)}` : '',
    body.tags ? `tags: ${String(body.tags)}` : '',
    body.url ? `url: ${String(body.url)}` : '',
    `updated: ${new Date().toISOString()}`,
    '---'
  ]
    .filter(Boolean)
    .join('\n')
  writeFileSync(join(dir, name), `${fm}\n\n${summary}\n`, 'utf8')
  return { file: name }
}

// ---------- 路由 ----------

async function route(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const q = url.searchParams
  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, app: 'linuxdo-desktop' })
    return
  }
  if (url.pathname === '/api/top') return void sendJson(res, 200, await handleTop(q.get('period') ?? 'weekly', q.get('page')))
  if (url.pathname.startsWith('/api/topic/')) {
    return void sendJson(res, 200, await handleTopic(url.pathname.split('/')[3] ?? '', q.get('format')))
  }
  if (url.pathname === '/api/search') {
    const query = (q.get('q') ?? '').trim()
    if (!query) throw new Error('q 必填')
    return void sendJson(res, 200, await fetchSearch(query, Math.max(0, Number(q.get('page') ?? 0) || 0)))
  }
  if (url.pathname === '/api/me') return void sendJson(res, 200, await handleMe())
  if (url.pathname === '/api/kb' && req.method === 'GET') return void sendJson(res, 200, kbList())
  if (url.pathname === '/api/kb' && req.method === 'POST') {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (raw.length > 512 * 1024) throw new Error('body 过大（>512KB）')
    return void sendJson(res, 200, kbWrite(JSON.parse(raw || '{}')))
  }
  sendJson(res, 404, { error: 'not found（接口清单见 docs/ai-api.md）' })
}

// ---------- 生命周期 ----------

function startServer(port: number, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      void (async () => {
        try {
          if ((req.headers['x-kb-token'] ?? '') !== token) {
            sendJson(res, 401, { error: 'X-KB-Token 不匹配（设置→AI 接口 查看）' })
            return
          }
          await route(req, res, new URL(req.url ?? '/', 'http://127.0.0.1'))
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })()
    })
    s.on('error', (e) => {
      if (server === s) server = null
      reject(e)
    })
    s.listen(port, '127.0.0.1', () => {
      server = s
      resolve()
    })
  })
}

function stopServer(): Promise<void> {
  const s = server
  server = null
  if (!s) return Promise.resolve()
  return new Promise((resolve) => {
    s.closeAllConnections()
    s.close(() => resolve())
  })
}

/**
 * 读配置启停（app ready 与设置保存两处共用，镜像 applyDohRuntime 模式）。
 * token 为空视为未配置：起服务但全 401——明确暴露「没配 token」而不是静默。
 */
export async function applyExternalApiRuntime(): Promise<void> {
  const cfg = getExternalApiConfig()
  await stopServer()
  if (cfg.enabled) {
    await startServer(cfg.port, cfg.token)
  }
}
