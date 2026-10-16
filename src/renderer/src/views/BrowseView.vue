<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeView from './HomeView.vue'
import TopicView from './TopicView.vue'
import { useBrowseStore } from '../stores/browse'

const route = useRoute()
const router = useRouter()
const browse = useBrowseStore()

// ---- 双栏判定：≥1200px（matchMedia listener 实时同步，跨阈值即时切换；拉宽恢复双栏且右栏保持当前主题 AC3） ----
const mql = window.matchMedia('(min-width: 1200px)')
const dual = ref(mql.matches)
function onMqlChange(e: MediaQueryListEvent): void {
  dual.value = e.matches
}
mql.addEventListener('change', onMqlChange)
onBeforeUnmount(() => mql.removeEventListener('change', onMqlChange))

// ---- route → store 归一：外部跳转（通知 ?pn / 队列上下贴 / 离线 ?offline=1 / 冷启动深链）统一进 store ----
watch(
  () => ({ name: route.name, id: route.params.id, offline: route.query.offline }),
  (r) => {
    if (r.name === 'topic' && r.id !== undefined) {
      browse.syncFromRoute(Number(r.id), r.offline === '1')
    }
  },
  { immediate: true }
)

// ---- store → route 归一：列表点击（select）统一由这里写 URL；双栏 replace（可分享可回跳不留栈），窄屏 push ----
watch(
  () => browse.selectSeq,
  () => {
    if (browse.selectedId === null) return
    const target = {
      path: `/t/${browse.selectedId}`,
      query: browse.offlineFlag ? { offline: '1' } : undefined
    }
    if (dual.value) void router.replace(target).catch(() => {})
    else void router.push(target).catch(() => {})
  }
)

// 单双栏可见性：双栏两栏常驻；窄屏按 route 模拟 router-view（/ 列表、/t/:id 阅读）
const showList = computed(() => dual.value || route.name === 'home')
const showReader = computed(() => dual.value || route.name === 'topic')
</script>

<template>
  <div class="browse" :data-dual="dual">
    <aside v-show="showList" class="list-pane">
      <HomeView :pane="true" />
    </aside>
    <section v-show="showReader" class="reader-pane">
      <!-- :key 换主题/离线态切换时强制重建（store.open 幂等，重建最省心） -->
      <TopicView
        v-if="browse.selectedId !== null"
        :topic-id="browse.selectedId"
        :offline="browse.offlineFlag"
        :key="`${browse.selectedId}-${browse.offlineFlag}`"
      />
      <!-- R4 右栏空态 -->
      <div v-else class="reader-empty">
        <div class="reader-empty-logo">LINUX<span>DO</span></div>
        <p>从左侧选择主题</p>
      </div>
    </section>
  </div>
</template>
