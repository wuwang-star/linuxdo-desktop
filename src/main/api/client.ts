import { net } from 'electron'

export const BASE_URL = 'https://linux.do'

/** 浏览器级 UA（跟随 Electron 内置 Chromium 版本，去掉 Electron 痕迹） */
const PLATFORM_TOKEN =
  process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : 'X11; Linux x86_64'
export const USER_AGENT = `Mozilla/5.0 (${PLATFORM_TOKEN}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome ?? '140.0.0.0'} Safari/537.36`

export interface DiagEntry {
  time: string
  method: string
  url: string
  status: number
  ms: number
  error?: string
}

const diag: DiagEntry[] = []
const DIAG_CAP = 100

export function pushDiag(entry: DiagEntry): void {
  diag.unshift(entry)
  if (diag.length > DIAG_CAP) diag.length = DIAG_CAP
}

export function getDiag(): DiagEntry[] {
  return diag.slice()
}

/** 由 auth 模块注入（避免循环依赖） */
let authHeadersProvider: () => Record<string, string> = () => ({})

export function setAuthHeadersProvider(fn: () => Record<string, string>): void {
  authHeadersProvider = fn
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Record<string, string | number | boolean | string[] | number[] | undefined>
  headers?: Record<string, string>
  body?: unknown
  /** 429/网络错误重试次数上限（默认 3） */
  retries?: number
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, BASE_URL)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(`${k}[]`, String(item))
      } else {
        url.searchParams.set(k, String(v))
      }
    }
  }
  return url.toString()
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * 主进程统一 Discourse 请求出口：
 * - 与登录窗口共享默认 session（cookie 自动带上）
 * - 429 指数退避（尊重 Retry-After），网络错误同样重试
 * - 每次请求记录诊断日志
 */
export async function discourseRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query)
  const maxRetries = opts.retries ?? 3
  let attempt = 0

  for (;;) {
    const started = Date.now()
    try {
      const res = await net.fetch(url, {
        method: opts.method ?? 'GET',
        // 关键：主进程无 origin，same-origin 默认值不会带 cookie，必须显式 include
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
          ...authHeadersProvider(),
          ...opts.headers
        },
        body: opts.body === undefined ? undefined : opts.body instanceof URLSearchParams ? opts.body : JSON.stringify(opts.body)
      })
      const ms = Date.now() - started
      pushDiag({ time: new Date().toISOString(), method: opts.method ?? 'GET', url, status: res.status, ms })

      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt
        await sleep(waitMs)
        attempt++
        continue
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} <- ${url}`)
      }
      return (await res.json()) as T
    } catch (err) {
      const ms = Date.now() - started
      const message = err instanceof Error ? err.message : String(err)
      pushDiag({ time: new Date().toISOString(), method: opts.method ?? 'GET', url, status: 0, ms, error: message })
      // 网络层错误（DNS/连接中断）同样退避重试
      if (attempt < maxRetries) {
        await sleep(1000 * 2 ** attempt)
        attempt++
        continue
      }
      throw err
    }
  }
}

// ---------- 领域端点 ----------

export interface DiscourseUserLite {
  id: number
  username: string
  name?: string
  avatar_template: string
}

export interface DiscourseTopicLite {
  id: number
  title: string
  fancy_title?: string
  posts_count: number
  created_at?: string
  last_posted_at?: string
  pinned?: boolean
  closed?: boolean
  archetype?: string
  like_count?: number
  last_poster_username?: string
  posters?: { user_id: number; description?: string }[]
  topic_id?: number
  slug?: string
}

export interface DiscoursePost {
  id: number
  post_number: number
  username: string
  name?: string
  avatar_template: string
  cooked: string
  reply_to_post_number?: number | null
  /** 点赞等操作摘要：id=2 为 like；acted 表示当前用户已操作 */
  actions_summary?: Array<{ id: number; count?: number; acted?: boolean; can_undo?: boolean }>
  reply_count?: number
  created_at: string
  like_count?: number
  reads?: number
  score?: number
  yt_url?: string
}

export interface DiscourseTopic {
  id: number
  title: string
  fancy_title?: string
  posts_count: number
  created_at?: string
  details?: {
    created_by?: DiscourseUserLite
    last_poster?: DiscourseUserLite
    notification_level?: number
    can_edit?: boolean
  }
  post_stream?: {
    posts: DiscoursePost[]
    stream: number[]
  }
  suggested_topics?: DiscourseTopicLite[]
  bookmarked?: boolean
  last_read_post_number?: number
  highest_post_number?: number
}

export interface TopicListResponse {
  users: DiscourseUserLite[]
  topic_list: {
    can_create_topic?: boolean
    more_topics_url?: string
    per_page?: number
    topics: DiscourseTopicLite[]
  }
}

export interface CategoryListResponse {
  category_list: {
    can_create_category?: boolean
    categories: Array<{
      id: number
      name: string
      slug: string
      color: string
      text_color?: string
      topic_count: number
      description_text?: string
      read_restricted?: boolean
      parent_category_id?: number | null
      subcategory_ids?: number[]
    }>
  }
}

export interface PostStreamPostsResponse {
  post_stream: { posts: DiscoursePost[] }
  id: number
}

export interface CurrentUserResponse {
  current_user?: DiscourseUserLite & { unread_notifications?: number; unread_high_priority_notifications?: number }
}

export function fetchLatest(page = 0): Promise<TopicListResponse> {
  return discourseRequest<TopicListResponse>('/latest.json', { query: { page, no_definitions: true } })
}

export function fetchCategoryTopics(slug: string, id: number, page = 0): Promise<TopicListResponse> {
  return discourseRequest<TopicListResponse>(`/c/${slug}/${id}.json`, { query: { page } })
}

export function fetchCategories(): Promise<CategoryListResponse> {
  return discourseRequest<CategoryListResponse>('/categories.json')
}

export function fetchTopic(id: number): Promise<DiscourseTopic> {
  return discourseRequest<DiscourseTopic>(`/t/${id}.json`)
}

export function fetchPostsByIds(topicId: number, postIds: number[]): Promise<PostStreamPostsResponse> {
  return discourseRequest<PostStreamPostsResponse>(`/t/${topicId}/posts.json`, {
    query: { post_ids: postIds }
  })
}

export function fetchCurrentUser(): Promise<CurrentUserResponse> {
  return discourseRequest<CurrentUserResponse>('/session/current.json')
}

// ---------- CSRF 与写操作（cookie 会话） ----------

let csrfToken: string | null = null

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await discourseRequest<{ csrf: string }>('/session/csrf.json')
  csrfToken = res.csrf
  return csrfToken
}

/**
 * 写操作统一入口：form-encoded + X-CSRF-Token。
 * CSRF 过期（403）时刷新 token 自动重试一次。
 */
async function writeRequest<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  form: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const doCall = async (): Promise<T> => {
    const token = await ensureCsrfToken()
    const body = new URLSearchParams()
    for (const [k, v] of Object.entries(form)) {
      if (v !== undefined) body.set(k, String(v))
    }
    return discourseRequest<T>(path, {
      method,
      headers: {
        'X-CSRF-Token': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })
  }
  try {
    return await doCall()
  } catch (err) {
    if (err instanceof Error && err.message.includes('403')) {
      csrfToken = null
      return doCall()
    }
    throw err
  }
}

/** 回帖（可指定回复楼层）；成功返回新建的 post 对象 */
export function createReply(
  topicId: number,
  raw: string,
  replyToPostNumber?: number
): Promise<DiscoursePost> {
  return writeRequest<DiscoursePost>('POST', '/posts.json', {
    topic_id: topicId,
    raw,
    reply_to_post_number: replyToPostNumber
  })
}

const LIKE_ACTION_TYPE = 2

/** 点赞（post_action_type_id=2） */
export function likePost(postId: number): Promise<unknown> {
  return writeRequest<unknown>('POST', '/post_actions', {
    id: postId,
    post_action_type_id: LIKE_ACTION_TYPE,
    flag_topic: false
  })
}

/** 取消点赞 */
export function unlikePost(postId: number): Promise<unknown> {
  return writeRequest<unknown>('DELETE', `/post_actions/${postId}`, {
    post_action_type_id: LIKE_ACTION_TYPE
  })
}

/** 收藏主题（P1 只做添加；移除需要 bookmark id，留待后续） */
export function bookmarkTopic(topicId: number): Promise<unknown> {
  return writeRequest<unknown>('POST', '/bookmarks', {
    bookmarkable_id: topicId,
    bookmarkable_type: 'Topic'
  })
}

// ---------- 通知 ----------

export interface DiscourseNotification {
  id: number
  notification_type: number
  read: boolean
  high_priority: boolean
  created_at: string
  post_number: number
  topic_id: number
  slug: string
  fancy_title?: string
  data?: {
    topic_title?: string
    original_username?: string
    display_username?: string
    revision_number?: number
  }
}

export interface NotificationsResponse {
  notifications: DiscourseNotification[]
  total_rows_notifications?: number
  seen_notification_id?: number
  load_more_notifications?: string
}

export function fetchNotifications(page = 1): Promise<NotificationsResponse> {
  return discourseRequest<NotificationsResponse>('/notifications.json', {
    query: { recent: true, page, limit: 30 }
  })
}

export function markNotificationsRead(): Promise<unknown> {
  return writeRequest<unknown>('PUT', '/notifications/mark-read', {})
}
export const TAIL_MARKER_888 = 1
