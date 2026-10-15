<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useTopicListStore } from '../stores/topicList'
import { avatarUrl, relTime } from '../utils/format'
import type { DiscourseTopicLite } from '../../../main/api/client'

const store = useTopicListStore()
const sentinel = ref<HTMLElement | null>(null)
const showCats = ref(false)

const modeName = computed(() => (store.mode.type === 'category' ? store.mode.name : '最新'))

function opOf(topic: DiscourseTopicLite) {
  const first = topic.posters?.[0]?.user_id
  return first !== undefined ? store.usersById.get(first) : undefined
}

function lastOf(topic: DiscourseTopicLite) {
  const last = topic.posters?.[topic.posters.length - 1]?.user_id
  return last !== undefined ? store.usersById.get(last) : undefined
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
        <button class="chip" @click="showCats = !showCats; if (showCats) void store.ensureCategories()">{{ modeName }} ▾</button>
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

    <article v-for="t in store.topics" :key="t.id" class="topic-row">
      <img class="avatar" :src="avatarUrl(opOf(t)?.avatar_template ?? '')" alt="" loading="lazy" />
      <div class="topic-main">
        <RouterLink :to="`/t/${t.id}`" class="topic-title">
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
        </div>
      </div>
    </article>

    <div ref="sentinel" class="sentinel">
      <span v-if="store.loading">加载中…</span>
      <span v-else-if="store.exhausted">没有更多了</span>
    </div>
  </div>
</template>
