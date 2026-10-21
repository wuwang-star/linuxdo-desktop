<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTopicListStore } from '../stores/topicList'
import { QUEUE_ENABLED, useQueueStore } from '../stores/queue'
import { useBrowseStore } from '../stores/browse'
import { useSearchStore } from '../stores/search'
import { useFavoritesStore, type FavEntry } from '../stores/favorites'
import { avatarUrl, relTime, rowTime } from '../utils/format'
import { cancelUser, hideNow, hoverUser } from '../utils/userCard'
import { openDiag } from '../utils/diagBus'
import type { DiscourseTopicLite, TopPeriod } from '../../../main/api/client'

// pane=true：作为双栏左栏嵌入（点击行走 browse.select，URL 由 BrowseView 统一同步）；缺省为整页模式
const props = defineProps<{ pane?: boolean }>()
const router = useRouter()
const store = useTopicListStore()
const queue = useQueueStore()
const browse = useBrowseStore()
const search = useSearchStore()
const fav = useFavoritesStore()
const sentinel = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const showCats = ref(false)

/** 一键定位：列表滚到当前选中帖（双栏联动时右栏正在看的那个） */
function scrollToSelected(): void {
  document.querySelector('.topic-row.sel')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
/** 一键回顶 */
function scrollToTop(): void {
  listEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

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

// ---------- R3 状态设计（ui-polish-upgrade）：计数 / 错误「结论+动作」卡 / 首载骨架 / 列表空态 ----------
/** 节头计数胶囊：当前模式行数（网络模式=topics；离线/收藏夹=各自本地行） */
const listCount = computed(() => {
  if (store.mode.type === 'offline') return store.offlineEntries.length
  if (store.mode.type === 'favorites') return store.favRows.length
  return store.topics.length
})

/** 英文原文只进 console 诊断日志，不进 UI（R8 零裸状态码） */
watch(
  () => store.error,
  (e) => {
    if (e) console.warn('[topicList] 原始错误（诊断日志，不进 UI）：', e)
  }
)
const errTitle = computed(() => {
  const e = store.error
  if (!e) return ''
  if (/403/.test(e)) return '访问被站点拦截'
  if (/429/.test(e)) return '操作太快被限流'
  if (/ERR_|net::|ECONN|tunnel|timeout|timed out|reset/i.test(e)) return '连接被重置'
  return '无法连接 linux.do'
})
const errDesc = computed(() => {
  const e = store.error
  if (!e) return ''
  if (/403/.test(e)) return '站点安全验证临时收紧，稍等一两分钟通常自动恢复。'
  if (/429/.test(e)) return '稍等半分钟再继续即可。'
  return '网络或代理波动导致请求中断，可重试或查看诊断定位原因。'
})
/** 重试：重跑当前 mode 的 load（既有 store.loadMore，零逻辑新增） */
function retryList(): void {
  void store.loadMore()
}

/** 首载骨架屏：loading 且列表为空持续 ≥300ms 才显示（快响应不闪屏） */
const showSkel = ref(false)
let skelTimer: number | undefined
watch(
  () => store.loading,
  (loading) => {
    if (loading && store.topics.length === 0) {
      if (skelTimer === undefined) skelTimer = window.setTimeout(() => (showSkel.value = true), 300)
    } else {
      if (skelTimer !== undefined) window.clearTimeout(skelTimer)
      skelTimer = undefined
      showSkel.value = false
    }
  }
)
onUnmounted(() => {
  if (skelTimer !== undefined) window.clearTimeout(skelTimer)
})

/** 列表空态：网络模式加载完结束（exhausted）且无数据无错误 */
const listEmpty = computed(
  () =>
    !search.open &&
    ['latest', 'hot', 'top', 'category'].includes(store.mode.type) &&
    store.exhausted &&
    !store.error &&
    store.topics.length === 0
)

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
  filter:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/></svg>',
  eye:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
  locate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  arrowUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
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
  void router.push(`/top/${p}`)
}

const topLabel = computed(
  () => topPeriods.find((p) => p.value === activePeriod.value)?.label ?? '周榜'
)

/** 最多浏览：总=latest order=views（累计）；日~年=top 周期集合客户端按 views 降序（近似，Discourse 无周期浏览增量端点） */
const showViewsPanel = ref(false)
const viewsScope = ref<'all' | TopPeriod>('all')
const byViewsActive = computed(() => {
  const m = store.mode
  return (m.type === 'latest' && m.order === 'views') || (m.type === 'top' && m.viewsSort === true)
})
const byViewsLabel = computed(() => {
  const m = store.mode
  if (m.type === 'top' && m.viewsSort) return `最多浏览 · ${topPeriods.find((p) => p.value === m.period)?.label ?? ''}`
  return '最多浏览'
})
function applyViews(): void {
  if (viewsScope.value === 'all') void router.push('/views')
  else void router.push(`/top/${viewsScope.value}/views`)
}
function toggleByViews(): void {
  if (byViewsActive.value) {
    showViewsPanel.value = false
    void router.push('/')
    return
  }
  showViewsPanel.value = !showViewsPanel.value
  showTopPanel.value = false
  showCats.value = false
}
function pickViews(scope: 'all' | TopPeriod): void {
  viewsScope.value = scope
  showViewsPanel.value = false
  applyViews()
}

/** 当前筛的夹已被删（他处删除后 mode 残留）：列表给空态说明 */
const favFolderMissing = computed(
  () => store.mode.type === 'favorites' && !fav.folder(store.mode.folderId)
)

/** 行内移出本夹（无确认 + 5s 撤销条，web-guidelines destructive 退路）：不影响站点书签 */
const undoSnap = ref<{ folderId: string; entry: FavEntry } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined
function removeFromFolder(topicId: number): void {
  if (store.mode.type !== 'favorites') return
  const folderId = store.mode.folderId
  const entry = fav.snapshots[String(topicId)]
  fav.setTopic(folderId, topicId, null, false)
  undoSnap.value = entry ? { folderId, entry } : { folderId, entry: { id: topicId, title: '', views: 0, like_count: 0, posts_count: 0, created_at: '', avatar_template: '' } }
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => (undoSnap.value = null), 5000)
}
function undoRemove(): void {
  if (!undoSnap.value) return
  const { folderId, entry } = undoSnap.value
  fav.setTopic(folderId, entry.id, entry, true)
  undoSnap.value = null
  clearTimeout(undoTimer)
}

function opOf(topic: DiscourseTopicLite) {
  const first = topic.posters?.[0]?.user_id
  return first !== undefined ? store.usersById.get(first) : undefined
}

/** 首楼作者：hover 悬浮卡，点击直达主页（方案 A，10-18-user-flow-ui） */
function goUser(t: DiscourseTopicLite): void {
  const u = opOf(t)
  if (!u) return
  hideNow()
  void router.push(`/u/${u.username}`)
}

/** 删除离线存档后重读 index */
async function removeOffline(id: number): Promise<void> {
  await window.api.offlineRemove(id)
  if (store.mode.type === 'offline') await store.switchMode({ type: 'offline' })
}

// ---------- 搜索态：输入框/状态在 stores/search（rail 输入），此处只渲染结果（逻辑原样迁移，不重写） ----------

onMounted(() => {
  // Esc 收起工具条浮层（web-guidelines：浮层可 Esc 退出）
  const onEsc = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    showTopPanel.value = false
    showViewsPanel.value = false
    showCats.value = false
  }
  document.addEventListener('keydown', onEsc)
  onBeforeUnmount(() => document.removeEventListener('keydown', onEsc))
  if (store.topics.length === 0) void store.switchMode({ type: 'latest' })
  const io = new IntersectionObserver(
    (entries) => {
      if (search.open) return // 搜索态不触发列表加载
      if (entries.some((e) => e.isIntersecting)) void store.loadMore()
    },
    // 快触底预取：距视口底 900px（约 7 行）就开始拉下一页，避免滚到才等加载
    { rootMargin: '900px 0px' }
  )
  if (sentinel.value) io.observe(sentinel.value)
})
</script>

<template>
  <div ref="listEl" class="home">
    <div class="list-toolbar">
      <!-- 节头（拖拽区 2，R2）：帖子 15px/650 + 计数胶囊 + 定位/回顶/筛选图标组右置 -->
      <div v-if="!search.open" class="ldd-sec-head">
        <b class="up-sec-title">帖子</b>
        <span class="up-cnt">{{ listCount }}</span>
        <span class="up-sec-sp"></span>
        <button
          class="up-ico"
          title="定位当前帖子"
          aria-label="定位当前帖子"
          :disabled="browse.selectedId === null"
          @click="scrollToSelected"
        >
          <span class="ic" v-html="ICONS.locate" aria-hidden="true"></span>
        </button>
        <button
          class="up-ico"
          title="回到顶部"
          aria-label="回到顶部"
          @click="scrollToTop"
        >
          <span class="ic" v-html="ICONS.arrowUp" aria-hidden="true"></span>
        </button>
        <button
          class="up-ico"
          title="筛选分类"
          aria-label="筛选分类"
          @click="showCats = !showCats; showTopPanel = false; if (showCats) void store.ensureCategories()"
        >
          <span class="ic" v-html="ICONS.filter" aria-hidden="true"></span>
        </button>
      </div>
      <!-- 搜索态头：查询词 + 取消（输入框在 rail，此处给退出入口） -->
      <div v-else class="search-head">
        <span class="search-head-q">搜索「{{ search.query.trim() }}」的结果</span>
        <button class="act" @click="search.close()">取消</button>
      </div>
      <!-- 工具条（R2）：segmented 实心分段，选中白底浮起；Top/最多浏览下拉行为不变；分类 ghost 收尾 -->
      <div v-if="!search.open" class="up-seg-row">
        <div class="up-seg">
          <button
            class="up-seg-btn"
            :class="{ active: store.mode.type === 'latest' && store.mode.order !== 'views' }"
            @click="router.push('/')"
          >
            最新
          </button>
          <div class="chip-wrap">
            <button
              class="up-seg-btn"
              :class="{ active: byViewsActive }"
              title="按浏览量排序"
              @click="toggleByViews"
            >
              {{ byViewsLabel }} ▾
            </button>
            <div v-if="showViewsPanel" class="cat-panel top-panel">
              <div class="panel-head">浏览榜周期（日~年为该周期内发帖按累计浏览排）</div>
              <button class="cat-item" :class="{ active: viewsScope === 'all' }" @click="pickViews('all')">
                总榜（累计浏览）
                <span v-if="viewsScope === 'all'" class="ic" v-html="ICONS.check" aria-hidden="true"></span>
              </button>
              <button
                v-for="p in topPeriods"
                :key="p.value"
                class="cat-item"
                :class="{ active: viewsScope === p.value }"
                @click="pickViews(p.value)"
              >
                {{ p.label }}
                <span v-if="viewsScope === p.value" class="ic" v-html="ICONS.check" aria-hidden="true"></span>
              </button>
            </div>
          </div>
          <button
            class="up-seg-btn"
            :class="{ active: store.mode.type === 'hot' }"
            @click="router.push('/hot')"
          >
            最热
          </button>
          <div class="chip-wrap">
            <button
              class="up-seg-btn"
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
                <span v-if="activePeriod === p.value" class="ic" v-html="ICONS.check" aria-hidden="true"></span>
              </button>
            </div>
          </div>
          <button
            class="up-seg-btn"
            :class="{ active: store.mode.type === 'offline' }"
            @click="router.push('/offline')"
          >
            离线
          </button>
        </div>
        <div class="chip-wrap">
          <button
            class="up-seg-ghost"
            title="筛选分类"
            @click="showCats = !showCats; showTopPanel = false; if (showCats) void store.ensureCategories()"
          >
            {{ modeName }} ▾
          </button>
        </div>
      </div>
      <div v-if="showCats && !search.open" class="cat-panel">
        <div class="panel-head">选择分类</div>
        <button
          v-for="c in store.categories"
          :key="c.id"
          class="cat-item"
          :class="{ active: store.mode.type === 'category' && store.mode.id === c.id }"
          @click="router.push(`/category/${c.slug}/${c.id}`); showCats = false"
        >
          <span class="cat-dot" :style="{ background: `#${c.color}` }"></span>
          {{ c.name }}
          <small>{{ c.topic_count }}</small>
          <span v-if="store.mode.type === 'category' && store.mode.id === c.id" class="ic" v-html="ICONS.check" aria-hidden="true"></span>
        </button>
      </div>
    </div>

    <!-- R3 错误「结论+动作」卡：英文原文只进 console，UI 只给人话结论；重试重跑当前 mode load -->
    <div v-if="store.error && !search.open" class="up-err-card">
      <b><span class="ic" v-html="ICONS.alert" aria-hidden="true"></span>{{ errTitle }}</b>
      <p>{{ errDesc }}原始错误已记录到诊断日志。</p>
      <div class="up-err-actions">
        <button class="up-err-retry" @click="retryList">重试</button>
        <button class="up-err-diag" @click="openDiag()">查看诊断</button>
      </div>
    </div>

    <!-- R3 首载骨架屏：3 行 shimmer（≥300ms 才出现，快响应不闪屏） -->
    <div v-if="showSkel && !search.open" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="up-skel-row">
        <span class="skel up-skel-av"></span>
        <div class="up-skel-mid">
          <span class="skel up-skel-line w85"></span>
          <span class="skel up-skel-line w60"></span>
        </div>
      </div>
    </div>

    <!-- 搜索态：结果列表替换 feed（输入在 rail，逻辑在 stores/search） -->
    <template v-if="search.open">
      <div v-if="search.error" class="error">
        加载失败：{{ search.error }}
        <button class="act" @click="search.runSearch(0)">重试</button>
      </div>
      <article v-for="r in search.rows" :key="r.id" class="topic-row" :class="{ sel: browse.selectedId === r.id }">
        <div class="topic-main">
          <div class="topic-title-line">
            <RouterLink :to="`/t/${r.id}`" class="topic-title" @click="onTitleClick($event, r.id)">{{ r.title }}</RouterLink>
            <span class="row-time">{{ relTime(r.createdAt) }}</span>
          </div>
          <p v-if="r.blurb" class="row-blurb">{{ r.blurb }}</p>
          <div class="topic-meta">
            <span v-if="r.categoryName" class="row-tag catname">{{ r.categoryName }}</span>
            <span v-if="r.username" class="u">@{{ r.username }}</span>
            <span class="m"><span class="ic" v-html="ICONS.chat" aria-hidden="true"></span>{{ Math.max(0, r.postsCount - 1) }}</span>
            <span v-if="r.likeCount" class="m"><span class="ic" v-html="ICONS.heart" aria-hidden="true"></span>{{ r.likeCount }}</span>
          </div>
        </div>
      </article>
      <div v-if="!search.loading && !search.error && search.rows.length === 0 && search.query.trim()" class="sentinel">
        没有找到与「{{ search.query.trim() }}」相关的内容
      </div>
      <div v-if="search.rows.length > 0 || search.loading" class="sentinel">
        <span v-if="search.loading">加载中…</span>
        <button v-else-if="!search.exhausted" class="act" @click="search.runSearch(search.page + 1)">加载更多</button>
        <span v-else>没有更多了</span>
      </div>
    </template>

    <!-- 离线模式：渲染本地 index（快照列表，行内进入/删除） -->
    <template v-else-if="store.mode.type === 'offline'">
      <article v-for="t in store.offlineEntries" :key="t.id" class="topic-row">
        <div class="topic-main">
          <RouterLink :to="`/t/${t.id}?offline=1`" class="topic-title" @click="onTitleClick($event, t.id, true)">{{ t.title }}</RouterLink>
          <div class="topic-meta">
            <span class="m"><span class="ic" v-html="ICONS.chat" aria-hidden="true"></span>{{ t.posts_count }} 楼</span>
            <span>保存于 {{ relTime(t.savedAt) }}</span>
            <button class="act" @click="removeOffline(t.id)">删除</button>
          </div>
        </div>
      </article>
      <div v-if="store.offlineEntries.length === 0 && !store.loading" class="sentinel">还没有离线存档，打开主题后点「离线保存」</div>
    </template>
    <!-- 收藏夹模式：本地快照行（无网络请求，离线可看；打开主题仍走常规路由） -->
    <template v-else-if="store.mode.type === 'favorites'">
      <article v-for="t in store.favRows" :key="t.id" class="topic-row" :class="{ sel: browse.selectedId === t.id }">
        <img
          v-if="t.avatar_template"
          class="avatar"
          :src="avatarUrl(t.avatar_template)"
          alt=""
          loading="lazy"
        />
        <div class="topic-main">
          <div class="topic-title-line">
            <RouterLink :to="`/t/${t.id}`" class="topic-title" @click="onTitleClick($event, t.id)">{{ t.title }}</RouterLink>
            <span class="row-time">{{ rowTime(t.created_at) }}</span>
          </div>
          <div class="topic-meta">
            <span class="m"><span class="ic" v-html="ICONS.heart" aria-hidden="true"></span><span v-if="t.like_count" class="tabular">{{ t.like_count }}</span></span>
            <span class="m"><span class="ic" v-html="ICONS.eye" aria-hidden="true"></span><span v-if="t.views" class="tabular">{{ t.views }}</span></span>
            <span class="m"><span class="ic" v-html="ICONS.chat" aria-hidden="true"></span><span class="tabular">{{ Math.max(0, t.posts_count - 1) }}</span></span>
            <button class="act fav-remove" title="移出本夹（不影响站点书签）" @click.stop="removeFromFolder(t.id)">移出本夹</button>
          </div>
        </div>
      </article>
      <div v-if="undoSnap" class="undo-bar">
        <span>已从收藏夹移出</span>
        <button class="act" @click="undoRemove">撤销</button>
      </div>
      <div v-if="store.favRows.length === 0 && !store.loading" class="sentinel">
        {{
          favFolderMissing
            ? '该收藏夹已被删除，换个夹看看'
            : '这个收藏夹还是空的 — 打开主题后点头部「收藏夹 ▾」加入'
        }}
      </div>
    </template>
    <template v-else>
      <article v-for="t in store.topics" :key="t.id" class="topic-row" :class="{ sel: browse.selectedId === t.id }">
        <img
          class="avatar clickable"
          :src="avatarUrl(opOf(t)?.avatar_template ?? '')"
          alt=""
          loading="lazy"
          title="查看主页"
          @mouseenter.stop="opOf(t) && hoverUser(opOf(t)!.username, $event)"
          @mouseleave.stop="cancelUser"
          @click.stop="goUser(t)"
        />
        <div class="topic-main">
          <div class="topic-title-line">
            <RouterLink :to="`/t/${t.id}`" class="topic-title" @click="onTitleClick($event, t.id)">{{ t.title }}</RouterLink>
            <span class="row-time">{{ rowTime(t.last_posted_at ?? t.created_at) }}</span>
          </div>
          <div class="topic-meta">
            <span v-if="t.pinned" class="row-tag pin"><span class="ic" v-html="ICONS.pin" aria-hidden="true"></span>置顶</span>
            <span v-if="t.closed" class="row-tag closed"><span class="ic" v-html="ICONS.lock" aria-hidden="true"></span>已关闭</span>
            <span class="m"><span class="ic" v-html="ICONS.heart" aria-hidden="true"></span><span v-if="t.like_count" class="tabular">{{ t.like_count }}</span></span>
            <span class="m"><span class="ic" v-html="ICONS.eye" aria-hidden="true"></span><span v-if="t.views" class="tabular">{{ t.views }}</span></span>
            <span class="m"><span class="ic" v-html="ICONS.chat" aria-hidden="true"></span><span class="tabular">{{ Math.max(0, t.posts_count - 1) }}</span></span>
            <span
              v-if="opOf(t)"
              class="u"
              title="查看主页"
              @mouseenter.stop="hoverUser(opOf(t)!.username, $event)"
              @mouseleave.stop="cancelUser"
              @click.stop="goUser(t)"
            >@{{ opOf(t)?.username }}</span>
            <button
              v-if="QUEUE_ENABLED"
              class="row-q"
              :class="{ acted: queue.has(t.id) }"
              :title="queue.has(t.id) ? '从阅读队列移除' : '加入阅读队列'"
              :aria-label="queue.has(t.id) ? '从阅读队列移除' : '加入阅读队列'"
              @click.stop="toggleQueue(t)"
            >
              <span class="ic" v-html="queue.has(t.id) ? ICONS.check : ICONS.plus" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </article>
    </template>

    <!-- R3 列表空态：几何插画 + 主按钮（路由化架构：只 push 路由，mode 由 BrowseView watch 派生） -->
    <div v-if="listEmpty" class="up-list-empty">
      <div class="up-art" aria-hidden="true"><span class="c2"></span><span class="c1"></span><span class="c3"></span><span class="dot"></span></div>
      <b>这里还没有帖子</b>
      <p>先去热榜看看大家在聊什么</p>
      <button class="up-go" @click="router.push('/hot')">去热榜逛逛</button>
    </div>

    <div ref="sentinel" class="sentinel">
      <span v-if="store.mode.type !== 'offline' && store.mode.type !== 'favorites' && !search.open">
        <span v-if="store.loading && !showSkel">加载中…</span>
        <span v-else-if="store.exhausted && !listEmpty">没有更多了</span>
      </span>
    </div>
  </div>
</template>
