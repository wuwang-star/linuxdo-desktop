<script setup lang="ts" generic="T extends string | number">
/** 分段单选（base.css .seg/.seg-opt）。受控组件：modelValue + update:modelValue。
 *  泛型 T 保证 v-model 回写类型安全（主题模式 string 联合 / 行距 number / 宽度 string|number）。
 *  外层定位类（.field-control 等）经透传 class 挂到根。 */
defineProps<{
  options: { value: T; label: string }[]
  modelValue: T
  disabled?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="seg">
    <label v-for="o in options" :key="String(o.value)" class="seg-opt">
      <input
        type="radio"
        :value="o.value"
        :checked="modelValue === o.value"
        :disabled="disabled"
        @change="$emit('update:modelValue', o.value)"
      />
      <span>{{ o.label }}</span>
    </label>
  </div>
</template>
