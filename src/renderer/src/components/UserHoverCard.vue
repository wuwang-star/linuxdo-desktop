<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { avatarUrl, relTime } from '../utils/format'
import { hideNow, hoverAnchor, hoverData, hoverError, hoverLoading, hoverVisible, stayUser } from '../utils/userCard'

const router = useRouter()
const route = useRoute()

const WIDTH = 320
/** 估算卡高：banner+头像+内容 ≈ 340；贴底时上翻 */
const CARD_H = 340

const style = computed(() => {
  const a = hoverAnchor.value
  if (!a) return { display: 'none' }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const flipUp = a.bottom + CARD_H > vh && a.top > CARD_H
  const top = flipUp ? Math.max(8, a.top - CARD_H - 6) : a.bottom + 6
  const left = Math.min(Math.max(8, a.right - WIDTH), Math.max(8, vw - WIDTH - 8))
  return { top: `${top}px`, left: `${left}px`, width: `${WIDTH}px` }
})

/** banner 背景：card_background upload 模板有则用图（对齐 linux.do 原生卡），否则渐变兜底 */
const bannerStyle = computed(() => {
  const cb = hoverData.value?.user.card_background
  if (cb) {
    const url = avatarUrl(cb, 600)
    if (url) return { backgroundImage: `url(${url})` }
  }
  return {}
})

function goProfile(): void {
  const u = hoverData.value?.user.username
  if (!u) return
  hideNow()
  void router.push(`/u/${u}`)
}

// 全局隐藏路径：滚动（capture 覆盖内部滚动容器）/路由变化/Esc
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') hideNow()
}
onMounted(() => {
  window.addEventListener('scroll', hideNow, true)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', hideNow, true)
  window.removeEventListener('keydown', onKey)
})
watch(
  () => route.fullPath,
  () => hideNow()
)
</script>

<template>
  <div v-if="hoverVisible && hoverAnchor" class="uhc" :style="style" role="tooltip" @mouseenter="stayUser" @mouseleave="hideNow">
    <div v-if="hoverLoading && !hoverData" class="uhc-skeleton">
      <div class="uhc-sk-banner"></div>
      <div class="uhc-sk-line w60"></div>
      <div class="uhc-sk-line w90"></div>
      <div class="uhc-sk-line w40"></div>
    </div>
    <template v-else-if="hoverData">
      <!-- 结构对齐 Discourse/linux.do 原生用户卡：banner → 头像叠压 → 名字/头衔 → @id → bio → 位置/网站 → 元数据 → 统计 -->
      <div class="uhc-banner" :class="{ plain: !hoverData.user.card_background }" :style="bannerStyle"></div>
      <div class="uhc-body">
        <img class="uhc-ava" :src="avatarUrl(hoverData.user.avatar_template ?? '', 288)" alt="" />
        <div class="uhc-id">
          <div class="uhc-name">
            {{ hoverData.user.name || hoverData.user.username }}
            <span v-if="hoverData.user.trust_level != null" class="row-tag pin">TL{{ hoverData.user.trust_level }}</span>
            <span v-if="hoverData.user.moderator || hoverData.user.admin" class="row-tag pin">STAFF</span>
            <span v-if="hoverData.user.badge_count" class="row-tag closed">徽章 {{ hoverData.user.badge_count }}</span>
          </div>
          <div class="uhc-sub">
            @{{ hoverData.user.username }}
            <span v-if="hoverData.user.title" class="row-tag closed">{{ hoverData.user.title }}</span>
          </div>
        </div>
        <!-- bio 优先取纯文本摘要（bio_excerpt），退回成品 HTML（bio_cooked）；均为服务端净化同级信任 -->
        <div v-if="hoverData.user.bio_excerpt" class="uhc-bio-text">{{ hoverData.user.bio_excerpt }}</div>
        <div v-else-if="hoverData.user.bio_cooked" class="cooked uhc-bio" v-html="hoverData.user.bio_cooked"></div>
        <div v-if="hoverData.user.location || hoverData.user.website" class="uhc-meta">
          <span v-if="hoverData.user.location" class="uhc-meta-item">{{ hoverData.user.location }}</span>
          <span v-if="hoverData.user.website" class="uhc-meta-item">{{ hoverData.user.website }}</span>
        </div>
        <div class="uhc-times">
          <span v-if="hoverData.user.last_posted_at"><i>最近发帖</i>{{ relTime(hoverData.user.last_posted_at) }}</span>
          <span v-if="hoverData.user.created_at"><i>加入</i>{{ new Date(hoverData.user.created_at).toLocaleDateString() }}</span>
        </div>
        <div class="uhc-stats">
          <span><b>{{ hoverData.summary?.topic_count ?? '-' }}</b> 主题</span>
          <span><b>{{ hoverData.summary?.post_count ?? '-' }}</b> 发帖</span>
          <span><b>{{ hoverData.summary?.likes_received ?? '-' }}</b> 获赞</span>
        </div>
        <button class="uhc-more" @click="goProfile">查看主页 →</button>
      </div>
    </template>
    <div v-else-if="hoverError" class="uhc-error">{{ hoverError }}</div>
  </div>
</template>
