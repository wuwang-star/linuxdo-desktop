/**
 * 阅读回传跟踪（10-19-ux-batch R2）：
 * IntersectionObserver 记录视口内楼层（≥50% 可见），5s 节流把可见楼层以固定毫秒
 * POST /topics/timings——Discourse 据此累计 posts_read/time_read（TL 升级进度数据源）。
 * 离线快照模式不启用（互动与回传都无意义）。路由切换/组件卸载时终 flush。
 */
const TICK_MS = 5000

export function startReadTracking(topicId: number, root: HTMLElement, enabled: () => boolean): () => void {
  if (!root) return () => {}
  const visible = new Set<number>()
  let stopped = false
  let topicTime = 0

  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const m = /^post-(\d+)$/.exec(en.target.id)
        if (!m) continue
        const pn = Number(m[1])
        if (en.isIntersecting) visible.add(pn)
        else visible.delete(pn)
      }
    },
    { root, threshold: 0.5 }
  )

  const observeAll = (): void => {
    for (const el of root.querySelectorAll('.post[id^="post-"]')) io.observe(el)
  }
  observeAll()
  // loadOlder 增量楼层：每次 tick 前补扫（比 MutationObserver 轻）
  const timer = window.setInterval(() => {
    if (stopped || !enabled()) return
    observeAll()
    if (visible.size === 0) return
    topicTime += TICK_MS
    const timings: Record<number, number> = {}
    for (const pn of visible) timings[pn] = TICK_MS
    void window.api.sendTopicTimings(topicId, timings, TICK_MS).catch(() => {
      /* 回传失败静默：下个 tick 继续携带新值，旧值不重试（进度统计容忍丢点） */
    })
  }, TICK_MS)

  return () => {
    stopped = true
    window.clearInterval(timer)
    io.disconnect()
    if (visible.size > 0) {
      // 终 flush：离开页面/切主题把最后一段读时上报（同步尽力，失败即弃）
      topicTime += TICK_MS
      const timings: Record<number, number> = {}
      for (const pn of visible) timings[pn] = TICK_MS
      void window.api.sendTopicTimings(topicId, timings, TICK_MS).catch(() => {})
    }
  }
}
