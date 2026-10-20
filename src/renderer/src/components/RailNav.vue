<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { QUEUE_ENABLED, useQueueStore } from '../stores/queue'
import { DEFAULT_FOLDER_ID, useFavoritesStore } from '../stores/favorites'
import { useTopicListStore } from '../stores/topicList'
import { useSearchStore } from '../stores/search'
import QueuePanel from './QueuePanel.vue'
import { avatarUrl } from '../utils/format'
import { loadPrefs, savePrefs } from '../utils/prefs'
import { cancelUser, hideNow, hoverUser } from '../utils/userCard'

/** 左 rail 全局导航（feishu-im-frame）：头像/登录 → 搜索 → 最新/队列/通知 → 设置/收起 */
const auth = useAuthStore()
const queue = useQueueStore()
const search = useSearchStore()
const router = useRouter()

const who = computed(() => auth.status?.user?.username ?? null)
const avatar = computed(() => avatarUrl(auth.status?.user?.avatar_template ?? '', 64))
const ghostLetter = computed(() => (who.value ? who.value.charAt(0).toUpperCase() : '?'))
// 未读徽标（与 App.vue 通知 watcher 同源字段；auth store 属分区 E 不动，此处轻量重复）
const unread = computed(() => {
  const u = auth.status?.user
  if (!u) return 0
  return (u.unread_notifications ?? 0) + (u.unread_high_priority_notifications ?? 0)
})

function onAvatar(): void {
  // 方案 A（10-18-user-flow-ui）：点击直达主页；hover 悬浮卡
  if (who.value) {
    hideNow()
    void router.push(`/u/${who.value}`)
  } else {
    void router.push('/login')
  }
}

// ---- 收起/展开：状态存 ldd-reading prefs（重启保留），读-改-写不覆盖其他字段 ----
const collapsed = ref(loadPrefs().railCollapsed)
function toggleCollapse(): void {
  collapsed.value = !collapsed.value
  savePrefs({ ...loadPrefs(), railCollapsed: collapsed.value })
}

// ---- 队列浮层：浮于 rail 右侧，点外部关闭（原 App.vue queue-panel 逻辑迁入） ----
const queueOpen = ref(false)
function toggleQueuePanel(): void {
  queueOpen.value = !queueOpen.value
}
// ---- 收藏夹浮层：完整管理中心（建/改/删夹，10-20-fav-rail-management 方案 A）；点夹名切筛选并回首页 ----
const favOpen = ref(false)
const favList = useFavoritesStore()
const topicList = useTopicListStore()
const favActive = computed(() => topicList.mode.type === 'favorites')
const favRenaming = ref<string | null>(null)
const favRenameText = ref('')
const favConfirmDelete = ref<string | null>(null)
const favNewName = ref('')
/** 行内输入自动聚焦 */
const vFocus = { mounted: (el: HTMLInputElement) => el.focus() }
function toggleFavPanel(): void {
  favOpen.value = !favOpen.value
}
function pickFavFolder(id: string): void {
  favOpen.value = false
  void topicList.switchMode({ type: 'favorites', folderId: id })
  if (router.currentRoute.value.name !== 'home') void router.push('/')
}
function favStartRename(id: string): void {
  favConfirmDelete.value = null
  favRenaming.value = id
  favRenameText.value = favList.folder(id)?.name ?? ''
}
function favCommitRename(): void {
  if (favRenaming.value === null) return
  favList.renameFolder(favRenaming.value, favRenameText.value)
  favRenaming.value = null
}
function favCancelRename(): void {
  favRenaming.value = null
}
function favDoRemove(id: string): void {
  favList.removeFolder(id)
  favConfirmDelete.value = null
  // 删的是当前筛选夹：回默认夹，避免列表残留已删除夹的空态
  if (topicList.mode.type === 'favorites' && topicList.mode.folderId === id) {
    void topicList.switchMode({ type: 'favorites', folderId: DEFAULT_FOLDER_ID })
  }
}
function favCreate(): void {
  const name = favNewName.value.trim()
  if (!name) return
  favList.createFolder(name)
  favNewName.value = ''
}
function onDocClick(e: MouseEvent): void {
  const t = e.target instanceof Element ? e.target : null
  if (queueOpen.value && !(t && t.closest('.queue-wrap'))) queueOpen.value = false
  if (favOpen.value && !(t && t.closest('.fav-wrap'))) favOpen.value = false
}

// ---- rail 搜索：Ctrl/Cmd+K 唤起并聚焦（全局唯一入口） ----
const searchInputEl = ref<HTMLInputElement | null>(null)
function onGlobalKey(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (!search.open) void search.openSearch()
    searchInputEl.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('keydown', onGlobalKey)
})

/** 行内 SVG 图标（20px stroke 系，沿用项目 ICONS 模式） */
const ICONS = {
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  home:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  inbox:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  bell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  panelClose:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
  panelOpen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>',
  star:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  pencil:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
  x:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
}
</script>

<template>
  <aside class="rail" :class="{ collapsed }">
    <!-- 拖拽区 1：头像 + 新建占位（R6；「＋」仅占位 R10） -->
    <div class="rail-top">
      <button
        class="rail-avatar"
        :class="{ ghost: !who }"
        :title="who ? `@${who} · 用户卡片` : '未登录，去登录'"
        :aria-label="who ? '打开用户主页' : '去登录'"
        @mouseenter="who && hoverUser(who, $event)"
        @mouseleave="cancelUser"
        @click="onAvatar"
      >
        <img v-if="avatar" :src="avatar" alt="" />
        <template v-else>{{ ghostLetter }}</template>
      </button>
      <button class="rail-plus" title="发新主题（占位）" aria-label="发新主题（占位）">
        <span class="ic" v-html="ICONS.plus"></span>
      </button>
    </div>

    <!-- 拖拽区 1 续：搜索框（承接搜索 MVP，状态在 stores/search） -->
    <div class="rail-search">
      <span class="ic" v-html="ICONS.search"></span>
      <input
        ref="searchInputEl"
        v-model="search.query"
        placeholder="搜索"
        aria-label="搜索"
        @input="search.onQueryInput()"
        @keydown.esc="search.close()"
      />
    </div>

    <RouterLink to="/" class="rail-item" :class="{ active: ['home', 'topic'].includes(String(router.currentRoute.value.name)) }" title="最新">
      <span class="ic" v-html="ICONS.home"></span><span class="lbl">最新</span>
    </RouterLink>

    <!-- 收藏夹浮层：本地夹列表，点夹切列表模式并回首页（与队列同一交互模式） -->
    <div class="fav-wrap">
      <button class="rail-item" :class="{ active: favActive }" title="收藏夹" @click="toggleFavPanel">
        <span class="ic" v-html="ICONS.star"></span><span class="lbl">收藏夹</span>
      </button>
      <div v-if="favOpen" class="queue-panel">
        <h4>收藏夹（本地数据 · 离线可看）</h4>
        <div v-if="favList.folders.length === 0" class="queue-empty">暂无收藏夹</div>
        <div v-for="f in favList.folders" :key="f.id" class="fav-row">
          <template v-if="favRenaming === f.id">
            <input
              v-focus
              v-model="favRenameText"
              class="fav-input"
              maxlength="30"
              @keydown.enter.prevent="favCommitRename"
              @keydown.esc.prevent="favCancelRename"
              @blur="favCommitRename"
            />
          </template>
          <template v-else-if="favConfirmDelete === f.id">
            <span class="fav-del-q">删除「{{ f.name }}」？不影响站点书签</span>
            <button class="fav-mini danger" @click="favDoRemove(f.id)">删除</button>
            <button class="fav-mini" @click="favConfirmDelete = null">取消</button>
          </template>
          <template v-else>
            <button
              class="fav-folder"
              :class="{ acted: favActive && topicList.mode.type === 'favorites' && topicList.mode.folderId === f.id }"
              @click="pickFavFolder(f.id)"
            >
              {{ f.name }}
              <small>{{ f.topicIds.length }}</small>
              <span
                v-if="favActive && topicList.mode.type === 'favorites' && topicList.mode.folderId === f.id"
                class="ic"
                v-html="ICONS.check"
              ></span>
            </button>
            <template v-if="f.id !== DEFAULT_FOLDER_ID">
              <button class="fav-mini" title="重命名" @click="favStartRename(f.id)">
                <span class="ic" v-html="ICONS.pencil"></span>
              </button>
              <button class="fav-mini danger" title="删除收藏夹" @click="favConfirmDelete = f.id">
                <span class="ic" v-html="ICONS.x"></span>
              </button>
            </template>
          </template>
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
            <span class="ic" v-html="ICONS.plus"></span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="QUEUE_ENABLED" class="queue-wrap">
      <button class="rail-item" :class="{ active: queueOpen }" title="队列" @click="toggleQueuePanel">
        <span class="ic" v-html="ICONS.inbox"></span><span class="lbl">队列</span>
        <span v-if="queue.count > 0" class="rail-badge">{{ queue.count > 99 ? '99+' : queue.count }}</span>
      </button>
      <!-- 队列浮层整体迁至 components/QueuePanel.vue（store 自取），此处只留挂载点 -->
      <QueuePanel v-if="queueOpen" @close="queueOpen = false" />
    </div>

    <RouterLink to="/notifications" class="rail-item" :class="{ active: router.currentRoute.value.name === 'notifications' }" title="通知">
      <span class="ic" v-html="ICONS.bell"></span><span class="lbl">通知</span>
      <span v-if="unread > 0" class="rail-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </RouterLink>

    <div class="rail-spacer"></div>

    <RouterLink to="/settings" class="rail-item" :class="{ active: router.currentRoute.value.name === 'settings' }" title="设置">
      <span class="ic" v-html="ICONS.settings"></span><span class="lbl">设置</span>
    </RouterLink>

    <button class="rail-item rail-collapse" :aria-label="collapsed ? '展开导航' : '收起导航'" @click="toggleCollapse">
      <span class="ic" v-html="collapsed ? ICONS.panelOpen : ICONS.panelClose"></span>
      <span class="lbl">{{ collapsed ? '展开导航' : '收起导航' }}</span>
    </button>
  </aside>
</template>
