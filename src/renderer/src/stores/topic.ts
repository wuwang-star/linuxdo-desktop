import { defineStore } from 'pinia'
import type { DiscoursePost, DiscourseTopic } from '../../../main/api/client'
import type { OfflineTopic } from '../../../main/api/offline'

const CHUNK = 20
const progressKey = (topicId: number): string => `ldd:progress:${topicId}`
const LIKE_ACTION = 2

/** 楼中楼串成员：楼层 + 相对串根的回复深度（渲染层级） */
export interface ThreadMember {
  post: DiscoursePost
  /** 1 = 根的直接回复（2 级缩进）；2 = 回复的回复（3 级缩进）；更深的 reply 链钳制为 2，平铺续接（引用关系由「回复 #N」chip 表达） */
  depth: number
}

/** 楼中楼折叠渲染项：主干楼层 + 以该楼为串根的回复成员（平铺，升序） */
export interface TrunkItem {
  post: DiscoursePost
  thread: ThreadMember[]
}

/** 渲染层级钳制：>2 级的 reply 链全部续接在第 3 级缩进上 */
const THREAD_DEPTH_MAX = 2

/**
 * 楼中楼聚类（feishu-im-frame 唯一模式，纯函数幂等——loadOlder 增量加载后重算即可）：
 * 1. 有 reply_to 且 parent 在已加载范围 → 沿链上溯到串根（无 reply_to 或 parent 未加载的楼层），
 *    沿途跳数即成员相对串根的深度
 * 2. 串成员 = 以该根为祖先的所有回复（post_number 升序平铺，深度钳制 ≤2）
 * 3. 主干 = 非成员楼层（含串根）
 */
export function clusterThreads(posts: DiscoursePost[]): {
  items: TrunkItem[]
  rootOf: Map<number, number>
} {
  const byNumber = new Map<number, DiscoursePost>()
  for (const p of posts) byNumber.set(p.post_number, p)
  // post_number → 串根 post_number（仅成员有记录；主干楼/环/父缺失不入表）
  const rootOf = new Map<number, number>()
  // post_number → 相对串根的回复深度（与 rootOf 同键）
  const depthOf = new Map<number, number>()
  for (const p of posts) {
    if (!p.reply_to_post_number) continue
    const seen = new Set<number>([p.post_number])
    let cur: DiscoursePost | undefined = p
    let depth = 0
    let root = -1
    while (cur) {
      const pn = cur.reply_to_post_number
      // 无 reply_to / 自引用 / 父楼未加载 → 当前楼即串根；环防御同回路
      if (!pn || pn === cur.post_number || !byNumber.has(pn) || seen.has(pn)) {
        root = cur.post_number
        break
      }
      seen.add(pn)
      depth++
      cur = byNumber.get(pn)
    }
    if (root >= 0 && root !== p.post_number) {
      rootOf.set(p.post_number, root)
      depthOf.set(p.post_number, depth)
    }
  }
  const items: TrunkItem[] = []
  const indexOf = new Map<number, number>()
  for (const p of posts) {
    const root = rootOf.get(p.post_number)
    if (root === undefined) {
      indexOf.set(p.post_number, items.length)
      items.push({ post: p, thread: [] })
    } else {
      // Discourse 保证 reply 楼号大于被回复楼，串根先于成员出现；脏数据兜底丢弃
      const item = items[indexOf.get(root) ?? -1]
      if (item) item.thread.push({ post: p, depth: Math.min(depthOf.get(p.post_number) ?? 1, THREAD_DEPTH_MAX) })
    }
  }
  return { items, rootOf }
}

/** 解析 post 的点赞状态（Discourse actions_summary 中 id=2 为 like） */
export function likeInfo(post: DiscoursePost): { count: number; acted: boolean } {
  const a = post.actions_summary?.find((x) => x.id === LIKE_ACTION)
  return { count: a?.count ?? 0, acted: a?.acted === true }
}

/** 本地更新点赞状态（乐观 UI） */
function withLike(post: DiscoursePost, liked: boolean, delta: number): DiscoursePost {
  const summary = (post.actions_summary ?? []).map((s) => ({ ...s }))
  const idx = summary.findIndex((s) => s.id === LIKE_ACTION)
  if (idx >= 0) {
    summary[idx] = {
      ...summary[idx],
      count: Math.max(0, (summary[idx].count ?? 0) + delta),
      acted: liked
    }
  } else {
    summary.push({ id: LIKE_ACTION, count: Math.max(0, delta), acted: liked })
  }
  return { ...post, actions_summary: summary }
}

export interface TopicState {
  topic: DiscourseTopic | null
  stream: number[]
  postsById: Map<number, DiscoursePost>
  postNumberToId: Map<number, number>
  minLoadedIdx: number
  maxLoadedIdx: number
  loading: boolean
  loadingOlder: boolean
  onlyOp: boolean
  currentPostNumber: number
  /** 视图待消费的跳转目标楼层（消费后置 0） */
  pendingJump: number
  error: string
  /** 当前是否以离线快照阅读（隐藏互动操作） */
  offline: boolean
  /** 离线快照的保存时间（R4「保存于 X 前」展示用） */
  offlineSavedAt: string
  /** 在线打开失败且本地有离线存档（TopicView 据此渲染离线入口提示条） */
  hasOffline: boolean
  /** 最近一次 open 的主题 id（retry 用：open 失败时 topic 为 null，不能从 topic 读） */
  lastOpenedId: number | null
  /** 回复关系跳转的目标楼层高亮（10-18-user-flow-ui，1.6s 自清） */
  flashPn: number
}

let flashTimer: number | undefined

export const useTopicStore = defineStore('topic', {
  state: (): TopicState => ({
    topic: null,
    stream: [],
    postsById: new Map(),
    postNumberToId: new Map(),
    minLoadedIdx: Number.MAX_SAFE_INTEGER,
    maxLoadedIdx: -1,
    loading: false,
    loadingOlder: false,
    onlyOp: false,
    currentPostNumber: 1,
    pendingJump: 0,
    error: '',
    offline: false,
    offlineSavedAt: '',
    hasOffline: false,
    lastOpenedId: null,
    flashPn: 0
  }),
  getters: {
    opUsername(state): string | null {
      return (
        state.topic?.details?.created_by?.username ??
        state.postsById.get(state.stream[0] ?? -1)?.username ??
        null
      )
    },
    orderedPosts(state): DiscoursePost[] {
      const out: DiscoursePost[] = []
      for (let i = state.minLoadedIdx; i <= state.maxLoadedIdx; i++) {
        const id = state.stream[i]
        const p = state.postsById.get(id)
        if (p) out.push(p)
      }
      return out
    },
    visiblePosts(): DiscoursePost[] {
      const all = this.orderedPosts
      if (!this.onlyOp || !this.opUsername) return all
      return all.filter((p) => p.username === this.opUsername)
    }
  },
  actions: {
    reset() {
      this.topic = null
      this.stream = []
      this.postsById = new Map()
      this.postNumberToId = new Map()
      this.minLoadedIdx = Number.MAX_SAFE_INTEGER
      this.maxLoadedIdx = -1
      this.onlyOp = false
      this.currentPostNumber = 1
      this.pendingJump = 0
      this.error = ''
      this.offline = false
      this.offlineSavedAt = ''
      this.hasOffline = false
    },
    ingestPosts(posts: DiscoursePost[]) {
      for (const p of posts) {
        this.postsById.set(p.id, p)
        this.postNumberToId.set(p.post_number, p.id)
      }
    },
    /** 离线快照 → store 状态（posts 已全量，无需网络加载流程） */
    ingestOffline(snap: OfflineTopic) {
      this.topic = {
        id: snap.id,
        title: snap.title,
        created_at: snap.created_at,
        posts_count: snap.posts_count,
        post_stream: { posts: snap.posts, stream: snap.posts.map((p) => p.id) }
      }
      this.stream = snap.posts.map((p) => p.id)
      this.ingestPosts(snap.posts)
      this.minLoadedIdx = 0
      this.maxLoadedIdx = Math.max(0, this.stream.length - 1)
      this.offlineSavedAt = snap.savedAt
    },
    async open(topicId: number, opts?: { offline?: boolean }) {
      this.reset()
      this.lastOpenedId = topicId
      this.offline = opts?.offline === true
      this.loading = true
      try {
        if (this.offline) {
          // 离线阅读：纯本地 IPC，不发起任何网络请求
          const snap = await window.api.offlineGet(topicId)
          if (!snap) throw new Error('离线存档不存在或已损坏')
          this.ingestOffline(snap)
        } else {
          const topic = await window.api.fetchTopic(topicId)
          this.topic = topic
          this.stream = topic.post_stream?.stream ?? []
          this.ingestPosts(topic.post_stream?.posts ?? [])
          // 标记初始已加载区间（按 stream 索引）
          for (const p of topic.post_stream?.posts ?? []) {
            const idx = this.stream.indexOf(p.id)
            if (idx >= 0) {
              this.minLoadedIdx = Math.min(this.minLoadedIdx, idx)
              this.maxLoadedIdx = Math.max(this.maxLoadedIdx, idx)
            }
          }
        }
        // 恢复进度：无进度则从 1 楼开始读（离线快照全量已加载，jumpTo 不会再触发网络）
        const saved = Number(localStorage.getItem(progressKey(topicId)) ?? '0')
        if (saved > 1) {
          await this.jumpTo(saved)
        } else if (this.minLoadedIdx > 0) {
          await this.loadChunk(0, CHUNK)
        }
      } catch (e) {
        // 统一「加载失败：」前缀（含「请求超时」），错误态透出重试入口
        this.error = `加载失败：${e instanceof Error ? e.message : String(e)}`
        // 在线打开失败：查本地 index 是否有离线存档，有则透出离线阅读入口
        if (!this.offline) {
          try {
            const entries = await window.api.offlineList()
            this.hasOffline = entries.some((t) => t.id === topicId)
          } catch {
            this.hasOffline = false
          }
        }
      } finally {
        this.loading = false
      }
    },
    /** 重试当前主题：清错误按最近一次 open 的 id/离线态重开（错误态时 topic 为 null，id 存在 lastOpenedId） */
    async retry(): Promise<void> {
      if (this.lastOpenedId === null || this.loading) return
      await this.open(this.lastOpenedId, { offline: this.offline })
    },
    async loadChunk(startIdx: number, count: number): Promise<void> {
      if (!this.stream.length || !this.topic) return
      const clampedStart = Math.max(0, startIdx)
      const ids = this.stream
        .slice(clampedStart, clampedStart + count)
        .filter((id) => !this.postsById.has(id))
      this.minLoadedIdx = Math.min(this.minLoadedIdx, clampedStart)
      this.maxLoadedIdx = Math.max(
        this.maxLoadedIdx,
        Math.min(this.stream.length - 1, clampedStart + count - 1)
      )
      if (ids.length === 0) return
      const res = await window.api.fetchPosts(this.topic.id, ids)
      this.ingestPosts(res.post_stream?.posts ?? [])
    },
    async loadOlder(): Promise<void> {
      if (this.loadingOlder || this.minLoadedIdx <= 0 || !this.topic) return
      this.loadingOlder = true
      try {
        await this.loadChunk(Math.max(0, this.minLoadedIdx - CHUNK), CHUNK)
      } finally {
        this.loadingOlder = false
      }
    },
    /** 回复关系跳转的目标楼层高亮 1.6s（重复调用重置计时，10-18-user-flow-ui） */
    flashPost(postNumber: number): void {
      this.flashPn = postNumber
      if (flashTimer !== undefined) window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => {
        this.flashPn = 0
        flashTimer = undefined
      }, 1600)
    },
    /** 跳到指定楼层：未加载则先加载该楼层所在分块 */
    async jumpTo(postNumber: number): Promise<void> {
      const target = Math.max(1, Math.min(postNumber, Math.max(1, this.stream.length)))
      const estIdx = Math.min(this.stream.length - 1, target - 1)
      if (!this.postNumberToId.has(target)) {
        await this.loadChunk(Math.max(0, estIdx - 2), CHUNK)
      }
      if (this.postNumberToId.has(target)) this.currentPostNumber = target
      this.pendingJump = target
    },
    saveProgress(topicId: number, postNumber: number) {
      if (postNumber <= 0) return
      const prev = Number(localStorage.getItem(progressKey(topicId)) ?? '0')
      if (postNumber > prev) localStorage.setItem(progressKey(topicId), String(postNumber))
      this.currentPostNumber = Math.max(this.currentPostNumber, postNumber)
    },
    readProgress(topicId: number): number {
      return Number(localStorage.getItem(progressKey(topicId)) ?? '0')
    },
    /** 回帖：成功后把新楼追加到流末尾并跳转过去 */
    async sendReply(raw: string, replyTo?: number): Promise<boolean> {
      if (!this.topic || !raw.trim()) return false
      try {
        const post = await window.api.createReply(this.topic.id, raw.trim(), replyTo)
        if (!this.postNumberToId.has(post.post_number)) {
          this.stream.push(post.id)
          this.ingestPosts([post])
          this.maxLoadedIdx = this.stream.length - 1
          this.pendingJump = post.post_number
        }
        return true
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
        return false
      }
    },
    /** 点赞/取消点赞（乐观更新，失败回滚并提示） */
    async toggleLike(postId: number): Promise<void> {
      const post = this.postsById.get(postId)
      if (!post) return
      const info = likeInfo(post)
      try {
        if (info.acted) {
          await window.api.unlikePost(postId)
          this.postsById.set(postId, withLike(post, false, -1))
        } else {
          await window.api.likePost(postId)
          this.postsById.set(postId, withLike(post, true, 1))
        }
      } catch (e) {
        this.postsById.set(postId, post)
        this.error = e instanceof Error ? e.message : String(e)
      }
    },
    /** 收藏主题（P1 仅添加） */
    async bookmark(): Promise<void> {
      if (!this.topic || this.topic.bookmarked) return
      try {
        await window.api.bookmarkTopic(this.topic.id)
        this.topic = { ...this.topic, bookmarked: true }
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
      }
    },
    /** 编辑楼层：成功后就地合并更新该楼；失败返回 false 且原楼不变 */
    async editPost(postId: number, raw: string): Promise<boolean> {
      const prev = this.postsById.get(postId)
      try {
        const updated = await window.api.updatePost(postId, raw.trim())
        // PUT 响应可能缺 can_edit/actions_summary 等字段，与旧对象合并避免丢编辑按钮/点赞态
        this.postsById.set(postId, prev ? { ...prev, ...updated } : updated)
        return true
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
        return false
      }
    }
  }
})
