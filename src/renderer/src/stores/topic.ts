import { defineStore } from 'pinia'
import type { DiscoursePost, DiscourseTopic } from '../../../main/api/client'

const CHUNK = 20
const progressKey = (topicId: number): string => `ldd:progress:${topicId}`

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
    error: ''
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
    },
    ingestPosts(posts: DiscoursePost[]) {
      for (const p of posts) {
        this.postsById.set(p.id, p)
        this.postNumberToId.set(p.post_number, p.id)
      }
    },
    async open(topicId: number) {
      this.reset()
      this.loading = true
      try {
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
        // 恢复进度：无进度则从 1 楼开始读
        const saved = Number(localStorage.getItem(progressKey(topicId)) ?? '0')
        if (saved > 1) {
          await this.jumpTo(saved)
        } else if (this.minLoadedIdx > 0) {
          await this.loadChunk(0, CHUNK)
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
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
    }
  }
})
