/**
 * 阅读进度的 localStorage 聚合（键 `ldd:progress:<topicId>`，与 stores/topic.ts 的 progressKey 同源格式）。
 * WebDAV 同步经 IPC 在 main↔renderer 间搬运（progress:getAll / progress:applyAll），
 * 主进程不直读 localStorage——进度属纯 renderer 状态（见 SPEC 分层决策）。
 */

const PREFIX = 'ldd:progress:'

/** 收集全部进度 → { topicId: 楼层 }（存储不可用返回空集） */
export function collectAllProgress(): Record<string, number> {
  const out: Record<string, number> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(PREFIX)) continue
      const n = Number(localStorage.getItem(key))
      if (Number.isInteger(n) && n > 0) out[key.slice(PREFIX.length)] = n
    }
  } catch {
    /* localStorage 不可用：返回空集 */
  }
  return out
}

/** 云端进度整体覆盖本地（拉取语义）：先清本应用全部进度键再写入，不触碰其他键 */
export function applyAllProgress(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) return
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(PREFIX)) stale.push(key)
    }
    for (const key of stale) localStorage.removeItem(key)
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      // 双重防御：主进程 validateBundle 已过滤，此处再拦一次防脏数据进 localStorage
      if (!/^\d+$/.test(id)) continue
      const n = Number(v)
      if (Number.isInteger(n) && n > 0) localStorage.setItem(`${PREFIX}${id}`, String(n))
    }
  } catch {
    /* localStorage 不可用：静默 */
  }
}
