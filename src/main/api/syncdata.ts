import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { randomBytes } from 'node:crypto'
import { getDohConfig, getNotificationConfig, getTranslateConfig, setDohConfig, setNotificationConfig, setTranslateConfig, type DohMode } from './settings'
import { putBundle, getBundle } from './webdav'

/**
 * 同步数据聚合与回写（WebDAV 手动推送/拉取的数据面）。
 *
 * 进度存储定位（实现第 0 步）：阅读进度存 renderer localStorage（键 `ldd:progress:<topicId>`，
 * stores/topic.ts saveProgress/readProgress），主进程不可直读；阅读偏好在 localStorage `ldd-reading`。
 * 两者聚合/回写走 main↔renderer 请求-应答 IPC：askRenderer 发 `progress:getAll` / `prefs:getAll` /
 * `progress:applyAll` / `prefs:applyAll`（token 匹配 + 超时），renderer 端响应器注册在设置页
 * （SettingsView 挂载期），应答经固定通道 `syncdata:reply`。
 *
 * 凭据边界（ALDR omittedSecrets 模式）：bundle 不含 translate key / connect secret / _t / WebDAV
 * 密码任何一项——settings 段只取非凭据字段，translate 不带 key。
 */

/** 收藏夹条目快照（主进程侧结构镜像，与 renderer stores/favorites.ts FavEntry 对齐；不 import renderer 模块） */
export interface SyncFavEntry {
  id: number
  title: string
  views: number
  like_count: number
  posts_count: number
  created_at: string
  avatar_template: string
}

/** 收藏夹（v2 起进 bundle；folders 整体 + 快照表，离线列表靠快照渲染） */
export interface SyncFavorites {
  folders: Array<{ id: string; name: string; createdAt: number; topicIds: number[] }>
  entries: Record<string, SyncFavEntry>
}

/** 同步 bundle（schema v2，远端固定文件名 linuxdo-sync.json；v1 读取兼容见 validateBundle） */
export interface SyncBundle {
  schemaVersion: number
  exportedAt: string
  /** topicId → 已读楼层 */
  progress: Record<string, number>
  /** 阅读体感偏好（ldd-reading 原始形态，写入端经 normalizePrefs 归一） */
  readingPrefs: Record<string, unknown>
  /** 收藏夹；null = v1 旧包无此字段（读取不炸，且不回写本地收藏夹） */
  favorites: SyncFavorites | null
  settings: {
    doh: { enabled: boolean; mode: DohMode; template: string }
    notification: { enabled: boolean }
    translate: { baseUrl: string; model: string }
  }
}

/** main→renderer 请求通道（与设计稿通道名一致；应答统一走 syncdata:reply） */
type SyncRequestChannel =
  | 'prefs:getAll'
  | 'prefs:applyAll'
  | 'progress:getAll'
  | 'progress:applyAll'
  | 'favorites:getAll'
  | 'favorites:applyAll'

interface PendingReply {
  resolve: (v: unknown) => void
  timer: NodeJS.Timeout
}

const pending = new Map<string, PendingReply>()

/**
 * main→renderer 单次请求-应答：token 匹配 + 超时（默认 8s）。
 * renderer 无响应器（同步页未挂载）或窗口已关时以明确文案失败。
 */
function askRenderer<T>(sender: WebContents, channel: SyncRequestChannel, payload?: unknown, timeoutMs = 8_000): Promise<T> {
  const token = randomBytes(8).toString('hex')
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(token)
      reject(new Error('与设置页交换数据超时（请打开设置中心后重试）'))
    }, timeoutMs)
    pending.set(token, {
      resolve: (v: unknown) => {
        clearTimeout(timer)
        resolve(v as T)
      },
      timer
    })
    if (sender.isDestroyed()) {
      clearTimeout(timer)
      pending.delete(token)
      reject(new Error('窗口已关闭，无法交换数据'))
      return
    }
    sender.send(channel, token, payload)
  })
}

/** 注册固定应答通道（registerIpc 时调用一次）；超时后迟到的应答静默丢弃 */
export function initSyncReply(): void {
  ipcMain.on('syncdata:reply', (_e, token: string, data: unknown) => {
    const p = pending.get(token)
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(token)
    p.resolve(data)
  })
}

/** 聚合本地数据为 bundle：进度 + 偏好 + 收藏夹（经 IPC 向 renderer 取）+ settings 非凭据段 */
export async function collectBundle(sender: WebContents): Promise<SyncBundle> {
  const progress = await askRenderer<Record<string, number>>(sender, 'progress:getAll')
  const readingPrefs = await askRenderer<Record<string, unknown>>(sender, 'prefs:getAll')
  const favorites = await askRenderer<unknown>(sender, 'favorites:getAll')
  const tr = getTranslateConfig()
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    progress: progress && typeof progress === 'object' ? progress : {},
    readingPrefs: readingPrefs && typeof readingPrefs === 'object' ? readingPrefs : {},
    favorites: collectFavorites(favorites),
    settings: {
      doh: getDohConfig(),
      notification: getNotificationConfig(),
      // 只取非凭据字段（key 绝不进 bundle）
      translate: { baseUrl: tr.baseUrl, model: tr.model }
    }
  }
}

/** 采集端容错：renderer 应答形状异常时给空结构（本地 store 正常时恒为完整形状，此为兜底） */
function collectFavorites(raw: unknown): SyncFavorites {
  const o = raw as Partial<SyncFavorites> | null
  if (!o || typeof o !== 'object') return { folders: [], entries: {} }
  return {
    folders: Array.isArray(o.folders) ? o.folders : [],
    entries: o.entries && typeof o.entries === 'object' ? o.entries : {}
  }
}

/** bundle 逐字段校验：非法 throw 明确中文文案（拉取入口统一防线）；favorites 逐条容错（脏条目跳过不炸） */
export function validateBundle(raw: unknown): SyncBundle {
  if (typeof raw !== 'object' || raw === null) throw new Error('同步数据不合法：不是 JSON 对象')
  const b = raw as Record<string, unknown>
  if (b.schemaVersion !== 1 && b.schemaVersion !== 2) {
    throw new Error(`同步数据版本不受支持：${String(b.schemaVersion)}（本应用支持 v1 / v2）`)
  }

  // progress：键=纯数字 topicId，值=正整数楼层；非法条目跳过（防脏数据扩散）
  const progress: Record<string, number> = {}
  if (b.progress !== undefined && b.progress !== null) {
    if (typeof b.progress !== 'object') throw new Error('同步数据不合法：progress 不是对象')
    for (const [k, v] of Object.entries(b.progress as Record<string, unknown>)) {
      if (!/^\d+$/.test(k)) continue
      const n = Number(v)
      if (Number.isInteger(n) && n > 0) progress[k] = n
    }
  }

  if (typeof b.readingPrefs !== 'object' || b.readingPrefs === null) {
    throw new Error('同步数据不合法：readingPrefs 字段缺失')
  }

  if (typeof b.settings !== 'object' || b.settings === null) {
    throw new Error('同步数据不合法：settings 字段缺失')
  }
  const st = b.settings as Partial<SyncBundle['settings']>
  const doh = st.doh
  if (
    typeof doh !== 'object' ||
    doh === null ||
    typeof doh.enabled !== 'boolean' ||
    (doh.mode !== 'secure' && doh.mode !== 'auto') ||
    typeof doh.template !== 'string'
  ) {
    throw new Error('同步数据不合法：settings.doh 字段不完整')
  }
  const notif = st.notification
  if (typeof notif !== 'object' || notif === null || typeof notif.enabled !== 'boolean') {
    throw new Error('同步数据不合法：settings.notification 字段不完整')
  }
  const tr = st.translate
  if (
    typeof tr !== 'object' ||
    tr === null ||
    typeof tr.baseUrl !== 'string' ||
    typeof tr.model !== 'string'
  ) {
    throw new Error('同步数据不合法：settings.translate 字段不完整')
  }

  // favorites：v1 旧包无此字段 → null（不回写本地收藏夹）；v2 逐条容错，脏夹/脏快照跳过
  let favorites: SyncFavorites | null = null
  if (b.schemaVersion >= 2 && typeof b.favorites === 'object' && b.favorites !== null) {
    const fv = b.favorites as Partial<SyncFavorites>
    const folders: SyncFavorites['folders'] = []
    if (Array.isArray(fv.folders)) {
      for (const item of fv.folders) {
        const f = item as Partial<SyncFavorites['folders'][number]> | null
        if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !Array.isArray(f.topicIds)) continue
        folders.push({
          id: f.id.slice(0, 64),
          name: typeof f.name === 'string' ? f.name.slice(0, 60) : '未命名收藏夹',
          createdAt: typeof f.createdAt === 'number' ? f.createdAt : 0,
          topicIds: [...new Set(f.topicIds.filter((n) => typeof n === 'number' && Number.isInteger(n) && n > 0))]
        })
      }
    }
    const entries: Record<string, SyncFavEntry> = {}
    if (fv.entries && typeof fv.entries === 'object') {
      for (const [k, v] of Object.entries(fv.entries as Record<string, unknown>)) {
        if (!/^\d+$/.test(k)) continue
        const e = v as Partial<SyncFavEntry> | null
        if (!e || typeof e !== 'object' || typeof e.title !== 'string') continue
        entries[k] = {
          id: Number(k),
          title: e.title,
          views: typeof e.views === 'number' ? e.views : 0,
          like_count: typeof e.like_count === 'number' ? e.like_count : 0,
          posts_count: typeof e.posts_count === 'number' ? e.posts_count : 0,
          created_at: typeof e.created_at === 'string' ? e.created_at : '',
          avatar_template: typeof e.avatar_template === 'string' ? e.avatar_template : ''
        }
      }
    }
    favorites = { folders, entries }
  }

  return {
    schemaVersion: b.schemaVersion,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    progress,
    readingPrefs: b.readingPrefs as Record<string, unknown>,
    favorites,
    settings: {
      doh: { enabled: doh.enabled, mode: doh.mode, template: doh.template },
      notification: { enabled: notif.enabled },
      translate: { baseUrl: tr.baseUrl, model: tr.model }
    }
  }
}

/** 反向写入：进度整体覆盖 + prefs 写 localStorage 并即时应用（renderer 侧）+ 收藏夹回写（v1 包跳过）+ settings 更新（主进程侧） */
export async function applyRemoteBundle(sender: WebContents, raw: unknown): Promise<SyncBundle> {
  const b = validateBundle(raw)
  await askRenderer(sender, 'progress:applyAll', b.progress)
  await askRenderer(sender, 'prefs:applyAll', b.readingPrefs)
  // v1 旧包 favorites=null：本地收藏夹原样保留（拉旧包不丢本地数据）
  if (b.favorites) await askRenderer(sender, 'favorites:applyAll', b.favorites)
  // settings 反向写入；setTranslateConfig 不传 key = 本机翻译密钥保持不动（凭据边界）
  setDohConfig(b.settings.doh.enabled, b.settings.doh.mode, b.settings.doh.template)
  setNotificationConfig(b.settings.notification.enabled)
  setTranslateConfig(b.settings.translate.baseUrl, b.settings.translate.model)
  return b
}

// ---------- 推送 / 拉取编排（IPC 入口，结果对象风格与 connect.ts 一致） ----------

export async function pushBundle(sender: WebContents): Promise<{ ok: boolean; error?: string }> {
  try {
    const bundle = await collectBundle(sender)
    await putBundle(JSON.stringify(bundle, null, 2))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function pullBundle(
  sender: WebContents
): Promise<{ ok: boolean; exportedAt?: string; error?: string }> {
  try {
    const text = await getBundle()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('远端数据不是合法 JSON（文件损坏或被改写？）')
    }
    const b = await applyRemoteBundle(sender, parsed)
    return { ok: true, exportedAt: b.exportedAt }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
