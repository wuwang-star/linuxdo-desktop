// 站内 host 判断用局部常量：main 的 BASE_URL 带 electron 依赖，不给 renderer 引
export const SITE_ORIGIN = 'https://linux.do'

export interface SiteTopicLink {
  topicId: number
  postNumber: number
}

/**
 * 解析本站主题链接（含 quote 引用块的楼层链接）：
 * /t/<id>、/t/<slug>/<id>、/t/<slug>/<id>/<post_number>（绝对或相对 href 均可）。
 * 非本站或非 /t/ 路径返回 null（交系统浏览器）。
 * ponytail: /t/<num>/<num> 无 slug 形态按「次末段=主题、末段=楼层」猜，站点不生成此形态，遇错链优先级低。
 */
export function parseSiteTopicLink(href: string): SiteTopicLink | null {
  let u: URL
  try {
    u = new URL(href, SITE_ORIGIN)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.host !== 'linux.do') return null
  const seg = u.pathname.split('/').filter(Boolean)
  if (seg[0] !== 't') return null
  const nums = seg.slice(1).filter((s) => /^\d+$/.test(s)).map(Number)
  if (nums.length === 0) return null
  if (nums.length >= 2) return { topicId: nums[nums.length - 2], postNumber: nums[nums.length - 1] }
  return { topicId: nums[0], postNumber: 1 }
}
