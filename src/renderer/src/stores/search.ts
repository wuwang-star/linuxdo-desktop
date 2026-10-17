import { defineStore } from 'pinia'
import type { DiscourseTopicLite, SearchResponse } from '../../../main/api/client'
import { useTopicListStore } from './topicList'

/**
 * 搜索 MVP 状态（feishu-im-frame：输入框迁到 rail，结果仍渲染在列表中栏）。
 * 逻辑原样自 HomeView 迁入（交互等价迁移不重写）：q 原样透传 /search.json，
 * 400ms 防抖、page 翻页、seq 竞态守卫均保持不变。
 */
export interface SearchRow {
  id: number
  title: string
  blurb: string
  username: string
  categoryName: string
  postsCount: number
  likeCount: number
  createdAt: string
}

/** 竞态守卫：防抖连发时丢弃迟到响应（模块级，store 重建不重置） */
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined

export const useSearchStore = defineStore('search', {
  state: () => ({
    open: false,
    query: '',
    rows: [] as SearchRow[],
    page: 0,
    exhausted: false,
    loading: false,
    error: ''
  }),
  actions: {
    /** posts 按 topic_id 关联 topics 合并成行：标题/计数取 topic，摘要/作者/时间取 post */
    rowsOf(res: SearchResponse): SearchRow[] {
      const list = useTopicListStore()
      const topics = new Map((res.topics ?? []).map((t) => [t.id, t]))
      const cats = new Map<number, string>([
        ...(res.categories ?? []).map((c) => [c.id, c.name] as const),
        ...list.categories.map((c) => [c.id, c.name] as const)
      ])
      return (res.posts ?? []).flatMap((p) => {
        const t = topics.get(p.topic_id)
        if (!t) return []
        return [
          {
            id: t.id,
            title: t.title,
            blurb: p.blurb ?? '',
            username: p.username ?? t.last_poster_username ?? '',
            categoryName: cats.get(t.category_id ?? -1) ?? '',
            postsCount: t.posts_count,
            likeCount: t.like_count ?? 0,
            createdAt: p.created_at ?? t.last_posted_at ?? t.created_at ?? ''
          }
        ]
      })
    },
    async runSearch(page: number): Promise<void> {
      const q = this.query.trim()
      if (!q) return
      const cur = ++seq
      this.loading = true
      this.error = ''
      try {
        const res = await window.api.fetchSearch(q, page)
        if (cur !== seq) return
        const rows = this.rowsOf(res)
        if (page === 0) this.rows = rows
        else {
          const seen = new Set(this.rows.map((r) => r.id))
          this.rows.push(...rows.filter((r) => !seen.has(r.id)))
        }
        this.page = page
        if (rows.length === 0) this.exhausted = true
      } catch (e) {
        if (cur === seq) this.error = e instanceof Error ? e.message : String(e)
      } finally {
        if (cur === seq) this.loading = false
      }
    },
    onQueryInput(): void {
      if (timer) clearTimeout(timer)
      if (!this.query.trim()) {
        this.rows = []
        this.error = ''
        this.exhausted = false
        return
      }
      // rail 输入即进入搜索态（旧交互=点搜索钮先开态再输入；等价迁移）
      if (!this.open) void this.openSearch()
      timer = setTimeout(() => void this.runSearch(0), 400)
    },
    async openSearch(): Promise<void> {
      this.open = true
      await useTopicListStore().ensureCategories() // 结果行分类徽标的数据源
    },
    close(): void {
      if (timer) clearTimeout(timer)
      seq++ // 在途响应作废
      this.open = false
      this.query = ''
      this.rows = []
      this.error = ''
      this.exhausted = false
    }
  }
})
