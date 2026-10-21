<script setup lang="ts">
/**
 * 降级指引卡（10-21-golden-path，PRD R5）：出路 A/B 图文，文案按 mockup 屏 7。
 * WelcomeView 降级屏与 DiagPanel「查看降级指引」共用，避免双份漂移。
 */
</script>

<template>
  <div class="gp-diag wide">
    <h4>出路 A · 使用已有代理（推荐，1 分钟）</h4>
    <div class="gp-step ok">
      <span class="st">1</span>
      <div>打开 Clash / v2rayN 等代理工具<small>确认「系统代理」已开启</small></div>
    </div>
    <div class="gp-step ok">
      <span class="st">2</span>
      <div>回到这里点「重新检测」<small>应用会自动发现系统代理并链式接入</small></div>
    </div>
    <h4 class="mt">出路 B · 无代理环境</h4>
    <div class="gp-step bad">
      <span class="st">✗</span>
      <div>当前线路无法直连 linux.do<small>可稍后重试，或到社区反馈你的运营商线路</small></div>
    </div>
  </div>
</template>
