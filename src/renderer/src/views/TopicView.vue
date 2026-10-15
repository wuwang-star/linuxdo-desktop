<script setup lang="ts">
import { onMounted, onBeforeUnmount, nextTick, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTopicStore } from '../stores/topic'
import PostItem from '../components/PostItem.vue'

const route = useRoute()
const store = useTopicStore()
const scroller = ref<HTMLElement | null>(null)
const topicId = computed(() => Number(route.params.id))

const total = computed(() => store.stream.length || store.topic?.posts_count || 0)
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

onMounted(() => {
  void store.open(topicId.value)
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
</script>

<template>
  <div class="topic-page">
    <div ref="scroller" class="topic-scroller">
      <div v-if="store.loading" class="loading">加载中…</div>
      <div v-else-if="store.error" class="error">{{ store.error }}</div>
      <template v-else-if="store.topic">
        <h1 class="topic-title-h1">{{ store.topic.title }}</h1>
        <div class="topic-sub">
          共 {{ store.topic.posts_count }} 楼 · 已读至 #{{ store.readProgress(topicId) || 1 }}
          <label class="only-op">
            <input type="checkbox" v-model="store.onlyOp" />
            只看楼主
          </label>
          <span v-if="store.minLoadedIdx > 0" class="hint">（向上滚动加载更早楼层）</span>
        </div>

        <div v-if="store.loadingOlder" class="loading">加载更早楼层…</div>

        <PostItem v-for="p in store.visiblePosts" :key="p.id" :post="p" @jump="go" />

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
  </div>
</template>
