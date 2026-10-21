<script setup lang="ts">
import { onMounted, onBeforeUnmount, nextTick, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTopicStore, clusterThreads } from '../stores/topic'
import { useQueueStore } from '../stores/queue'
import { useFavoritesStore, type FavEntry } from '../stores/favorites'
import { avatarUrl, relTime, rowTime } from '../utils/format'
import { parseSiteTopicLink } from '../utils/links'
import { cancelUser, hideNow, hoverUser } from '../utils/userCard'
import { startReadTracking } from '../utils/readTiming'
import type { DiscoursePost } from '../../../main/api/client'
import PostItem from '../components/PostItem.vue'

// 双栏右栏场景由 BrowseView 注入 topicId/offline；未注入（整页语义保留）时兜底读路由
const props = defineProps<{ topicId?: number; offline?: boolean }>()
const route = useRoute()
const router = useRouter()
const store = useTopicStore()
const queue = useQueueStore()
const scroller = ref<HTMLElement | null>(null)
const topicId = computed(() => props.topicId ?? Number(route.params.id))

// ---- 回复/编辑编辑器 ----
const composerOpen = ref(false)
const composerText = ref('')
const replyingToFloor = ref<number | null>(null)
/** 非空表示处于编辑模式（正在编辑这层楼） */
const editingPost = ref<DiscoursePost | null>(null)
const composerBusy = ref(false)
const bookmarking = ref(false)

const total = computed(() => store.stream.length || store.topic?.posts_count || 0)
// 收起态位置圆点：按当前楼层占总楼层的百分比落在轨道上
const dotPct = computed(() => {
  const n = total.value
  if (n <= 1) return '0%'
  const cur = Math.min(Math.max(store.currentPostNumber, 1), n)
  return `${((cur - 1) / (n - 1)) * 100}%`
})

// ---- 楼中楼（feishu-im-frame 唯一模式，默认展开三级回复）：聚类纯函数作用于 visiblePosts（只看楼主过滤后集合） ----
const clustered = computed(() => clusterThreads(store.visiblePosts))
/** 已收起串根集合（键 = 串根 post_number；默认全部展开，不持久化） */
const folded = ref(new Set<number>())
function toggleThread(rootNum: number): void {
  if (folded.value.has(rootNum)) folded.value.delete(rootNum)
  else folded.value.add(rootNum)
}
/** 楼主角标：楼号 1 或作者 = OP */
function isOpPost(p: DiscoursePost): boolean {
  return p.post_number === 1 || (store.opUsername !== null && p.username === store.opUsername)
}
/** 头部 meta 行创建时间 chip（24h 内相对，更早 M月D日） */
const createdLabel = computed(() => rowTime(store.topic?.created_at))
/** 楼主头像（一楼作者），头部展示用 */
const opAvatar = computed(() => {
  const first = store.orderedPosts.find((p) => p.post_number === 1) ?? store.orderedPosts[0]
  return store.opUsername && first?.avatar_template ? avatarUrl(first.avatar_template, 96) : ''
})

/** 行内 SVG 图标（沿用项目 ICONS 模式） */
const ICONS = {
  heart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  eye:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
  chat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  user:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  chevR:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  chevD:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  pencil:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
  x:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
}

const timelineTicks = computed(() => {
  const n = total.value
  if (!n) return [] as number[]
  const step = Math.max(1, Math.ceil(n / 60))
  const ticks: number[] = []
  for (let i = 1; i <= n; i += step) ticks.push(i)
  if (ticks[ticks.length - 1] !== n) ticks.push(n)
  return ticks
})

let progressTimer: number | undefined

async function consumePendingJump() {
  const target = store.pendingJump
  if (!target || !scroller.value) return
  store.pendingJump = 0
  // 目标楼层在回复串内且串被收起 → 先展开该串再滚动
  const root = clustered.value.rootOf.get(target)
  if (root !== undefined) folded.value.delete(root)
  await nextTick()
  const el = document.getElementById(`post-${target}`)
  if (el) {
    el.scrollIntoView({ block: 'start' })
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 1200)
  }
}

function onScroll(): void {
  const el = scroller.value
  if (!el || !store.topic) return
  // 向上翻到顶：加载更早楼层（保持滚动锚点）
  if (el.scrollTop < 400 && store.minLoadedIdx > 0 && !store.loadingOlder) {
    const prevHeight = el.scrollHeight
    void store.loadOlder().then(() => {
      void nextTick().then(() => {
        if (scroller.value) scroller.value.scrollTop += scroller.value.scrollHeight - prevHeight
      })
    })
  }
  // 已读进度：记录视口顶部第一层楼
  if (progressTimer !== undefined) window.clearTimeout(progressTimer)
  progressTimer = window.setTimeout(() => {
    if (!scroller.value || !store.topic) return
    const top = scroller.value.getBoundingClientRect().top
    let current = 0
    for (const p of store.orderedPosts) {
      const node = document.getElementById(`post-${p.post_number}`)
      if (!node) continue
      if (node.getBoundingClientRect().bottom > top + 80) {
        current = p.post_number
        break
      }
    }
    if (current > 0) store.saveProgress(topicId.value, current)
  }, 200)
}

watch(
  () => store.pendingJump,
  () => void consumePendingJump()
)

function openComposer(replyToFloor: number | null): void {
  // 从编辑模式切回回复时清掉残留的旧楼原文，避免误发
  if (editingPost.value) composerText.value = ''
  editingPost.value = null
  replyingToFloor.value = replyToFloor
  composerOpen.value = true
}

/** 编辑楼层：取原文 raw 预填编辑器 */
async function openEdit(post: DiscoursePost): Promise<void> {
  if (composerBusy.value) return
  composerBusy.value = true
  store.error = ''
  try {
    const full = await window.api.getPostRaw(post.id)
    editingPost.value = post
    composerText.value = full.raw ?? ''
    replyingToFloor.value = null
    composerOpen.value = true
  } catch (e) {
    store.error = e instanceof Error ? e.message : String(e)
  } finally {
    composerBusy.value = false
  }
}

function closeComposer(): void {
  composerOpen.value = false
  composerText.value = ''
  replyingToFloor.value = null
  editingPost.value = null
}

async function sendComposer(): Promise<void> {
  const text = composerText.value.trim()
  if (!text || composerBusy.value) return
  composerBusy.value = true
  store.error = ''
  try {
    if (editingPost.value) {
      // 编辑：成功后就地更新；失败保留原楼并提示
      if (await store.editPost(editingPost.value.id, text)) closeComposer()
    } else if (await store.sendReply(text, replyingToFloor.value ?? undefined)) {
      closeComposer()
    }
  } finally {
    composerBusy.value = false
  }
}

async function doBookmark(): Promise<void> {
  if (bookmarking.value) return
  bookmarking.value = true
  await store.bookmark()
  bookmarking.value = false
}

// ---- 多收藏夹（应用层本地夹，独立于上面站点 Discourse 书签，两套并行）：▾ 菜单勾选入夹 ----
// 夹管理（新建/重命名/删除）已闭环到 rail 收藏夹面板（10-20-fav-rail-management，用户拍板）
const fav = useFavoritesStore()
const favMenuOpen = ref(false)
const favNewName = ref('')

/** 入夹快照：标题/时间/计数取当前主题，OP 头像取一楼（R3，离线列表靠它渲染） */
function currentFavSnap(): FavEntry {
  const t = store.topic!
  const first = store.orderedPosts.find((p) => p.post_number === 1) ?? store.orderedPosts[0]
  return {
    id: t.id,
    title: t.title,
    views: t.views ?? 0,
    like_count: t.like_count ?? 0,
    posts_count: t.posts_count ?? 0,
    created_at: t.created_at ?? '',
    avatar_template: first?.avatar_template ?? ''
  }
}

function favToggle(folderId: string): void {
  const t = store.topic
  if (!t) return
  const on = !fav.folderIdsOf(t.id).includes(folderId)
  fav.setTopic(folderId, t.id, on ? currentFavSnap() : null, on)
}

function favCreate(): void {
  const name = favNewName.value.trim()
  if (!name) return
  fav.createFolder(name)
  favNewName.value = ''
}

function closeFavMenu(): void {
  favMenuOpen.value = false
  favNewName.value = ''
}

function onFavDocClick(e: MouseEvent): void {
  if (!favMenuOpen.value) return
  const el = e.target as Element | null
  if (el?.closest('.fav-wrap')) return
  closeFavMenu()
}

onMounted(() => {
  // offline：父级 prop（BrowseView 已从 route 归一）优先，route query 兜底（?offline=1 语义保留）
  const offline = props.offline === true || route.query.offline === '1'
  void store.open(topicId.value, { offline }).then(() => {
    // 通知跳转：?pn= 直达楼层（query 仍来自 route，双栏场景同样成立）
    const pn = Number(route.query.pn ?? 0)
    if (pn > 0) void store.jumpTo(pn)
  })
  scroller.value?.addEventListener('scroll', onScroll, { passive: true })
  scroller.value?.addEventListener('click', onCookedClick, true)
  scroller.value?.addEventListener('mouseover', onCookedHover, true)
  scroller.value?.addEventListener('mouseout', onCookedHoverOut, true)
  window.addEventListener('keydown', onLightboxKey)
  document.addEventListener('click', onFavDocClick, true)
  void nextTick().then(() => void consumePendingJump())
})

// ---- 阅读回传（10-19-ux-batch R2）：posts_read/time_read 数据源，离线模式不回传 ----
let stopRead: (() => void) | null = null
watch(topicId, () => {
  stopRead?.()
  stopRead = null
  void nextTick(() => {
    if (scroller.value && !props.offline && route.query.offline !== '1') {
      stopRead = startReadTracking(topicId.value, scroller.value, () => !store.offline)
    }
  })
})

onBeforeUnmount(() => {
  stopRead?.()
  scroller.value?.removeEventListener('scroll', onScroll)
  scroller.value?.removeEventListener('click', onCookedClick, true)
  scroller.value?.removeEventListener('mouseover', onCookedHover, true)
  scroller.value?.removeEventListener('mouseout', onCookedHoverOut, true)
  window.removeEventListener('keydown', onLightboxKey)
  document.removeEventListener('click', onFavDocClick, true)
  if (progressTimer !== undefined) window.clearTimeout(progressTimer)
})

// ---- 图片灯箱（批 2 R3）：.cooked img 事件委托，树形/离线同覆盖；Esc/遮罩/按钮回退 ----
// 10-21-lightbox-zoom-pan：无级缩放（滚轮锚定光标）+ 拖拽平移 + 双击复位，替代二档切换
const lightbox = ref<string | null>(null)
const lbScale = ref(1)
const lbX = ref(0)
const lbY = ref(0)
let lbDrag: { px: number; py: number; bx: number; by: number } | null = null
const LB_SCALE_MIN = 0.2
const LB_SCALE_MAX = 12

function lbReset(): void {
  lbScale.value = 1
  lbX.value = 0
  lbY.value = 0
  lbDrag = null
}

function lbWheel(e: WheelEvent): void {
  const next = Math.min(LB_SCALE_MAX, Math.max(LB_SCALE_MIN, lbScale.value * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
  if (next === lbScale.value) return
  // 锚定光标：光标所指内容点在缩放前后保持屏幕坐标
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const cx = e.clientX - r.left - r.width / 2
  const cy = e.clientY - r.top - r.height / 2
  const k = next / lbScale.value
  lbX.value = cx - k * (cx - lbX.value)
  lbY.value = cy - k * (cy - lbY.value)
  lbScale.value = next
}

function lbDown(e: PointerEvent): void {
  lbDrag = { px: e.clientX, py: e.clientY, bx: lbX.value, by: lbY.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function lbMove(e: PointerEvent): void {
  if (!lbDrag) return
  lbX.value = lbDrag.bx + (e.clientX - lbDrag.px)
  lbY.value = lbDrag.by + (e.clientY - lbDrag.py)
}

function lbUp(): void {
  lbDrag = null
}

/** 双击：适屏 ↔ 1.6x（画布中心） */
function lbDblClick(): void {
  if (lbScale.value > 1.01) lbReset()
  else {
    lbScale.value = 1.6
    lbX.value = 0
    lbY.value = 0
  }
}

function onScrollerClick(e: MouseEvent): void {
  const t = e.target
  if (t instanceof HTMLImageElement && t.closest('.cooked') && t.src) {
    lightbox.value = t.getAttribute('src')
    lbReset()
  }
}

function closeLightbox(): void {
  lightbox.value = null
}

function onLightboxKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeLightbox()
    if (favMenuOpen.value) closeFavMenu()
  }
}

function go(postNumber: number): void {
  void store.jumpTo(postNumber).then(() => store.flashPost(postNumber))
}

// ---- 身份触点委托（10-18-user-flow-ui）：cooked 内引用楼头像/@mention hover 出悬浮卡 ----
/** 从元素向上找用户名：引用楼 title 容器取其内 /u/ 链接，mention 取自身 href */
function usernameOf(el: Element): string | null {
  const scope = el.closest('aside.quote .title') ?? el.closest('a.mention') ?? el.closest('a[href*="/u/"]')
  if (!scope) return null
  const a = (scope instanceof HTMLAnchorElement ? scope : scope.querySelector('a[href*="/u/"]')) ?? scope
  const href = a.getAttribute('href') ?? ''
  const m = /\/u\/([^/?#]+)/.exec(href)
  return m ? decodeURIComponent(m[1]) : null
}

function onCookedHover(e: MouseEvent): void {
  const t = e.target
  if (!(t instanceof Element) || !t.closest('.cooked')) return
  const u = usernameOf(t)
  if (u) hoverUser(u, e)
}

function onCookedHoverOut(e: MouseEvent): void {
  const t = e.target
  if (!(t instanceof Element) || !t.closest('.cooked')) return
  if (!usernameOf(t)) return
  // 移向同触点内部（子元素间 crossing）不取消
  const related = e.relatedTarget
  if (related instanceof Element && usernameOf(related)) return
  cancelUser()
}

// ---- 正文内链跳转：cooked 内所有 <a> 一律拦截（capture，含 quote 引用块）----
// 站内 /t/ 应用内打开（同主题跳楼层 / 异主题路由复用 ?pn 语义）；其余交系统浏览器（主进程 window-open handler 接走）
function onCookedClick(e: MouseEvent): void {
  const el = e.target as Element | null
  // 点图优先进灯箱：Discourse 图片外层包 <a href=原图>，不放行到下方链接拦截（会跳系统浏览器）
  if (el instanceof HTMLImageElement && el.closest('.cooked') && el.getAttribute('src')) {
    e.preventDefault()
    lightbox.value = el.getAttribute('src')
    lbReset()
    return
  }
  const a = el?.closest?.('a[href]')
  if (!a || !a.closest('.cooked')) return
  e.preventDefault()
  const href = a.getAttribute('href') ?? ''
  // /u/ 用户页内链（mention/引用楼作者）：应用内路由直达（仅相对路径或 linux.do 域名，10-18-user-flow-ui）
  const um = /^(?:https?:\/\/linux\.do)?\/u\/([^/?#]+)/.exec(href)
  if (um) {
    hideNow()
    void router.push(`/u/${decodeURIComponent(um[1])}`)
    return
  }
  const link = parseSiteTopicLink(href)
  if (!link) {
    window.open(href, '_blank')
    return
  }
  if (link.topicId === topicId.value) {
    if (link.postNumber > 1) void store.jumpTo(link.postNumber)
    else scroller.value?.scrollTo({ top: 0 })
  } else {
    void router.push({
      path: `/t/${link.topicId}`,
      query: link.postNumber > 1 ? { pn: String(link.postNumber) } : {}
    })
  }
}

// ---- 阅读队列：入队切换 + 按入队顺序的上/下一贴 ----
const queueNav = computed(() => queue.neighbors(topicId.value))

function toggleQueue(): void {
  const t = store.topic
  if (!t) return
  if (queue.has(t.id)) queue.remove(t.id)
  else queue.add(t.id, t.title)
}

function goNeighbor(dir: 'prev' | 'next'): void {
  const id = queueNav.value[dir]
  if (id !== null) void router.push(`/t/${id}`)
}

// ---- 离线保存/阅读 ----
const saving = ref(false)
const saveProgress = ref<{ loaded: number; total: number } | null>(null)
const saveResult = ref<{ ok: boolean; text: string } | null>(null)

const saveLabel = computed(() => {
  if (!saving.value) return '离线保存'
  return saveProgress.value ? `保存中 ${saveProgress.value.loaded}/${saveProgress.value.total}` : '保存中…'
})

async function doSaveOffline(): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveProgress.value = null
  saveResult.value = null
  // 进度经 webContents 事件回传（offline:save:progress），主进程分块循环中逐批上报
  const unsub = window.api.onSaveProgress((p) => {
    if (p.id === topicId.value) saveProgress.value = { loaded: p.loaded, total: p.total }
  })
  try {
    const res = await window.api.saveOffline(topicId.value)
    saveResult.value = res.ok
      ? { ok: true, text: `已保存 ${res.count ?? 0} 楼` }
      : { ok: false, text: res.error ?? '保存失败' }
  } finally {
    unsub()
    saving.value = false
  }
}

/** 从失败回落提示条进入离线阅读（不改路由，直接以快照重开） */
function readOffline(): void {
  void store.open(topicId.value, { offline: true })
}
</script>

<template>
  <div class="topic-page">
    <div class="topic-main">
    <!-- 内容区头部（拖拽区 3）：标题 + meta 行 + 页签行/动作 -->
    <div v-if="store.topic" class="ldd-t-head">
      <div class="ldd-t-title-row">
        <img
          v-if="opAvatar"
          class="ldd-t-ava clickable"
          :src="opAvatar"
          alt=""
          :title="store.opUsername ? `@${store.opUsername}` : ''"
          @mouseenter.stop="store.opUsername && hoverUser(store.opUsername, $event)"
          @mouseleave.stop="cancelUser"
        />
        <span v-if="store.offline" class="offline-badge">离线</span>
        <div class="ldd-t-title" :title="store.topic.title">{{ store.topic.title }}</div>
        <span v-if="saveResult" class="th-toast" :class="saveResult.ok ? 'hint' : 'save-err'">{{ saveResult.text }}</span>
      </div>
      <div class="ldd-t-meta">
        <span v-if="store.opUsername" class="ldd-chip">@{{ store.opUsername }}</span>
        <span class="ldd-chip">{{ total }} 楼</span>
        <span v-if="store.topic.views" class="ldd-chip tabular-nums"><span class="ic" v-html="ICONS.eye" aria-hidden="true"></span> {{ store.topic.views }}</span>
        <span v-if="store.topic.like_count" class="ldd-chip tabular-nums"><span class="ic" v-html="ICONS.heart" aria-hidden="true"></span> {{ store.topic.like_count }}</span>
        <span v-if="createdLabel" class="ldd-chip">创建于 {{ createdLabel }}</span>
      </div>
      <div class="ldd-t-bar">
        <button class="ldd-ctab" :class="{ active: !store.onlyOp }" @click="store.onlyOp = false">
          <span class="ic" v-html="ICONS.chat" aria-hidden="true"></span>正文
        </button>
        <button class="ldd-ctab" :class="{ active: store.onlyOp }" @click="store.onlyOp = true">
          <span class="ic" v-html="ICONS.user" aria-hidden="true"></span>只看楼主
        </button>
        <div class="ldd-t-actions">
          <button class="ldd-btn" @click="openComposer(null)">
            <span class="ic" v-html="ICONS.chat" aria-hidden="true"></span>回复
          </button>
          <button
            class="ldd-ghost"
            :class="{ on: queue.has(topicId) }"
            :title="queue.has(topicId) ? '从阅读队列移除' : '加入阅读队列'"
            @click="toggleQueue"
          >
            <span class="ic" v-html="queue.has(topicId) ? ICONS.check : ICONS.plus" aria-hidden="true"></span>{{ queue.has(topicId) ? '已入队' : '入队' }}
          </button>
          <button
            v-if="!store.offline"
            class="ldd-ghost"
            :disabled="saving"
            :title="saveLabel"
            @click="doSaveOffline"
          >
            <span class="ic" v-html="ICONS.download" aria-hidden="true"></span>{{ saving ? saveLabel : '离线' }}
          </button>
          <button
            v-if="!store.offline"
            class="ldd-ghost"
            :class="{ on: store.topic.bookmarked }"
            :disabled="bookmarking || store.topic.bookmarked"
            :title="store.topic.bookmarked ? '已收藏' : '收藏'"
            @click="doBookmark"
          >{{ store.topic.bookmarked ? '已收藏' : '收藏' }}</button>
          <!-- 本地收藏夹 ▾（应用层数据，离线同样可用；站点书签上方保持现状，两套并行） -->
          <div class="fav-wrap">
            <button
              class="ldd-ghost fav-toggle"
              :class="{ on: fav.folderIdsOf(topicId).length > 0 }"
              :title="fav.folderIdsOf(topicId).length > 0 ? '管理本地收藏夹' : '加入本地收藏夹'"
              @click.stop="favMenuOpen ? closeFavMenu() : (favMenuOpen = true)"
            >
              <span class="ic" v-html="ICONS.folder" aria-hidden="true"></span>收藏夹
              <span class="ic fav-chev" :class="{ open: favMenuOpen }" v-html="ICONS.chevD" aria-hidden="true"></span>
            </button>
            <div v-if="favMenuOpen" class="fav-menu" @click.stop>
              <div class="fav-menu-head">勾选加入 / 移出收藏夹（重命名与删夹在左侧栏收藏夹面板）</div>
              <div v-for="f in fav.folders" :key="f.id" class="fav-row">
                <button class="fav-item" @click="favToggle(f.id)">
                  <span
                    class="ic"
                    :class="{ checked: fav.folderIdsOf(topicId).includes(f.id) }"
                    v-html="fav.folderIdsOf(topicId).includes(f.id) ? ICONS.check : ICONS.plus"
                   aria-hidden="true"></span>
                  <span class="fav-name">{{ f.name }}</span>
                  <small>{{ f.topicIds.length }}</small>
                </button>
              </div>
              <div class="fav-new">
                <input
                  v-model="favNewName"
                  class="fav-input"
                  placeholder="新建收藏夹…"
                  maxlength="30"
                  @keydown.enter.prevent="favCreate"
                />
                <button class="fav-mini" :disabled="!favNewName.trim()" title="新建收藏夹" @click="favCreate">
                  <span class="ic" v-html="ICONS.plus" aria-hidden="true"></span>
                </button>
              </div>
            </div>
          </div>
          <template v-if="queue.count > 0">
            <button class="ldd-ghost" :disabled="!queueNav.prev" title="上一贴" @click="goNeighbor('prev')">‹</button>
            <button class="ldd-ghost" :disabled="!queueNav.next" title="下一贴" @click="goNeighbor('next')">›</button>
          </template>
        </div>
      </div>
    </div>
    <div ref="scroller" class="topic-scroller" @click="onScrollerClick">
      <div v-if="store.loading" class="loading">加载中…</div>
      <div v-else-if="store.error && !store.topic" class="error">
        {{ store.error }}
        <!-- 重试入口（含「请求超时」）；离线回落提示保留在其旁 -->
        <div class="err-ops">
          <button class="act" @click="store.retry()">重试</button>
        </div>
        <!-- 在线打开失败且本地有离线存档：透出离线阅读入口（AC3） -->
        <div v-if="store.hasOffline" class="offline-tip">
          <span>网络异常，该主题有离线存档</span>
          <button class="act" @click="readOffline">阅读离线存档</button>
        </div>
      </div>
      <template v-else-if="store.topic">
        <div v-if="store.error" class="error-inline">{{ store.error }}</div>

        <div v-if="store.loadingOlder" class="loading">加载更早楼层…</div>

        <!-- 楼中楼（唯一模式，默认展开）：主干楼层 + 「收起 N 条回复」钮 + 原位缩进子楼
             （2 级=根的直接回复，3 级=回复的回复；更深 reply 链平铺续接第 3 级，引用关系由「回复 #N」chip 表达；
             loadOlder 增量后 computed 幂等重算） -->
        <template v-for="item in clustered.items" :key="item.post.id">
          <PostItem
            :post="item.post"
            :is-op="isOpPost(item.post)"
            :offline="store.offline"
            :flash="store.flashPn === item.post.post_number"
            @jump="go"
            @like="(id) => store.toggleLike(id)"
            @reply="openComposer"
            @edit="openEdit"
          />
          <template v-if="item.thread.length > 0">
            <button
              class="ldd-fold"
              :aria-expanded="!folded.has(item.post.post_number)"
              @click="toggleThread(item.post.post_number)"
            >
              <span class="ic fold-chev" :class="{ open: !folded.has(item.post.post_number) }" v-html="ICONS.chevR" aria-hidden="true"></span>
              {{ folded.has(item.post.post_number) ? `${item.thread.length} 条回复` : `收起 ${item.thread.length} 条回复` }}
            </button>
            <div v-show="!folded.has(item.post.post_number)" class="ldd-thread">
              <PostItem
                v-for="m in item.thread"
                :key="m.post.id"
                :post="m.post"
                :is-op="isOpPost(m.post)"
                compact
                :class="m.depth > 1 ? 'post--depth3' : 'post--depth2'"
                :offline="store.offline"
                :flash="store.flashPn === m.post.post_number"
                @jump="go"
                @like="(id) => store.toggleLike(id)"
                @reply="openComposer"
                @edit="openEdit"
              />
            </div>
          </template>
        </template>

        <div v-if="clustered.items.length === 0" class="loading">没有可见楼层</div>
      </template>
    </div>
    </div>

    <aside class="timeline">
      <!-- 收起态：细轨道 + 当前位置圆点；悬停 0.35s 后展开数字刻度（防扫过误触） -->
      <div class="tl-track"><span class="tl-dot" :style="{ top: dotPct }" /></div>
      <div class="tl-list">
        <div class="tl-head">{{ total }} 楼</div>
        <button
          v-for="n in timelineTicks"
          :key="n"
          class="tl-tick"
          :class="{ current: Math.abs(n - store.currentPostNumber) < 5 }"
          @click="go(n)"
        >
          {{ n }}
        </button>
      </div>
    </aside>

    <!-- 回复/编辑编辑器 -->
    <div v-if="composerOpen" class="composer">
      <div class="composer-head">
        <span v-if="editingPost">编辑 #{{ editingPost.post_number }}</span>
        <span v-else-if="replyingToFloor">回复 #{{ replyingToFloor }}</span>
        <span v-else>回复主题</span>
        <button class="act" @click="closeComposer">收起</button>
      </div>
      <textarea
        v-model="composerText"
        placeholder="支持 Markdown…（Ctrl+Enter 发送）"
        @keydown.ctrl.enter.prevent="sendComposer"
        @keydown.meta.enter.prevent="sendComposer"
      ></textarea>
      <div class="composer-foot">
        <span v-if="store.error" class="error-inline">{{ store.error }}</span>
        <span v-else class="hint">{{ editingPost ? '保存走原站 API，失败时原楼不变' : '发帖走原站 API，以当前登录账号提交' }}</span>
        <button class="primary" :disabled="composerBusy || !composerText.trim()" @click="sendComposer">
          {{ composerBusy ? (editingPost ? '保存中…' : '发送中…') : editingPost ? '保存' : '发送' }}
        </button>
      </div>
    </div>
    <!-- 离线快照模式下不渲染回复入口（无网络写操作） -->
    <button v-else-if="!store.offline" class="composer-open act" @click="openComposer(null)">回复主题</button>

    <!-- 图片灯箱：滚轮无级缩放（锚定光标）+ 拖拽平移 + 双击复位；Esc/遮罩/关闭钮回退 -->
    <div v-if="lightbox" class="lightbox-ov" @click="closeLightbox">
      <img
        :src="lightbox"
        class="lb-img"
        :class="{ grab: lbScale > 1, grabbing: lbDrag }"
        :style="{ transform: `translate(${lbX}px, ${lbY}px) scale(${lbScale})` }"
        alt=""
        @wheel.prevent="lbWheel"
        @pointerdown.prevent="lbDown"
        @pointermove="lbMove"
        @pointerup="lbUp"
        @pointercancel="lbUp"
        @dblclick="lbDblClick"
        @click.stop
      />
      <button class="lb-close" aria-label="关闭灯箱" @click="closeLightbox">×</button>
      <span class="lb-tip">滚轮缩放 · 拖拽移动 · 双击复位 · Esc 关闭</span>
    </div>
  </div>
</template>
