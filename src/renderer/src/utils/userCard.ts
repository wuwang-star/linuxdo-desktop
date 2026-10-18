/**
 * 用户悬浮卡全局状态机（utils 层，无组件依赖）。
 * 交互（方案 A，10-18-user-flow-ui）：触点 mouseenter → hoverUser(username, event)，
 * 400ms 延迟出卡（App.vue 根挂载的 <UserHoverCard/> 消费）；mouseleave 走 150ms 宽限
 * （指针可移入卡上不消失，卡上 enter 调 stayUser 续命）；滚动/路由变化/Esc → hideNow() 即隐。
 * 点击触点由各视图直接 router.push(/u/username)（直达主页，无 modal 层）。
 * 数据 60s 缓存 + inflight 去重（user+summary 并取）。
 */
import { ref } from 'vue'
import type { DiscourseUserInfo, UserSummary, UserSummaryTopic } from '../../../main/api/client'

export interface UserCardData {
  user: DiscourseUserInfo
  summary: UserSummary | null
  topics: UserSummaryTopic[]
}

/** 悬浮卡显隐状态（UserHoverCard 消费） */
export const hoverVisible = ref(false)
export const hoverUsername = ref<string | null>(null)
export const hoverAnchor = ref<DOMRect | null>(null)
export const hoverData = ref<UserCardData | null>(null)
export const hoverLoading = ref(false)
export const hoverError = ref('')

interface CacheEntry {
  data: UserCardData
  at: number
}
const CACHE_TTL = 60_000
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<UserCardData>>()

async function loadUser(username: string): Promise<UserCardData> {
  const hit = cache.get(username)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data
  const running = inflight.get(username)
  if (running) return running
  const p = (async (): Promise<UserCardData> => {
    const [res, sum] = await Promise.all([
      window.api.getUser(username),
      window.api.getUserSummary(username).catch(() => null)
    ])
    const data: UserCardData = {
      user: res.user,
      summary: sum?.user_summary ?? null,
      topics: (sum?.topics ?? []).slice(0, 1)
    }
    cache.set(username, { data, at: Date.now() })
    return data
  })()
  inflight.set(username, p)
  try {
    return await p
  } finally {
    inflight.delete(username)
  }
}

let showTimer: number | undefined
let hideTimer: number | undefined

/** 触点 mouseenter：同一用户重复进入（卡↔触点往返）只刷新锚点，不重置 400ms 计时 */
export function hoverUser(username: string, e?: MouseEvent): void {
  if (!username) return
  window.clearTimeout(hideTimer)
  const rect = e?.currentTarget instanceof Element ? e.currentTarget.getBoundingClientRect() : null
  if (hoverUsername.value !== username) {
    window.clearTimeout(showTimer)
    hoverUsername.value = username
    hoverVisible.value = false
    hoverError.value = ''
    hoverAnchor.value = rect
    const cached = cache.get(username)
    hoverData.value = cached && Date.now() - cached.at < CACHE_TTL ? cached.data : null
    showTimer = window.setTimeout(() => {
      hoverVisible.value = true
      if (hoverData.value) return
      hoverLoading.value = true
      loadUser(username)
        .then((d) => {
          if (hoverUsername.value === username) hoverData.value = d
        })
        .catch((err) => {
          if (hoverUsername.value === username) hoverError.value = err instanceof Error ? err.message : String(err)
        })
        .finally(() => {
          hoverLoading.value = false
        })
    }, 400)
  } else if (rect) {
    hoverAnchor.value = rect
  }
}

/** 触点 mouseleave：150ms 宽限（给移入卡的时间） */
export function cancelUser(): void {
  window.clearTimeout(showTimer)
  hideTimer = window.setTimeout(hideNow, 150)
}

/** 卡面 mouseenter：撤销宽限隐藏 */
export function stayUser(): void {
  window.clearTimeout(hideTimer)
}

/** 立即隐藏（滚动 capture / 路由变化 / Esc / 跳转主页前） */
export function hideNow(): void {
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  hoverVisible.value = false
  hoverUsername.value = null
  hoverAnchor.value = null
}
