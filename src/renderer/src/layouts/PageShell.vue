<script setup lang="ts">
/** 整宽页通用页壳：标题行（title + actions 右上动作）+ 页面 padding + 112px 窗口钮安全区 + 滚动容器。
 *  页面专属类（皮肤/样式钩子）经透传 attr 挂到根上，如 NotificationsView 的 class="notif-page"。 */
defineProps<{ title: string }>()
</script>

<template>
  <div class="page-shell">
    <div class="page-shell-head">
      <h2>{{ title }}</h2>
      <div v-if="$slots.actions" class="page-shell-actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>
