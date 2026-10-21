<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import RailNav from '../components/RailNav.vue'
import UserHoverCard from '../components/UserHoverCard.vue'
import DiagPanel from '../components/DiagPanel.vue'
import { diagOpen, dismissNetToast, netToast, openDiag, showNetErrorToast } from '../utils/diagBus'
import { loadPrefs, markReadyBadgeShown } from '../utils/prefs'

// 窗口钮专用 IPC 句柄（仅模板使用；启动逻辑仍留在 App.vue）
const api = window.api
const route = useRoute()

// @scope: golden-path —— 欢迎流期间隐藏 rail（mockup 屏 1-5/7：整窗流程，无导航噪音）
const showRail = computed(() => route.name !== 'welcome')

// @scope: golden-path —— 使用中网络错误 → toast（R6）：节流与 R8 文案在 utils/diagBus
let offNetError: (() => void) | null = null
onMounted(() => {
  offNetError = api.onNetError((info) => showNetErrorToast(info))
})

// @scope: golden-path —— 第一帖成功时刻（R7）：完成 onboarding 后首次进主框架，
// 右上角一次性 badge，8s 自动消失或点击关闭（prefs.readyBadgeShown 标记）
const readyBadge = ref(false)
let badgeTimer: number | undefined
function closeReadyBadge(): void {
  readyBadge.value = false
  if (badgeTimer !== undefined) {
    window.clearTimeout(badgeTimer)
    badgeTimer = undefined
  }
  markReadyBadgeShown()
}
watch(
  () => route.name,
  (name) => {
    if (!name || name === 'welcome') return
    if (readyBadge.value) return
    const p = loadPrefs()
    if (!p.onboardingDone || p.readyBadgeShown) return
    readyBadge.value = true
    badgeTimer = window.setTimeout(closeReadyBadge, 8000)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  offNetError?.()
  if (badgeTimer !== undefined) window.clearTimeout(badgeTimer)
})
</script>

<template>
  <!-- feishu-im-frame 外框架：左 rail 常驻 + 内容区整宽切换（顶栏已删，win-btns 悬浮右上） -->
  <div class="app-shell">
    <RailNav v-if="showRail" />
    <main class="shell-main">
      <!-- R12：整宽页切换渐显（home↔topic 共用 BrowseView，同组件复用不触发动画）。
           :duration 显式定时器兜底——快速导航打断 leave 时 transitionend 不触发，
           Vue 会永久卡在离场态（路由视图僵死，真机复现）；显式时长后不可能卡 -->
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in" :duration="200">
          <component :is="Component" />
        </Transition>
      </RouterView>
      <UserHoverCard />
    </main>
    <!-- 自绘窗口钮（原生 overlay 已移除）：关闭=隐藏到托盘；双击拖拽区同样可最大化 -->
    <div class="win-btns" data-nodrag>
      <button class="win-btn" aria-label="最小化" @click="api.winMinimize()">
        <svg viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
      </button>
      <button class="win-btn" aria-label="最大化/还原" @click="api.winToggleMaximize()">
        <svg viewBox="0 0 12 12">
          <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
        </svg>
      </button>
      <button class="win-btn close" aria-label="关闭" @click="api.winClose()">
        <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
      </button>
    </div>

    <!-- @scope: golden-path —— 使用中诊断面板 + 错误 toast + 一次性就绪 badge -->
    <DiagPanel v-if="diagOpen" />
    <div v-if="netToast" class="gp-toast" data-nodrag>
      <span>{{ netToast.text }}</span>
      <button class="gp-toast-act" @click="openDiag(); dismissNetToast()">查看诊断</button>
    </div>
    <button
      v-if="readyBadge"
      class="gp-badge"
      data-nodrag
      title="点击关闭"
      @click="closeReadyBadge"
    >
      🎉 一切就绪
    </button>
  </div>
</template>
