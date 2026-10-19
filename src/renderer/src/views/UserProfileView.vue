<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { DiscourseUserInfo, UserActionItem, UserSummary, UserSummaryTopic } from '../../../main/api/client'
import { avatarUrl, relTime } from '../utils/format'

const route = useRoute()
const username = computed(() => String(route.params.username ?? ''))

const user = ref<DiscourseUserInfo | null>(null)
const summary = ref<UserSummary | null>(null)
const topics = ref<UserSummaryTopic[]>([])
const loading = ref(true)
const error = ref('')

// ---- tab：主题 / 回复（回复走 user_actions filter=5，首次进入拉取一次） ----
const tab = ref<'topics' | 'replies'>('topics')
const replies = ref<UserActionItem[]>([])
const repliesLoading = ref(false)
const repliesError = ref('')

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  tab.value = 'topics'
  try {
    const [res, sum] = await Promise.all([
      window.api.getUser(username.value),
      window.api.getUserSummary(username.value)
    ])
    user.value = res.user
    summary.value = sum.user_summary
    topics.value = (sum.topics ?? []).slice(0, 10)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadReplies(): Promise<void> {
  if (replies.value.length || repliesLoading.value) return
  repliesLoading.value = true
  repliesError.value = ''
  try {
    const res = await window.api.getUserActions(username.value, 5)
    replies.value = res.user_actions ?? []
  } catch (e) {
    repliesError.value = e instanceof Error ? e.message : String(e)
  } finally {
    repliesLoading.value = false
  }
}

function switchTab(t: 'topics' | 'replies'): void {
  tab.value = t
  if (t === 'replies') void loadReplies()
}

onMounted(load)
watch(username, load)

/** banner 背景：card_background upload 模板有则用图，否则 accent 渐变兜底 */
const bannerStyle = computed(() => {
  const cb = user.value?.card_background
  if (cb) {
    const url = avatarUrl(cb, 1200)
    if (url) return { backgroundImage: `url(${url})` }
  }
  return {}
})

/** 统计八项（label/值），缺失显示 - */
const stats = computed(() => {
  const s = summary.value
  return [
    { label: '主题', v: s?.topic_count },
    { label: '发帖', v: s?.post_count },
    { label: '获赞', v: s?.likes_received },
    { label: '送出赞', v: s?.likes_given },
    { label: '访问天数', v: s?.days_visited },
    { label: '阅读帖数', v: s?.posts_read },
    { label: '进入主题', v: s?.topics_entered },
    { label: '书签', v: s?.bookmark_count }
  ]
})

/** TL2 参考阈值（Discourse 默认；time_read 秒 → 显示分钟） */
const tlProgress = computed(() => {
  const s = summary.value
  const rows: Array<{ label: string; cur: number; target: number }> = [
    { label: '访问天数', cur: s?.days_visited ?? 0, target: 15 },
    { label: '阅读帖数', cur: s?.posts_read ?? 0, target: 100 },
    { label: '进入主题', cur: s?.topics_entered ?? 0, target: 20 },
    { label: '阅读分钟', cur: Math.round((s?.time_read ?? 0) / 60), target: 60 },
    { label: '送出赞', cur: s?.likes_given ?? 0, target: 1 },
    { label: '获赞', cur: s?.likes_received ?? 0, target: 1 }
  ]
  return rows.map((r) => ({ ...r, pct: Math.min(100, Math.round((r.cur / r.target) * 100)) }))
})
</script>

<template>
  <div class="profile-page">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="loading" class="loading">加载中…</div>
    <template v-else-if="user">
      <!-- 头卡：banner（card_background 或渐变兜底）+ 叠压头像 + 身份行 + bio + meta -->
      <section class="card profile-head">
        <div class="profile-banner" :class="{ plain: !user.card_background }" :style="bannerStyle"></div>
        <div class="profile-head-main">
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
            <div class="profile-meta">
              <span v-if="user.created_at">加入于 {{ new Date(user.created_at).toLocaleDateString() }}</span>
              <span v-if="user.last_seen_at">最近活跃 {{ relTime(user.last_seen_at) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 统计八项 -->
      <section class="card profile-stats">
        <div v-for="s in stats" :key="s.label" class="pstat">
          <b>{{ s.v ?? '-' }}</b><span>{{ s.label }}</span>
        </div>
      </section>

      <!-- 等级进度（TL2 参考，10-19-ux-batch R3）：站点自定义阈值不暴露 API，标注参考值 -->
      <section class="card">
        <h2>等级进度 <span class="row-tag closed">参考值</span></h2>
        <p class="tip">按 Discourse 默认 TL2 阈值估算；linux.do 实际要求以官方公告为准。在应用内读帖已回传阅读进度（posts_read 计入）。</p>
        <div v-for="r in tlProgress" :key="r.label" class="tl-row">
          <span class="tl-label">{{ r.label }}</span>
          <div class="tl-bar">
            <div class="tl-fill" :class="{ done: r.pct >= 100 }" :style="{ width: r.pct + '%' }"></div>
          </div>
          <span class="tl-val">{{ r.cur }}/{{ r.target }}</span>
        </div>
      </section>

      <!-- 主题 / 回复 -->
      <section class="card profile-feed">
        <div class="profile-tabs" role="tablist">
          <button class="profile-tab" :class="{ active: tab === 'topics' }" role="tab" @click="switchTab('topics')">主题</button>
          <button class="profile-tab" :class="{ active: tab === 'replies' }" role="tab" @click="switchTab('replies')">回复</button>
        </div>

        <template v-if="tab === 'topics'">
          <article v-for="t in topics" :key="t.id" class="profile-row">
            <RouterLink :to="`/t/${t.id}`" class="profile-row-title">{{ t.title }}</RouterLink>
          </article>
          <div v-if="!topics.length" class="tip">暂无公开主题</div>
        </template>

        <template v-else>
          <div v-if="repliesLoading" class="loading">加载回复…</div>
          <div v-else-if="repliesError" class="tip">回复流加载失败：{{ repliesError }}</div>
          <template v-else>
            <article v-for="(a, i) in replies" :key="i" class="profile-row">
              <div class="profile-row-head">
                <RouterLink
                  v-if="a.topic_id"
                  :to="a.post_number && a.post_number > 1 ? `/t/${a.topic_id}?pn=${a.post_number}` : `/t/${a.topic_id}`"
                  class="profile-row-title"
                >{{ a.title || '（已删除主题）' }}</RouterLink>
                <span v-else class="profile-row-title muted">{{ a.title || '（已删除主题）' }}</span>
                <span class="time">{{ relTime(a.created_at) }}</span>
              </div>
              <!-- excerpt 为 Discourse 服务端净化摘要，与 cooked 同级信任 -->
              <div v-if="a.excerpt" class="profile-row-excerpt" v-html="a.excerpt"></div>
            </article>
            <div v-if="!replies.length" class="tip">暂无公开回复</div>
          </template>
        </template>
      </section>
    </template>
  </div>
</template>
