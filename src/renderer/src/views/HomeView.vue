<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, ref, computed } from 'vue'
import { useTopicListStore } from '../stores/topicList'
import { useQueueStore } from '../stores/queue'
import { useBrowseStore } from '../stores/browse'
import { avatarUrl, relTime } from '../utils/format'
import { openUserCard } from '../utils/userCard'
import type { DiscourseTopicLite, SearchResponse, TopPeriod } from '../../../main/api/client'

// pane=true：作为双栏左栏嵌入（点击行走 browse.select，URL 由 BrowseView 统一同步）；缺省为整页模式
const props = defineProps<{ pane?: boolean }>()
const store = useTopicListStore()
const queue = useQueueStore()
const browse = useBrowseStore()
const sentinel = ref<HTMLElement | null>(null)
const showCats = ref(false)

/** 列表行点击：pane 模式拦截 RouterLink 默认导航改走 store（双栏/窄屏分流由 BrowseView 处理）；整页模式走 RouterLink 原语义 */
function onTitleClick(e: MouseEvent, id: number, offline = false): void {
  if (!props.pane) return
  e.preventDefault()
  browse.select(id, offline)
}

function toggleQueue(t: DiscourseTopicLite): void {
  if (queue.has(t.id)) queue.remove(t.id)
  else queue.add(t.id, t.title)
}

const modeName = computed(() => (store.mode.type === 'category' ? store.mode.name : '分类'))

/** 行内 SVG 图标（16px stroke 系，替代 emoji 的跨平台一致渲染） */
const ICONS = {
  chat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.2-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
  lock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'
}

/** Top 榜周期（Discourse top.json 全六档）；下拉浮层选择，不插入 crumb 行 */
const topPeriods: Array<{ value: TopPeriod; label: string }> = [
  { value: 'daily', label: '日榜' },
  { value: 'weekly', label: '周榜' },
  { value: 'monthly', label: '月榜' },
  { value: 'quarterly', label: '季榜' },
  { value: 'yearly', label: '年榜' },
  { value: 'all', label: '总榜' }
]
const activePeriod = computed(() => (store.mode.type === 'top' ? store.mode.period : null))
const showTopPanel = ref(false)

/** Top/分类两浮层互斥：开一个关另一个 */
function toggleTopPanel(): void {
  showTopPanel.value = !showTopPanel.value
  showCats.value = false
}

function pickPeriod(p: TopPeriod): void {
  showTopPanel.value = false
  void store.switchMode({ type: 'top', period: p })
}

const topLabel = computed(
  () => topPeriods.find((p) => p.value === activePeriod.value)?.label ?? '周榜'
)

function opOf(topic: DiscourseTopicLite) {
  const first = topic.posters?.[0]?.user_id
  return first !== undefined ? store.usersById.get(first) : undefined
}

/** 打开首楼作者用户卡 */
function showUser(t: DiscourseTopicLite): void {
  const u = opOf(t)
  if (u) openUserCard(u.username)
}

/** 删除离线存档后重读 index */
async function removeOffline(id: number): Promise<void> {
  await window.api.offlineRemove(id)
  if (store.mode.type === 'offline') await store.switchMode({ type: 'offline' })
}

// ---------- 搜索态（嵌列表区，不新建路由；q 原样透传，@用户/#分类/order:latest 等操作符服务端解析） ----------
const searchOpen = ref(false)
const searchInputEl = ref<HTMLInputElement | null>(null)
const query = ref('')
const searchRows = ref<SearchRow[]>([])
const searchPage = ref(0)
const searchExhausted = ref(false)
const searchLoading = ref(false)
const searchError = ref('')
let searchSeq = 0 // 竞态守卫：防抖连发时丢弃迟到响应
let searchTimer: ReturnType<typeof setTimeout> | undefined

interface SearchRow {
  id: number
  title: string
  blurb: string
  username: string
  categoryName: string
  postsCount: number
  likeCount: number
  createdAt: string
}

/** posts 按 topic_id 关联 topics 合并成行：标题/计数取 topic，摘要/作者/时间取 post */
function rowsOf(res: SearchResponse): SearchRow[] {
  const topics = new Map((res.topics ?? []).map((t) => [t.id, t]))
  const cats = new Map<number, string>([
    ...(res.categories ?? []).map((c) => [c.id, c.name] as const),
    ...store.categories.map((c) => [c.id, c.name] as const)
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
}

async function runSearch(page: number): Promise<void> {
  const q = query.value.trim()
  if (!q) return
  const seq = ++searchSeq
  searchLoading.value = true
  searchError.value = ''
  try {
    const res = await window.api.fetchSearch(q, page)
    if (seq !== searchSeq) return
    const rows = rowsOf(res)
    if (page === 0) searchRows.value = rows
    else {
      const seen = new Set(searchRows.value.map((r) => r.id))
      searchRows.value.push(...rows.filter((r) => !seen.has(r.id)))
    }
    searchPage.value = page
    if (rows.length === 0) searchExhausted.value = true
  } catch (e) {
    if (seq === searchSeq) searchError.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (seq === searchSeq) searchLoading.value = false
  }
}

function onQueryInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  if (!query.value.trim()) {
    searchRows.value = []
    searchError.value = ''
    searchExhausted.value = false
    return
  }
  searchTimer = setTimeout(() => void runSearch(0), 400)
}

function openSearch(): void {
  searchOpen.value = true
  void store.ensureCategories() // 结果行分类徽标的数据源
  nextTick(() => searchInputEl.value?.focus())
}

function closeSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchSeq++ // 在途响应作废
  searchOpen.value = false
  query.value = ''
  searchRows.value = []
  searchError.value = ''
  searchExhausted.value = false
}

/** Ctrl/Cmd+K 唤起搜索并聚焦（已开则仅聚焦） */
function onGlobalKey(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (!searchOpen.value) openSearch()
    else searchInputEl.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  if (store.topics.length === 0) void store.switchMode({ type: 'latest' })
  const io = new IntersectionObserver(
    (entries) => {
      if (searchOpen.value) return // 搜索态不触发列表加载
      if (entries.some((e) => e.isIntersecting)) void store.loadMore()
    },
    { rootMargin: '400px' }
  )
  if (sentinel.value) io.observe(sentinel.value)
})

onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <div class="home">
    <div class="list-toolbar">
      <div v-if="!searchOpen" class="crumb">
        <button class="chip" :class="{ active: store.mode.type === 'latest' }" @click="store.switchMode({ type: 'latest' })">
          最新
        </button>
        <button class="chip" :class="{ active: store.mode.type === 'hot' }" @click="store.switchMode({ type: 'hot' })">
          最热
        </button>
        <div class="chip-wrap">
          <button
            class="chip"
            :class="{ active: store.mode.type === 'top' }"
            @click="toggleTopPanel"
          >
            {{ store.mode.type === 'top' ? `Top · ${topLabel}` : 'Top' }} ▾
          </button>
          <div v-if="showTopPanel" class="cat-panel top-panel">
            <div class="panel-head">Top 榜周期</div>
            <button
              v-for="p in topPeriods"
              :key="p.value"
              class="cat-item"
              :class="{ active: activePeriod === p.value }"
              @click="pickPeriod(p.value)"
            >
              {{ p.label }}
              <span v-if="activePeriod === p.value" class="ic" v-html="ICONS.check"></span>
            </button>
          </div>
        </div>
        <button class="chip" :class="{ active: store.mode.type === 'offline' }" @click="store.switchMode({ type: 'offline' }); showTopPanel = false">
          离线
        </button>
        <button class="chip tool" @click="showCats = !showCats; showTopPanel = false; if (showCats) void store.ensureCategories()">{{ modeName }} ▾</button>
        <button class="chip tool" title="搜索 (Ctrl+K)" aria-label="搜索" @click="openSearch"><span class="ic" v-html="ICONS.search"></span></button>
      </div>
      <div v-else class="search-bar">
        <span class="ic" v-html="ICONS.search"></span>
        <input
          ref="searchInputEl"
          v-model="query"
          placeholder="搜索主题；支持 @用户 #分类 order:latest"
          @input="onQueryInput"
          @keydown.esc="closeSearch"
        />
        <button class="act" @click="closeSearch">取消</button>
      </div>
      <div v-if="showCats && !searchOpen" class="cat-panel">
        <div class="panel-head">选择分类</div>
        <button
          v-for="c in store.categories"
          :key="c.id"
          class="cat-item"
          :class="{ active: store.mode.type === 'category' && store.mode.id === c.id }"
          @click="store.switchMode({ type: 'category', slug: c.slug, id: c.id, name: c.name }); showCats = false"
        >
          <span class="cat-dot" :style="{ background: `#${c.color}` }"></span>
          {{ c.name }}
          <small>{{ c.topic_count }}</small>
          <span v-if="store.mode.type === 'category' && store.mode.id === c.id" class="ic" v-html="ICONS.check"></span>
        </button>
      </div>
    </div>

    <div v-if="store.error && !searchOpen" class="error">{{ store.error }}</div>

    <!-- 搜索态：结果列表替换 feed（行结构复用列表行样式） -->
    <template v-if="searchOpen">
      <div v-if="searchError" class="error">
        加载失败：{{ searchError }}
        <button class="act" @click="runSearch(0)">重试</button>
      </div>
      <article v-for="r in searchRows" :key="r.id" class="topic-row">
        <div class="topic-main">
          <div class="topic-title-line">
            <RouterLink :to="`/t/${r.id}`" class="topic-title" @click="onTitleClick($event, r.id)">{{ r.title }}</RouterLink>
          </div>
          <p v-if="r.blurb" class="row-blurb">{{ r.blurb }}</p>
          <div class="topic-meta">
            <span v-if="r.categoryName" class="row-tag catname">{{ r.categoryName }}</span>
            <span v-if="r.username" class="u">@{{ r.username }}</span>
            <span class="m"><span class="ic" v-html="ICONS.chat"></span>{{ Math.max(0, r.postsCount - 1) }}</span>
            <span v-if="r.likeCount" class="m"><span class="ic" v-html="ICONS.heart"></span>{{ r.likeCount }}</span>
            <span class="time">{{ relTime(r.createdAt) }}</span>
          </div>
        </div>
      </article>
      <div v-if="!searchLoading && !searchError && searchRows.length === 0 && query.trim()" class="sentinel">
        没有找到与「{{ query.trim() }}」相关的内容
      </div>
      <div v-if="searchRows.length > 0 || searchLoading" class="sentinel">
        <span v-if="searchLoading">加载中…</span>
        <button v-else-if="!searchExhausted" class="act" @click="runSearch(searchPage + 1)">加载更多</button>
        <span v-else>没有更多了</span>
      </div>
    </template>

    <!-- 离线模式：渲染本地 index（快照列表，行内进入/删除） -->
    <template v-else-if="store.mode.type === 'offline'">
      <article v-for="t in store.offlineEntries" :key="t.id" class="topic-row">
        <div class="topic-main">
          <RouterLink :to="`/t/${t.id}?offline=1`" class="topic-title" @click="onTitleClick($event, t.id, true)">{{ t.title }}</RouterLink>
          <div class="topic-meta">
            <span>📄 {{ t.posts_count }} 楼</span>
            <span>保存于 {{ relTime(t.savedAt) }}</span>
            <button class="act" @click="removeOffline(t.id)">删除</button>
          </div>
        </div>
      </article>
      <div v-if="store.offlineEntries.length === 0 && !store.loading" class="sentinel">还没有离线存档，打开主题后点「离线保存」</div>
    </template>
    <template v-else>
      <article v-for="t in store.topics" :key="t.id" class="topic-row">
      <img class="avatar" :src="avatarUrl(opOf(t)?.avatar_template ?? '')" alt="" loading="lazy" @click.stop="showUser(t)" />
      <div class="topic-main">
        <div class="topic-title-line">
          <span v-if="t.pinned" class="row-tag pin"><span class="ic" v-html="ICONS.pin"></span>置顶</span>
          <span v-if="t.closed" class="row-tag closed"><span class="ic" v-html="ICONS.lock"></span>已关闭</span>
          <RouterLink :to="`/t/${t.id}`" class="topic-title" @click="onTitleClick($event, t.id)">{{ t.title }}</RouterLink>
          <button
            class="row-q"
            :class="{ acted: queue.has(t.id) }"
            :title="queue.has(t.id) ? '从阅读队列移除' : '加入阅读队列'"
            :aria-label="queue.has(t.id) ? '从阅读队列移除' : '加入阅读队列'"
            @click.stop="toggleQueue(t)"
          >
            <span class="ic" v-html="queue.has(t.id) ? ICONS.check : ICONS.plus"></span>
          </button>
        </div>
        <div class="topic-meta">
          <span v-if="opOf(t)" class="u" title="查看用户卡片" @click.stop="showUser(t)">@{{ opOf(t)?.username }}</span>
          <span class="m"><span class="ic" v-html="ICONS.chat"></span>{{ Math.max(0, t.posts_count - 1) }}</span>
          <span v-if="t.like_count" class="m"><span class="ic" v-html="ICONS.heart"></span>{{ t.like_count }}</span>
          <span class="time">{{ relTime(t.last_posted_at ?? t.created_at) }}</span>
        </div>
      </div>
      </article>
    </template>

    <div ref="sentinel" class="sentinel">
      <span v-if="store.mode.type !== 'offline' && !searchOpen">
        <span v-if="store.loading">加载中…</span>
        <span v-else-if="store.exhausted">没有更多了</span>
      </span>
    </div>
  </div>
</template>
