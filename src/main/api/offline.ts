import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fetchTopic, fetchPostsByIds, type DiscoursePost } from './client'

/**
 * 离线 Topic 存储（JSON 文件，userData/offline/<id>.json + index.json）。
 * 选型说明：不引入 better-sqlite3——原生模块构建/打包风险大，当前查询场景只有 index 列表，
 * JSON 足够；条目过千或需要索引查询时再迁 sqlite（届时只改本文件读写层）。
 * 快照语义：保存时点全量快照（新回复不含），不缓存图片/附件（离线阅读文本为 MVP 边界）。
 */

const CHUNK = 20

/** 单个离线快照文件结构 */
export interface OfflineTopic {
  id: number
  title: string
  created_at?: string
  posts_count: number
  /** 全量楼层（cooked HTML，与在线渲染同构，PostItem 可直接复用） */
  posts: DiscoursePost[]
  savedAt: string
}

/** index.json 条目 */
export interface OfflineIndexEntry {
  id: number
  title: string
  posts_count: number
  savedAt: string
}

export interface SaveResult {
  ok: boolean
  count?: number
  error?: string
}

const dir = (): string => join(app.getPath('userData'), 'offline')
const fileOf = (id: number): string => join(dir(), `${id}.json`)
const indexFile = (): string => join(dir(), 'index.json')

function ensureDir(): void {
  mkdirSync(dir(), { recursive: true })
}

/** 原子写：临时文件 + rename（同目录同卷），防半截 JSON */
function writeAtomic(target: string, data: string): void {
  const tmp = `${target}.${process.pid}.tmp`
  writeFileSync(tmp, data, 'utf8')
  renameSync(tmp, target)
}

function readIndex(): OfflineIndexEntry[] {
  try {
    if (!existsSync(indexFile())) return []
    const raw = JSON.parse(readFileSync(indexFile(), 'utf8')) as OfflineIndexEntry[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return [] // index 损坏不致命：文件仍在，重新保存即可恢复条目
  }
}

/**
 * 全量拉取主题并落盘：fetchTopic → 按 stream 顺序循环 fetchPostsByIds（每批 CHUNK，进度回调）
 * → 内存组装 → 最后一次性写文件（分块中途失败即中止，绝不写半截快照）。
 */
export async function saveTopic(
  id: number,
  onProgress?: (loaded: number, total: number) => void
): Promise<SaveResult> {
  try {
    const topic = await fetchTopic(id)
    const stream = topic.post_stream?.stream ?? []
    const byId = new Map<number, DiscoursePost>()
    // 首屏帖子 fetchTopic 已返回，直接入表，分块循环自动跳过
    for (const p of topic.post_stream?.posts ?? []) byId.set(p.id, p)

    let loaded = 0
    for (let i = 0; i < stream.length; i += CHUNK) {
      const slice = stream.slice(i, i + CHUNK)
      const missing = slice.filter((pid) => !byId.has(pid))
      if (missing.length > 0) {
        const res = await fetchPostsByIds(id, missing)
        for (const p of res.post_stream?.posts ?? []) byId.set(p.id, p)
      }
      loaded = Math.min(i + CHUNK, stream.length)
      onProgress?.(loaded, stream.length)
    }

    // 按 stream 顺序组装（服务端缺楼的极端情况跳过该楼，以实际拿到的为准）
    const posts: DiscoursePost[] = []
    for (const pid of stream) {
      const p = byId.get(pid)
      if (p) posts.push(p)
    }

    const snapshot: OfflineTopic = {
      id: topic.id,
      title: topic.title,
      created_at: topic.created_at,
      posts_count: topic.posts_count,
      posts,
      savedAt: new Date().toISOString()
    }

    ensureDir()
    writeAtomic(fileOf(id), JSON.stringify(snapshot))

    // index 最后写：崩溃最坏情况 = 有快照文件无索引条目（列表缺条可接受，重存即恢复）
    const entries = readIndex().filter((e) => e.id !== id)
    entries.unshift({ id, title: snapshot.title, posts_count: snapshot.posts_count, savedAt: snapshot.savedAt })
    writeAtomic(indexFile(), JSON.stringify(entries, null, 2))

    return { ok: true, count: posts.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function listTopics(): OfflineIndexEntry[] {
  return readIndex()
}

export function getTopic(id: number): OfflineTopic | null {
  try {
    if (!existsSync(fileOf(id))) return null
    return JSON.parse(readFileSync(fileOf(id), 'utf8')) as OfflineTopic
  } catch {
    return null // 文件损坏等同无档
  }
}

/** 删除快照并同步移除 index 条目 */
export function removeTopic(id: number): boolean {
  try {
    if (existsSync(fileOf(id))) rmSync(fileOf(id))
    const entries = readIndex().filter((e) => e.id !== id)
    ensureDir()
    writeAtomic(indexFile(), JSON.stringify(entries, null, 2))
    return true
  } catch {
    return false
  }
}
