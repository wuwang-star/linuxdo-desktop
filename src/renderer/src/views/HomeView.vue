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

function lastOf(topic: DiscourseTopicLite) {
  const last = topic.posters?.[topic.posters.length - 1]?.user_id
  return last !== undefined ? store.usersById.get(last) : undefined
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
            <button
              v-for="p in topPeriods"
              :key="p.value"
              class="cat-item"
              @click="pickPeriod(p.value)"
            >
              {{ p.label }}
              <small v-if="activePeriod === p.value">✓</small>
            </button>
          </div>
        </div>
        <button class="chip" :class="{ active: store.mode.type === 'offline' }" @click="store.switchMode({ type: 'offline' }); showTopPanel = false">
          离线
        </button>
        <button class="chip" @click="showCats = !showCats; showTopPanel = false; if (showCats) void store.ensureCategories()">{{ modeName }} ▾</button>
      </div>
      <div v-if="showCats" class="cat-panel">
        <button
          v-for="c in store.categories"
          :key="c.id"
          class="cat-item"
          @click="store.switchMode({ type: 'category', slug: c.slug, id: c.id, name: c.name }); showCats = false"
        >
          <span class="cat-dot" :style="{ background: `#${c.color}` }"></span>
          {{ c.name }}
          <small>{{ c.topic_count }}</small>
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
        <RouterLink :to="`/t/${t.id}`" class="topic-title" @click="onTitleClick($event, t.id)">
          <span v-if="t.pinned" class="pin">置顶</span>
          <span v-if="t.closed" class="closed">已关闭</span>
          {{ t.title }}
        </RouterLink>
        <div class="topic-meta">
          <span v-if="opOf(t)">@{{ opOf(t)?.username }}</span>
          <span>💬 {{ Math.max(0, t.posts_count - 1) }}</span>
          <span v-if="t.like_count">❤ {{ t.like_count }}</span>
          <span>{{ relTime(t.last_posted_at ?? t.created_at) }}</span>
          <img
            v-if="lastOf(t) && lastOf(t)?.id !== opOf(t)?.id"
            class="avatar tiny"
            :src="avatarUrl(lastOf(t)?.avatar_template ?? '', 48)"
            alt=""
            loading="lazy"
          />
          <button
            class="act"
            :class="{ acted: queue.has(t.id) }"
            :title="queue.has(t.id) ? '从阅读队列移除' : '加入阅读队列'"
            :aria-label="queue.has(t.id) ? '从阅读队列移除' : '加入阅读队列'"
            @click="toggleQueue(t)"
          >
            {{ queue.has(t.id) ? '✓' : '＋' }}
          </button>
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
