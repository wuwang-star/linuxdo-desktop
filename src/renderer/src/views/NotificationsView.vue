<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { relTime } from '../utils/format'
import type { DiscourseNotification } from '../../../main/api/client'

const router = useRouter()
const auth = useAuthStore()
const items = ref<DiscourseNotification[]>([])
const loading = ref(false)
const error = ref('')
const marking = ref(false)

const TYPE_LABEL: Record<number, string> = {
  1: '提及',
  2: '回复',
  5: '编辑',
  6: '点赞',
  9: '点赞',
  11: '私信',
  12: '徽章',
  16: '回复',
  17: '引用',
  34: '已解决'
}

function label(n: DiscourseNotification): string {
  return TYPE_LABEL[n.notification_type] ?? '通知'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const res = await window.api.fetchNotifications(1)
    items.value = res.notifications ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function markAllRead(): Promise<void> {
  if (marking.value) return
  marking.value = true
  try {
    await window.api.markNotificationsRead()
    items.value = items.value.map((n) => ({ ...n, read: true }))
    await auth.refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    marking.value = false
  }
}

function open(n: DiscourseNotification): void {
  if (!n.read) {
    n.read = true
    void auth.refresh()
  }
  void router.push({ path: `/t/${n.topic_id}`, query: n.post_number > 1 ? { pn: String(n.post_number) } : {} })
}

onMounted(() => void load())
</script>

<template>
  <div class="notif-page">
    <div class="notif-head">
      <h2>通知</h2>
      <button class="act" :disabled="marking" @click="markAllRead">{{ marking ? '处理中…' : '全部已读' }}</button>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="items.length === 0" class="loading">暂无通知（未登录时不可见）</div>
    <button
      v-for="n in items"
      :key="n.id"
      class="notif-item"
      :class="{ unread: !n.read }"
      @click="open(n)"
    >
      <span class="dot" :class="{ on: !n.read }"></span>
      <span class="tag">{{ label(n) }}</span>
      <span class="body">
        <strong>{{ n.data?.display_username ?? n.data?.original_username ?? '有人' }}</strong>
        {{ n.data?.topic_title ?? n.fancy_title ?? '' }}
        <em v-if="n.post_number > 1">#{{ n.post_number }}</em>
      </span>
      <span class="time">{{ relTime(n.created_at) }}</span>
    </button>
  </div>
</template>
