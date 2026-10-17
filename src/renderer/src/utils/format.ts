const BASE = 'https://linux.do'

export function avatarUrl(template: string, size = 96): string {
  if (!template) return ''
  const filled = template.replace('{size}', String(size))
  return filled.startsWith('http') ? filled : `${BASE}${filled}`
}

export function relTime(iso?: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(then).toLocaleDateString('zh-CN')
}

/** 列表行时间（feishu-im-frame）：24h 内相对时刻，更早=「M月D日」 */
export function rowTime(iso?: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  if (Date.now() - then < 24 * 3600_000) return relTime(iso)
  const d = new Date(then)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
