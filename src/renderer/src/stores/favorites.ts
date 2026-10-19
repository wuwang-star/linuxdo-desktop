import { defineStore } from 'pinia'

/**
 * 多收藏夹：纯本地状态（localStorage 键 ldd-favorites），独立于站点 Discourse 书签（两套并行：
 * 站点书签归站点，本地夹归应用）。同帖可入多夹；入夹时保存条目快照（标题/时间/计数/OP 头像），
 * 列表筛选模式据快照渲染（离线可见）。云同步走 SyncBundle v2 favorites 字段
 * （main↔renderer 请求-应答，见 main/api/syncdata.ts 与 SettingsView 响应器）。
 */
const STORAGE_KEY = 'ldd-favorites'

/** 内置默认收藏夹 id（不可删除） */
export const DEFAULT_FOLDER_ID = 'default'

/** 条目快照（入夹时定格；同帖多夹共享一份，再次入夹时刷新） */
export interface FavEntry {
  id: number
  title: string
  views: number
  like_count: number
  posts_count: number
  created_at: string
  /** OP 头像模板（未知为空串） */
  avatar_template: string
}

export interface FavFolder {
  id: string
  name: string
  createdAt: number
  topicIds: number[]
}

interface FavData {
  folders: FavFolder[]
  entries: Record<string, FavEntry>
}

function defaultFolder(): FavFolder {
  return { id: DEFAULT_FOLDER_ID, name: '默认收藏夹', createdAt: 0, topicIds: [] }
}

/** 脏数据容错读取：坏条目跳过，默认夹缺失补回（v1 时代无此键 → 空结构） */
function loadAll(): FavData {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<FavData> | null
    const folders = Array.isArray(parsed?.folders)
      ? (parsed?.folders as FavFolder[]).filter(
          (f) => !!f && typeof f.id === 'string' && typeof f.name === 'string' && Array.isArray(f.topicIds)
        )
      : []
    if (!folders.some((f) => f.id === DEFAULT_FOLDER_ID)) folders.unshift(defaultFolder())
    const entries =
      parsed?.entries && typeof parsed.entries === 'object' ? (parsed.entries as Record<string, FavEntry>) : {}
    return { folders, entries }
  } catch {
    return { folders: [defaultFolder()], entries: {} }
  }
}

/** 云端回写前的归一：跳过非法夹/快照，防脏数据扩散（拉取入口第二道防线，主进程 validate 已滤一遍） */
function normalizeFolders(raw: unknown): FavFolder[] {
  if (!Array.isArray(raw)) return []
  const out: FavFolder[] = []
  for (const item of raw) {
    const f = item as Partial<FavFolder> | null
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !Array.isArray(f.topicIds)) continue
    const ids = [...new Set(f.topicIds.filter((n) => typeof n === 'number' && Number.isInteger(n) && n > 0))]
    out.push({
      id: f.id.slice(0, 64),
      name: f.name.slice(0, 60) || '未命名收藏夹',
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : 0,
      topicIds: ids
    })
  }
  return out
}

function normalizeSnapshots(raw: unknown): Record<string, FavEntry> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, FavEntry> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d+$/.test(k)) continue
    const e = v as Partial<FavEntry> | null
    if (!e || typeof e !== 'object' || typeof e.title !== 'string') continue
    out[k] = {
      id: Number(k),
      title: e.title,
      views: typeof e.views === 'number' ? e.views : 0,
      like_count: typeof e.like_count === 'number' ? e.like_count : 0,
      posts_count: typeof e.posts_count === 'number' ? e.posts_count : 0,
      created_at: typeof e.created_at === 'string' ? e.created_at : '',
      avatar_template: typeof e.avatar_template === 'string' ? e.avatar_template : ''
    }
  }
  return out
}

export const useFavoritesStore = defineStore('favorites', {
  state: () => {
    const data = loadAll()
    return {
      folders: data.folders,
      /** topicId（字符串键）→ 快照 */
      snapshots: data.entries
    }
  },
  getters: {
    folder: (s) => (id: string) => s.folders.find((f) => f.id === id),
    /** 帖子在哪些夹里（勾选态） */
    folderIdsOf: (s) => (topicId: number) => s.folders.filter((f) => f.topicIds.includes(topicId)).map((f) => f.id),
    /** 某夹条目（夹内顺序，快照缺失的跳过） */
    entriesOf: (s) => (folderId: string) => {
      const f = s.folders.find((x) => x.id === folderId)
      if (!f) return []
      return f.topicIds.flatMap((id) => s.snapshots[String(id)] ?? [])
    },
    /** 跨夹去重帖数（同步状态行用） */
    totalTopics: (s) => new Set(s.folders.flatMap((f) => f.topicIds)).size
  },
  actions: {
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders: this.folders, entries: this.snapshots }))
      } catch {
        /* 写失败静默（仅丢持久化，进程内仍可用），与 queue/progress 同策略 */
      }
    },
    createFolder(name: string): FavFolder {
      const f: FavFolder = {
        id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim().slice(0, 60) || '未命名收藏夹',
        createdAt: Date.now(),
        topicIds: []
      }
      this.folders.push(f)
      this.persist()
      return f
    },
    renameFolder(id: string, name: string) {
      const f = this.folders.find((x) => x.id === id)
      if (!f) return
      const trimmed = name.trim()
      if (trimmed) f.name = trimmed.slice(0, 60)
      this.persist()
    },
    /** 删除夹：默认夹拒绝；夹内帖子仅在无任何夹引用时清快照 */
    removeFolder(id: string) {
      if (id === DEFAULT_FOLDER_ID) return
      const gone = this.folders.find((x) => x.id === id)
      if (!gone) return
      this.folders = this.folders.filter((x) => x.id !== id)
      const referenced = new Set(this.folders.flatMap((x) => x.topicIds))
      for (const tid of gone.topicIds) {
        if (!referenced.has(tid)) delete this.snapshots[String(tid)]
      }
      this.persist()
    },
    /** 入/出夹：on=true 刷新快照；出夹后无夹引用则清快照 */
    setTopic(folderId: string, topicId: number, snap: FavEntry | null, on: boolean) {
      const f = this.folders.find((x) => x.id === folderId)
      if (!f) return
      if (on) {
        if (!f.topicIds.includes(topicId)) f.topicIds.push(topicId)
        if (snap) this.snapshots[String(topicId)] = snap
      } else {
        f.topicIds = f.topicIds.filter((id) => id !== topicId)
        const stillReferenced = this.folders.some((x) => x.topicIds.includes(topicId))
        if (!stillReferenced) delete this.snapshots[String(topicId)]
      }
      this.persist()
    },
    /** 云同步采集（favorites:getAll 应答）；深拷贝脱响应式，IPC 结构化克隆安全 */
    exportData(): FavData {
      return JSON.parse(JSON.stringify({ folders: this.folders, entries: this.snapshots })) as FavData
    },
    /** 云端回写（favorites:applyAll 应答）：整体覆盖（拉取=云端覆盖本地，与进度/偏好同语义），默认夹保证存在 */
    applyRemote(payload: unknown) {
      const folders = normalizeFolders((payload as Partial<FavData> | null)?.folders)
      const snapshots = normalizeSnapshots((payload as Partial<FavData> | null)?.entries)
      if (!folders.some((f) => f.id === DEFAULT_FOLDER_ID)) folders.unshift(defaultFolder())
      this.folders = folders
      // 只留仍被引用的快照
      const referenced = new Set(folders.flatMap((f) => f.topicIds))
      this.snapshots = Object.fromEntries(Object.entries(snapshots).filter(([k]) => referenced.has(Number(k))))
      this.persist()
    }
  }
})
