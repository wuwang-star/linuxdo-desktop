<script setup lang="ts">
/** 设置页「label+desc 左 / 控件右」行（base.css .field-row 系）。
 *  label/desc 走 props；富文本标签（徽标/快捷键 code）用 #label 槽、拼接描述用 #desc 槽覆写。
 *  控件区（.field-control/.switch 等结构）由默认 slot 原样提供，DOM 与拆分前逐字节一致。 */
defineProps<{ label?: string; desc?: string }>()
</script>

<template>
  <div class="field-row">
    <div class="field-main">
      <div class="field-label"><slot name="label">{{ label }}</slot></div>
      <div v-if="desc || $slots.desc" class="field-desc"><slot name="desc">{{ desc }}</slot></div>
    </div>
    <slot />
  </div>
</template>
