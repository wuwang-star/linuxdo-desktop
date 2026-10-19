<script setup lang="ts">
import { useQueueStore } from '../stores/queue'

/** 队列浮层（原 RailNav 内联段迁出）：queue store 自取；显隐由父控（v-if 挂载），点条目 emit close。 */
const queue = useQueueStore()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="queue-panel">
    <h4>队列 · {{ queue.count }}</h4>
    <div v-if="queue.count === 0" class="queue-empty">队列为空：在列表或主题页点「＋」入队（悬停看提示）</div>
    <div v-for="item in queue.items" :key="item.id" class="queue-item">
      <RouterLink :to="`/t/${item.id}`" @click="$emit('close')">{{ item.title }}</RouterLink>
      <button @click="queue.remove(item.id)">移除</button>
    </div>
    <div v-if="queue.count > 0" class="queue-foot">
      <button @click="queue.clear()">清空队列</button>
    </div>
  </div>
</template>
