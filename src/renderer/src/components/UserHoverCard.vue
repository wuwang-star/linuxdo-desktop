<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { avatarUrl } from '../utils/format'
import { hideNow, hoverAnchor, hoverData, hoverError, hoverLoading, hoverVisible, stayUser } from '../utils/userCard'

const router = useRouter()
const route = useRoute()

const WIDTH = 300
/** 估算卡高：用于贴底时上翻；数据加载后实际高度可能更大，vptop 距底 < 260 时一律上翻 */
const CARD_H = 260

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
      <div class="uhc-sk-line w60"></div>
      <div class="uhc-sk-line w90"></div>
      <div class="uhc-sk-line w40"></div>
    </div>
    <template v-else-if="hoverData">
      <div class="uhc-head">
        <img class="uhc-ava" :src="avatarUrl(hoverData.user.avatar_template ?? '', 288)" alt="" />
        <div class="uhc-id">
          <div class="uhc-name">
            {{ hoverData.user.name || hoverData.user.username }}
            <span v-if="hoverData.user.trust_level != null" class="row-tag pin">TL{{ hoverData.user.trust_level }}</span>
            <span v-if="hoverData.user.moderator || hoverData.user.admin" class="row-tag pin">STAFF</span>
          </div>
          <div class="uhc-sub">
            @{{ hoverData.user.username }}
            <span v-if="hoverData.user.title" class="row-tag closed">{{ hoverData.user.title }}</span>
          </div>
        </div>
      </div>
      <!-- bio 为 Discourse 成品 HTML，与帖内 cooked 同级信任 -->
      <div v-if="hoverData.user.bio_cooked" class="cooked uhc-bio" v-html="hoverData.user.bio_cooked"></div>
      <div class="uhc-stats">
        <span><b>{{ hoverData.summary?.topic_count ?? '-' }}</b> 主题</span>
        <span><b>{{ hoverData.summary?.post_count ?? '-' }}</b> 发帖</span>
        <span><b>{{ hoverData.summary?.likes_received ?? '-' }}</b> 获赞</span>
      </div>
      <RouterLink
        v-if="hoverData.topics[0]"
        :to="`/t/${hoverData.topics[0].id}`"
        class="uhc-topic"
        @click="hideNow"
      >
        {{ hoverData.topics[0].title }}
      </RouterLink>
      <button class="uhc-more" @click="goProfile">查看主页 →</button>
    </template>
    <div v-else-if="hoverError" class="uhc-error">{{ hoverError }}</div>
  </div>
</template>
