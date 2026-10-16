<script setup lang="ts">
import { onMounted, onBeforeUnmount, nextTick, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTopicStore } from '../stores/topic'
import { useQueueStore } from '../stores/queue'
import { relTime } from '../utils/format'
import { loadPrefs, savePrefs, type ViewModePref } from '../utils/prefs'
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

// ---- 视图模式（时间流/树形）：偏好存 ldd-reading（重启保留），即时生效 ----
const viewMode = ref<ViewModePref>(loadPrefs().viewMode)
function setViewMode(m: ViewModePref): void {
  viewMode.value = m
  // 读-改-写：不覆盖 ldd-reading 里的其他字段
  savePrefs({ ...loadPrefs(), viewMode: m })
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

onMounted(() => {
  // offline：父级 prop（BrowseView 已从 route 归一）优先，route query 兜底（?offline=1 语义保留）
  const offline = props.offline === true || route.query.offline === '1'
  void store.open(topicId.value, { offline }).then(() => {
    // 通知跳转：?pn= 直达楼层（query 仍来自 route，双栏场景同样成立）
    const pn = Number(route.query.pn ?? 0)
    if (pn > 0) void store.jumpTo(pn)
  })
  scroller.value?.addEventListener('scroll', onScroll, { passive: true })
  void nextTick().then(() => void consumePendingJump())
})

onBeforeUnmount(() => {
  scroller.value?.removeEventListener('scroll', onScroll)
  if (progressTimer !== undefined) window.clearTimeout(progressTimer)
})

function go(postNumber: number): void {
  void store.jumpTo(postNumber)
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
    <div ref="scroller" class="topic-scroller">
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
        <h1 class="topic-title-h1">{{ store.topic.title }}</h1>
        <div class="topic-sub">
          <span>共 {{ store.topic.posts_count }} 楼 · 已读至 #{{ store.readProgress(topicId) || 1 }}</span>
          <!-- 离线快照阅读：徽标标注快照时间（R4），并隐藏全部网络互动 -->
          <span v-if="store.offline" class="offline-badge">离线 · 保存于 {{ relTime(store.offlineSavedAt) }}</span>
          <!-- 视图切换：时间流/树形（:checked+@change，避开 v-model 对 union 类型的 DOM 字符串化坑） -->
          <div class="seg topic-viewmode">
            <label class="seg-opt">
              <input type="radio" name="viewmode" value="stream" :checked="viewMode === 'stream'" @change="setViewMode('stream')" />
              <span>时间流</span>
            </label>
            <label class="seg-opt">
              <input type="radio" name="viewmode" value="tree" :checked="viewMode === 'tree'" @change="setViewMode('tree')" />
              <span>树形</span>
            </label>
          </div>
          <label class="only-op">
            <input type="checkbox" v-model="store.onlyOp" />
            只看楼主
          </label>
          <button v-if="!store.offline" class="act" :disabled="saving" @click="doSaveOffline">
            {{ saveLabel }}
          </button>
          <span v-if="saveResult" :class="saveResult.ok ? 'hint' : 'save-err'">{{ saveResult.text }}</span>
          <button v-if="!store.offline" class="act" :class="{ acted: store.topic.bookmarked }" :disabled="bookmarking || store.topic.bookmarked" @click="doBookmark">
            {{ store.topic.bookmarked ? '★ 已收藏' : '☆ 收藏' }}
          </button>
          <button class="act" :class="{ acted: queue.has(topicId) }" @click="toggleQueue">
            {{ queue.has(topicId) ? '✓ 已入队' : '＋ 入队' }}
          </button>
          <template v-if="queue.count > 0">
            <button class="act" :disabled="!queueNav.prev" @click="goNeighbor('prev')">← 上一贴</button>
            <button class="act" :disabled="!queueNav.next" @click="goNeighbor('next')">下一贴 →</button>
            <span class="hint">队列 {{ queue.count }} 个 · 按入队顺序</span>
          </template>
          <span v-if="store.minLoadedIdx > 0" class="hint">（向上滚动加载更早楼层）</span>
        </div>
        <div v-if="store.error" class="error-inline">{{ store.error }}</div>

        <div v-if="store.loadingOlder" class="loading">加载更早楼层…</div>

        <!-- 时间流：纯楼层序（现状不变）；树形：楼中楼缩进+引导线，PostItem 原样复用 -->
        <template v-if="viewMode === 'stream'">
          <PostItem
            v-for="p in store.visiblePosts"
            :key="p.id"
            :post="p"
            :offline="store.offline"
            @jump="go"
            @like="(id) => store.toggleLike(id)"
            @reply="openComposer"
            @edit="openEdit"
          />
        </template>
        <template v-else>
          <div
            v-for="item in store.treePosts"
            :key="item.post.id"
            class="reply-tree"
            :class="{ 'thread-line': item.depth > 0 }"
            :style="{ marginLeft: item.depth * 16 + 'px' }"
          >
            <PostItem
              :post="item.post"
              :offline="store.offline"
              @jump="go"
              @like="(id) => store.toggleLike(id)"
              @reply="openComposer"
              @edit="openEdit"
            />
          </div>
        </template>

        <div v-if="store.visiblePosts.length === 0" class="loading">没有可见楼层</div>
      </template>
    </div>

    <aside class="timeline">
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
    <button v-else-if="!store.offline" class="composer-open act" @click="openComposer(null)">💬 回复主题</button>
  </div>
</template>
