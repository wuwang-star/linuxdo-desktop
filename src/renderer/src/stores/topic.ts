import { defineStore } from 'pinia'
import type { DiscoursePost, DiscourseTopic } from '../../../main/api/client'
import type { OfflineTopic } from '../../../main/api/offline'

const CHUNK = 20
const progressKey = (topicId: number): string => `ldd:progress:${topicId}`
const LIKE_ACTION = 2

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
}

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
    hasOffline: false
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
        this.error = e instanceof Error ? e.message : String(e)
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
