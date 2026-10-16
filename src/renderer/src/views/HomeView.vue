<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useTopicListStore } from '../stores/topicList'
import { useQueueStore } from '../stores/queue'
import { useBrowseStore } from '../stores/browse'
import { avatarUrl, relTime } from '../utils/format'
import type { DiscourseTopicLite, TopPeriod } from '../../../main/api/client'

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
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
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

/** 删除离线存档后重读 index */
async function removeOffline(id: number): Promise<void> {
  await window.api.offlineRemove(id)
  if (store.mode.type === 'offline') await store.switchMode({ type: 'offline' })
}

onMounted(() => {
  if (store.topics.length === 0) void store.switchMode({ type: 'latest' })
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) void store.loadMore()
    },
    { rootMargin: '400px' }
  )
  if (sentinel.value) io.observe(sentinel.value)
})
</script>

<template>
  <div class="home">
    <div class="list-toolbar">
      <div class="crumb">
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
      </div>
      <div v-if="showCats" class="cat-panel">
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

    <div v-if="store.error" class="error">{{ store.error }}</div>

    <!-- 离线模式：渲染本地 index（快照列表，行内进入/删除） -->
    <template v-if="store.mode.type === 'offline'">
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
      <img class="avatar" :src="avatarUrl(opOf(t)?.avatar_template ?? '')" alt="" loading="lazy" />
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
          <span v-if="opOf(t)" class="u">@{{ opOf(t)?.username }}</span>
          <span class="m"><span class="ic" v-html="ICONS.chat"></span>{{ Math.max(0, t.posts_count - 1) }}</span>
          <span v-if="t.like_count" class="m"><span class="ic" v-html="ICONS.heart"></span>{{ t.like_count }}</span>
          <span class="time">{{ relTime(t.last_posted_at ?? t.created_at) }}</span>
        </div>
      </div>
      </article>
    </template>

    <div ref="sentinel" class="sentinel">
      <span v-if="store.mode.type !== 'offline'">
        <span v-if="store.loading">加载中…</span>
        <span v-else-if="store.exhausted">没有更多了</span>
      </span>
    </div>
  </div>
</template>
