<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DiscoursePost } from '../../../main/api/client'
import { avatarUrl, relTime } from '../utils/format'
import { likeInfo } from '../stores/topic'
import { openUserCard } from '../utils/userCard'

const props = defineProps<{ post: DiscoursePost; offline?: boolean }>()
const emit = defineEmits<{
  (e: 'jump', postNumber: number): void
  (e: 'like', postId: number): void
  (e: 'reply', postNumber: number): void
  (e: 'edit', post: DiscoursePost): void
}>()

const like = computed(() => likeInfo(props.post))
const floor = computed(() => `#${props.post.post_number}`)

// ---- 翻译（localStorage 缓存 + 按需调用） ----
const trKey = computed(() => `ldd:tr:${props.post.id}`)
const translation = ref<string>(localStorage.getItem(trKey.value) ?? '')
const trLoading = ref(false)
const trError = ref('')
const trVisible = ref(false)

async function translate(): Promise<void> {
  if (translation.value) {
    trVisible.value = !trVisible.value
    return
  }
  trVisible.value = true
  if (trLoading.value) return
  trLoading.value = true
  trError.value = ''
  try {
    const el = document.getElementById(`cooked-${props.post.id}`)
    const text = (el?.textContent ?? '').trim()
    if (!text) throw new Error('没有可翻译的文本')
    const out = await window.api.translatePost(props.post.id, text)
    translation.value = out
    localStorage.setItem(trKey.value, out)
  } catch (e) {
    trError.value = e instanceof Error ? e.message : String(e)
    trVisible.value = false
  } finally {
    trLoading.value = false
  }
}
</script>

<template>
  <article class="post" :id="`post-${post.post_number}`">
    <img class="avatar clickable" :src="avatarUrl(post.avatar_template)" alt="" loading="lazy" title="查看用户卡片" @click="openUserCard(post.username)" />
    <div class="post-body">
      <header class="post-head">
        <span class="author clickable" title="查看用户卡片" @click="openUserCard(post.username)">@{{ post.username }}</span>
        <span class="floor">{{ floor }}</span>
        <button v-if="post.reply_to_post_number" class="reply-to" @click="emit('jump', post.reply_to_post_number)">
          ↩ 回复 #{{ post.reply_to_post_number }}
        </button>
        <span class="time">{{ relTime(post.created_at) }}</span>
      </header>
      <!-- cooked 为 Discourse 服务端已净化的 HTML -->
      <div class="cooked" :id="`cooked-${post.id}`" v-html="post.cooked"></div>

      <div v-if="translation && trVisible" class="tr-block">
        <div class="tr-label">译文</div>
        <div class="tr-text">{{ translation }}</div>
      </div>

      <!-- 离线快照：点赞/回复/编辑/翻译均需网络，整体隐藏（楼内跳转回复 # 仍可用） -->
      <footer v-if="!offline" class="post-actions">
        <button class="act" :class="{ acted: like.acted }" @click="emit('like', post.id)">
          {{ like.acted ? '❤' : '🤍' }} {{ like.count || '' }}
        </button>
        <button class="act" @click="emit('reply', post.post_number)">💬 回复</button>
        <!-- 编辑入口以 API 返回的 can_edit 为准 -->
        <button v-if="post.can_edit" class="act" @click="emit('edit', post)">✏ 编辑</button>
        <button class="act" :disabled="trLoading" @click="translate">
          {{ trLoading ? '翻译中…' : translation ? (trVisible ? '隐藏译文' : '显示译文') : '译' }}
        </button>
        <span v-if="trError" class="tr-error">{{ trError }}</span>
      </footer>
    </div>
  </article>
</template>
