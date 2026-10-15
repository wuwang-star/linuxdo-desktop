import { defineStore } from 'pinia'

/**
 * 多主题阅读队列：纯本地状态（localStorage 键 ldd-queue），不发请求、不经 IPC。
 * 交互定稿（2026-10-15）：手动入队 + 按入队顺序读。
 */
const STORAGE_KEY = 'ldd-queue'

export interface QueueItem {
  id: number
  title: string
}

function load(): QueueItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is QueueItem => typeof (x as QueueItem)?.id === 'number')
  } catch {
    return []
  }
}

export const useQueueStore = defineStore('queue', {
  state: () => ({
    items: load()
  }),
  getters: {
    count: (s) => s.items.length,
    has: (s) => (topicId: number) => s.items.some((i) => i.id === topicId),
    /** 按入队顺序给出某主题的前/后一个主题 id（不在队列中则均为 null） */
    neighbors: (s) => (topicId: number) => {
      const idx = s.items.findIndex((i) => i.id === topicId)
      return {
        prev: idx > 0 ? s.items[idx - 1].id : null,
        next: idx >= 0 && idx < s.items.length - 1 ? s.items[idx + 1].id : null
      }
    }
  },
  actions: {
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items))
      } catch {
        /* quota 满/隐私模式写失败静默（仅丢持久化，进程内队列仍可用） */
      }
    },
    add(topicId: number, title: string) {
      if (this.has(topicId)) return
      this.items.push({ id: topicId, title })
      this.persist()
    },
    remove(topicId: number) {
      this.items = this.items.filter((i) => i.id !== topicId)
      this.persist()
    },
    clear() {
      this.items = []
      this.persist()
    }
  }
})
