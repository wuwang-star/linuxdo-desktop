<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeView from './HomeView.vue'
import TopicView from './TopicView.vue'
import { useBrowseStore } from '../stores/browse'
import { useTopicListStore, type ListMode } from '../stores/topicList'
import { DEFAULT_FOLDER_ID, useFavoritesStore } from '../stores/favorites'
import type { TopPeriod } from '../../../main/api/client'
import { loadPrefs, savePrefs } from '../utils/prefs'

const store = useTopicListStore()
const favs = useFavoritesStore()

const route = useRoute()
const router = useRouter()
const browse = useBrowseStore()

// ---- 双栏判定：≥1200px（matchMedia listener 实时同步，跨阈值即时切换；拉宽恢复双栏且右栏保持当前主题 AC3） ----
// ---- 中栏宽度拖拽（R: 列表宽可调）：prefs 持久化，240–520 夹取，拖拽实时跟手 ----
const listW = ref(loadPrefs().listWidth ?? 312)
let resizing = false
function onResizeStart(e: MouseEvent): void {
  e.preventDefault()
  resizing = true
  const startX = e.clientX
  const startW = listW.value
  const move = (ev: MouseEvent): void => {
    if (!resizing) return
    listW.value = Math.min(520, Math.max(240, startW + ev.clientX - startX))
  }
  const up = (): void => {
    resizing = false
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    document.body.style.cursor = ''
    savePrefs({ ...loadPrefs(), listWidth: listW.value })
  }
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

const mql = window.matchMedia('(min-width: 1200px)')
const dual = ref(mql.matches)
function onMqlChange(e: MediaQueryListEvent): void {
  dual.value = e.matches
}
mql.addEventListener('change', onMqlChange)
onBeforeUnmount(() => mql.removeEventListener('change', onMqlChange))

// ---- route → store 归一：外部跳转（通知 ?pn / 队列上下贴 / 离线 ?offline=1 / 冷启动深链）统一进 store ----
watch(
  () => ({ name: route.name, id: route.params.id, offline: route.query.offline }),
  (r) => {
    if (r.name === 'topic' && r.id !== undefined) {
      browse.syncFromRoute(Number(r.id), r.offline === '1')
    }
  },
  { immediate: true }
)

// ---- store → route 归一：列表点击（select）统一由这里写 URL；双栏 replace（可分享可回跳不留栈），窄屏 push ----
watch(
  () => browse.selectSeq,
  () => {
    if (browse.selectedId === null) return
    const target = {
      path: `/t/${browse.selectedId}`,
      query: browse.offlineFlag ? { offline: '1' } : undefined
    }
    if (dual.value) void router.replace(target).catch(() => {})
    else void router.push(target).catch(() => {})
  }
)

// ---- 列表模式路由化（10-21-route-driven-list）：route→store 单向驱动，URL 即状态 ----
// UI（工具条 chip / rail 收藏夹）只 push 路由；store.mode 由本 watch 派生，禁止反向写路由
const LIST_ROUTE_NAMES = new Set(['home', 'views', 'top', 'hot', 'category', 'offline', 'favorites'])
function modeFromRoute(): ListMode | null {
  switch (route.name) {
    case 'home':
      return { type: 'latest' }
    case 'views':
      return { type: 'latest', order: 'views' }
    case 'hot':
      return { type: 'hot' }
    case 'top': {
      const period = String(route.params.period) as TopPeriod
      return route.params.sort === 'views'
        ? { type: 'top', period, viewsSort: true }
        : { type: 'top', period }
    }
    case 'category': {
      const id = Number(route.params.id)
      const cat = store.categories.find((x) => x.id === id)
      return { type: 'category', slug: String(route.params.slug), id, name: cat?.name ?? String(route.params.slug) }
    }
    case 'offline':
      return { type: 'offline' }
    case 'favorites': {
      const fid = String(route.params.folderId ?? DEFAULT_FOLDER_ID)
      return { type: 'favorites', folderId: favs.folder(fid) ? fid : DEFAULT_FOLDER_ID }
    }
    default:
      return null
  }
}
function sameMode(a: ListMode, b: ListMode): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
watch(
  () => route.fullPath,
  () => {
    if (!LIST_ROUTE_NAMES.has(String(route.name))) return
    const m = modeFromRoute()
    if (!m || sameMode(store.mode, m)) return
    if (m.type === 'category') void store.ensureCategories()
    void store.switchMode(m)
  },
  { immediate: true }
)

// 单双栏可见性：双栏两栏常驻；窄屏按 route 模拟 router-view（列表模式路由 → 列表、/t/:id → 阅读）
const showList = computed(() => dual.value || LIST_ROUTE_NAMES.has(String(route.name)))
const showReader = computed(() => dual.value || route.name === 'topic')
</script>

<template>
  <div class="browse" :data-dual="dual">
    <aside v-show="showList" class="list-pane" :style="dual ? { width: listW + 'px' } : undefined">
      <HomeView :pane="true" />
      <!-- 宽度拖拽手柄（双栏才可拖；窄屏单栏无意义） -->
      <span
        v-if="dual"
        class="list-resizer"
        :class="{ resizing }"
        title="拖拽调整列表宽度"
        @mousedown="onResizeStart"
      ></span>
    </aside>
    <section v-show="showReader" class="reader-pane">
      <!-- :key 换主题/离线态切换时强制重建（store.open 幂等，重建最省心） -->
      <TopicView
        v-if="browse.selectedId !== null"
        :topic-id="browse.selectedId"
        :offline="browse.offlineFlag"
        :key="`${browse.selectedId}-${browse.offlineFlag}`"
      />
      <!-- R3（ui-polish-upgrade）：未选主题空态=几何插画（base .up-art）+ 原文案保留 -->
      <div v-else class="ldd-empty">
        <div class="up-art" aria-hidden="true"><span class="c2"></span><span class="c1"></span><span class="c3"></span><span class="dot"></span></div>
        <b>你的每一个好想法，都让人惊喜</b>
        <span>从左侧列表选择主题开始阅读</span>
      </div>
    </section>
  </div>
</template>
