import { defineStore } from 'pinia'
import type { DiscourseTopicLite, DiscourseUserLite, TopicListResponse } from '../../../main/api/client'

export type ListMode =
  | { type: 'latest' }
  | { type: 'category'; slug: string; id: number; name: string }

interface CategoryItem {
  id: number
  name: string
  slug: string
  color: string
  topic_count: number
}

export const useTopicListStore = defineStore('topicList', {
  state: () => ({
    mode: { type: 'latest' } as ListMode,
    topics: [] as DiscourseTopicLite[],
    usersById: new Map<number, DiscourseUserLite>(),
    categories: [] as CategoryItem[],
    categoriesLoaded: false,
    page: 0,
    exhausted: false,
    loading: false,
    error: '' as string
  }),
  actions: {
    absorb(res: TopicListResponse): DiscourseTopicLite[] {
      for (const u of res.users ?? []) this.usersById.set(u.id, u)
      return res.topic_list?.topics ?? []
    },
    async ensureCategories() {
      if (this.categoriesLoaded) return
      const res = await window.api.fetchCategories()
      this.categories = (res.category_list?.categories ?? []).slice(0, 30)
      this.categoriesLoaded = true
    },
    async switchMode(mode: ListMode) {
      this.mode = mode
      this.topics = []
      this.page = 0
      this.exhausted = false
      this.error = ''
      await this.loadMore()
    },
    async loadMore() {
      if (this.loading || this.exhausted) return
      this.loading = true
      try {
        const page = this.page
        const res =
          this.mode.type === 'latest'
            ? await window.api.fetchLatest(page)
            : await window.api.fetchCategoryTopics(this.mode.slug, this.mode.id, page)
        const incoming = this.absorb(res).filter((t) => t.pinned !== true || page === 0)
        const seen = new Set(this.topics.map((t) => t.id))
        this.topics.push(...incoming.filter((t) => !seen.has(t.id)))
        this.page = page + 1
        if (incoming.length === 0) this.exhausted = true
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
      }
    }
  }
})
