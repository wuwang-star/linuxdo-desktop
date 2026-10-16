<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { DiscourseUserInfo, UserSummary, UserSummaryTopic } from '../../../main/api/client'
import { avatarUrl } from '../utils/format'

const route = useRoute()
const username = route.params.username as string

const user = ref<DiscourseUserInfo | null>(null)
const summary = ref<UserSummary | null>(null)
const topics = ref<UserSummaryTopic[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [res, sum] = await Promise.all([
      window.api.getUser(username),
      window.api.getUserSummary(username)
    ])
    user.value = res.user
    summary.value = sum.user_summary
    topics.value = (sum.topics ?? []).slice(0, 10)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="profile-page">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="loading" class="loading">加载中…</div>
    <template v-else-if="user">
      <section class="card profile-head">
        <img class="avatar profile-ava" :src="avatarUrl(user.avatar_template ?? '', 288)" alt="" />
        <div class="profile-main">
          <h2 class="profile-name">
            {{ user.name || user.username }}
            <span v-if="user.trust_level != null" class="row-tag pin">TL{{ user.trust_level }}</span>
            <span v-if="user.moderator || user.admin" class="row-tag pin">STAFF</span>
          </h2>
          <div class="profile-sub">@{{ user.username }} <span v-if="user.title" class="row-tag closed">{{ user.title }}</span></div>
          <!-- bio 为 Discourse 成品 HTML，与帖内 cooked 同级信任 -->
          <div v-if="user.bio_cooked" class="cooked profile-bio" v-html="user.bio_cooked"></div>
          <div class="topic-meta">
            <span v-if="user.created_at">加入于 {{ new Date(user.created_at).toLocaleDateString() }}</span>
            <span v-if="user.last_seen_at">最近活跃 {{ new Date(user.last_seen_at).toLocaleDateString() }}</span>
          </div>
        </div>
      </section>

      <section class="card profile-stats">
        <div class="pstat"><b>{{ summary?.topic_count ?? '-' }}</b><span>主题</span></div>
        <div class="pstat"><b>{{ summary?.post_count ?? '-' }}</b><span>发帖</span></div>
        <div class="pstat"><b>{{ summary?.likes_received ?? '-' }}</b><span>获赞</span></div>
        <div class="pstat"><b>{{ summary?.days_visited ?? '-' }}</b><span>访问天数</span></div>
      </section>

      <section class="card">
        <h2>最近主题</h2>
        <article v-for="t in topics" :key="t.id" class="topic-row">
          <div class="topic-main">
            <RouterLink :to="`/t/${t.id}`" class="topic-title">{{ t.title }}</RouterLink>
          </div>
        </article>
        <div v-if="!topics.length" class="tip">暂无公开主题</div>
      </section>
    </template>
  </div>
</template>
