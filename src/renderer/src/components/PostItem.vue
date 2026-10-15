<script setup lang="ts">
import { computed } from 'vue'
import type { DiscoursePost } from '../../../main/api/client'
import { avatarUrl, relTime } from '../utils/format'

const props = defineProps<{ post: DiscoursePost }>()
const emit = defineEmits<{ (e: 'jump', postNumber: number): void }>()

const floor = computed(() => `#${props.post.post_number}`)
</script>

<template>
  <article class="post" :data-post-number="post.post_number" :id="`post-${post.post_number}`">
    <img class="avatar" :src="avatarUrl(post.avatar_template)" alt="" loading="lazy" />
    <div class="post-body">
      <header class="post-head">
        <span class="author">@{{ post.username }}</span>
        <span class="floor">{{ floor }}</span>
        <button v-if="post.reply_to_post_number" class="reply-to" @click="emit('jump', post.reply_to_post_number)">
          ↩ 回复 #{{ post.reply_to_post_number }}
        </button>
        <span class="time">{{ relTime(post.created_at) }}</span>
      </header>
      <!-- cooked 为 Discourse 服务端已净化的 HTML -->
      <div class="cooked" v-html="post.cooked"></div>
      <footer v-if="post.like_count" class="post-foot">❤ {{ post.like_count }}</footer>
    </div>
  </article>
</template>
