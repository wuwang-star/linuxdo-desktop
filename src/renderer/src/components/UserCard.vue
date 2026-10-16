<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { DiscourseUserInfo, UserSummary, UserSummaryTopic } from '../../../main/api/client'
import { avatarUrl } from '../utils/format'
import { closeUserCard, useUserCard } from '../utils/userCard'

const current = useUserCard()
const router = useRouter()

// Esc 回退（遮罩/关闭钮之外的键盘路径）
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeUserCard()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const user = ref<DiscourseUserInfo | null>(null)
const summary = ref<UserSummary | null>(null)
const topics = ref<UserSummaryTopic[]>([])
const loading = ref(false)
const error = ref('')

watch(current, (u) => {
  user.value = null
  summary.value = null
  topics.value = []
  error.value = ''
  if (!u) return
  loading.value = true
  Promise.all([window.api.getUser(u), window.api.getUserSummary(u)])
    .then(([res, sum]) => {
      user.value = res.user
      summary.value = sum.user_summary
      topics.value = (sum.topics ?? []).slice(0, 3)
    })
    .catch((e) => {
      error.value = e instanceof Error ? e.message : String(e)
    })
    .finally(() => {
      loading.value = false
    })
})

function goProfile(): void {
  if (!user.value) return
  closeUserCard()
  void router.push(`/u/${user.value.username}`)
}
</script>

<template>
  <div v-if="current" class="overlay" @click.self="closeUserCard">
    <section class="card ucard" role="dialog" aria-label="用户卡片">
      <button class="ucard-close" aria-label="关闭" @click="closeUserCard">×</button>
      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <template v-else-if="user">
        <div class="ucard-head">
          <img class="avatar ucard-ava" :src="avatarUrl(user.avatar_template ?? '', 288)" alt="" />
          <div class="ucard-id">
            <div class="ucard-name">
              {{ user.name || user.username }}
              <span v-if="user.trust_level != null" class="row-tag pin">TL{{ user.trust_level }}</span>
              <span v-if="user.moderator || user.admin" class="row-tag pin">STAFF</span>
            </div>
            <div class="ucard-sub">
              @{{ user.username }}
              <span v-if="user.title" class="row-tag closed">{{ user.title }}</span>
            </div>
          </div>
        </div>
        <!-- bio 为 Discourse 成品 HTML，与帖内 cooked 同级信任 -->
        <div v-if="user.bio_cooked" class="cooked ucard-bio" v-html="user.bio_cooked"></div>
        <div class="ucard-stats">
          <div class="pstat"><b>{{ summary?.topic_count ?? '-' }}</b><span>主题</span></div>
          <div class="pstat"><b>{{ summary?.post_count ?? '-' }}</b><span>发帖</span></div>
          <div class="pstat"><b>{{ summary?.likes_received ?? '-' }}</b><span>获赞</span></div>
          <div class="pstat"><b>{{ summary?.days_visited ?? '-' }}</b><span>访问天数</span></div>
        </div>
        <div v-if="topics.length" class="ucard-topics">
          <RouterLink v-for="t in topics" :key="t.id" :to="`/t/${t.id}`" class="ucard-topic" @click="closeUserCard">
            {{ t.title }}
          </RouterLink>
        </div>
        <div class="row">
          <button class="primary" @click="goProfile">查看主页</button>
        </div>
      </template>
    </section>
  </div>
</template>
