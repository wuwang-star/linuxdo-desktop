import { defineStore } from 'pinia'
import type { DiscourseTopicLite, DiscourseUserLite, TopicListResponse, TopPeriod } from '../../../main/api/client'
import type { OfflineIndexEntry } from '../../../main/api/offline'
import { useFavoritesStore, type FavEntry } from './favorites'

export type ListMode =
  | { type: 'latest'; order?: 'views' }
  | { type: 'hot' }
  | { type: 'top'; period: TopPeriod; viewsSort?: boolean }
  | { type: 'category'; slug: string; id: number; name: string }
  | { type: 'offline' }
  | { type: 'favorites'; folderId: string }

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
    error: '' as string,
    /** 离线模式：index 列表（本地 IPC，不发网络请求） */
    offlineEntries: [] as OfflineIndexEntry[],
    /** 收藏夹模式：快照条目（本地 favorites store，不发网络请求，离线可见） */
    favRows: [] as FavEntry[]
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
      this.favRows = []
      await this.loadMore()
    },
    async loadMore() {
      if (this.loading || this.exhausted) return
      // 收藏夹模式：本地快照一次取完即 exhausted（无分页、无网络请求，离线可用）
      if (this.mode.type === 'favorites') {
        this.loading = true
        try {
          this.favRows = useFavoritesStore().entriesOf(this.mode.folderId)
          this.exhausted = true
        } finally {
          this.loading = false
        }
        return
      }
      // 离线模式：读本地 index，一次取完即 exhausted（无分页）
      if (this.mode.type === 'offline') {
        this.loading = true
        try {
          this.offlineEntries = await window.api.offlineList()
          this.exhausted = true
        } catch (e) {
          this.error = e instanceof Error ? e.message : String(e)
        } finally {
          this.loading = false
        }
        return
      }
      this.loading = true
      try {
        const page = this.page
        const mode = this.mode
        // hot/top 与 latest 同构（page 参数递增分页，与 latest 同法；去重由下方 seen 兜底）
        let res: TopicListResponse
        switch (mode.type) {
          case 'latest':
            res = await window.api.fetchLatest(page, (mode as { order?: 'views' }).order)
            break
          case 'hot':
            res = await window.api.fetchHot(page)
            break
          case 'top': {
            res = await window.api.fetchTop(mode.period, page)
            // viewsSort：该周期创建帖按累计浏览降序（Discourse 无周期浏览增量端点，客户端重排近似）
            if ((mode as { viewsSort?: boolean }).viewsSort) {
              const tl = res.topic_list
              res = {
                ...res,
                topic_list: { ...tl, topics: [...tl.topics].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)) }
              }
            }
            break
          }
          default:
            res = await window.api.fetchCategoryTopics(mode.slug, mode.id, page)
        }
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
