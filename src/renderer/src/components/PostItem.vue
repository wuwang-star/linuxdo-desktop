<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { DiscoursePost } from '../../../main/api/client'
import { avatarUrl, relTime } from '../utils/format'
import { likeInfo } from '../stores/topic'
import { cancelUser, hideNow, hoverUser } from '../utils/userCard'

const props = defineProps<{ post: DiscoursePost; offline?: boolean; isOp?: boolean; compact?: boolean; flash?: boolean }>()
const emit = defineEmits<{
  (e: 'jump', postNumber: number): void
  (e: 'like', postId: number): void
  (e: 'reply', postNumber: number): void
  (e: 'edit', post: DiscoursePost): void
}>()

const like = computed(() => likeInfo(props.post))
const floor = computed(() => `#${props.post.post_number}`)
const router = useRouter()

/** 作者身份触点：hover 悬浮卡，点击直达主页（方案 A） */
function goUser(): void {
  hideNow()
  void router.push(`/u/${props.post.username}`)
}

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

// ---- 引用块折叠（R11，ALDR 220px 方案）：cooked 渲染后探测超长 bare blockquote，
//      在其后注入展开/收起钮（v-html 内容无法用纯 CSS 做条件折叠）。
//      只处理 .cooked 直接子级（aside.quote 引用楼结构不动）；编辑导致 cooked 变化后重跑。
const BQ_FOLD_PX = 220

function enhanceQuotes(): void {
  const root = document.getElementById(`cooked-${props.post.id}`)
  if (!root) return
  for (const bq of Array.from(root.querySelectorAll(':scope > blockquote'))) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'bq-toggle'
    const apply = (): void => {
      btn.hidden = bq.scrollHeight <= BQ_FOLD_PX + 1
      btn.textContent = bq.classList.contains('bq-open') ? '收起引用' : '展开引用'
    }
    btn.addEventListener('click', () => {
      bq.classList.toggle('bq-open')
      apply()
    })
    bq.insertAdjacentElement('afterend', btn)
    apply()
  }
}

onMounted(() => void nextTick(enhanceQuotes))
watch(
  () => props.post.cooked,
  () => void nextTick(enhanceQuotes)
)
</script>

<template>
  <article class="post" :class="{ 'post--compact': compact, flash }" :id="`post-${post.post_number}`">
    <img
      class="avatar clickable"
      :src="avatarUrl(post.avatar_template)"
      alt=""
      loading="lazy"
      title="查看主页"
      @mouseenter="hoverUser(post.username, $event)"
      @mouseleave="cancelUser"
      @click="goUser"
    />
    <div class="post-body">
      <header class="post-head">
        <span
          class="author clickable"
          title="查看主页"
          @mouseenter="hoverUser(post.username, $event)"
          @mouseleave="cancelUser"
          @click="goUser"
        >@{{ post.username }}</span>
        <!-- 楼主角标：楼号 1 或作者 = OP（feishu-im-frame R4） -->
        <span v-if="isOp" class="op-badge">楼主</span>
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

      <!-- 离线快照：点赞/回复/编辑/翻译均需网络，整体隐藏（楼内跳转回复 # 仍可用）；
           R11 动作行降噪：无内容的次级动作（回复/无译文）默认低透明度，楼层 hover/focus-within 显现 -->
      <footer v-if="!offline" class="post-actions">
        <button class="act" :class="{ acted: like.acted, quiet: !like.acted && like.count === 0 }" @click="emit('like', post.id)">
          {{ like.acted ? '❤' : '🤍' }} {{ like.count || '' }}
        </button>
        <button class="act quiet" @click="emit('reply', post.post_number)">💬 回复</button>
        <!-- 编辑入口以 API 返回的 can_edit 为准（有内容项，常显） -->
        <button v-if="post.can_edit" class="act" @click="emit('edit', post)">✏ 编辑</button>
        <button class="act" :class="{ quiet: !translation }" :disabled="trLoading" @click="translate">
          {{ trLoading ? '翻译中…' : translation ? (trVisible ? '隐藏译文' : '显示译文') : '译' }}
        </button>
        <span v-if="trError" class="tr-error">{{ trError }}</span>
      </footer>
    </div>
  </article>
</template>
