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
  /** 请求超时毫秒（AbortSignal.timeout；设置后超时不参与重试——避免长超时×退避叠加，仅限显式传入的调用点） */
  timeoutMs?: number
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
    // 每次尝试新建 signal（429 退避重试时拿到完整超时窗口）
    const signal = opts.timeoutMs !== undefined ? AbortSignal.timeout(opts.timeoutMs) : undefined
    try {
      const res = await net.fetch(url, {
        method: opts.method ?? 'GET',
        // 关键：主进程无 origin，same-origin 默认值不会带 cookie，必须显式 include
        credentials: 'include',
        signal,
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
      // AbortSignal.timeout 超时：固定文案且不重试（20s×重试×退避叠加只会更久）
      if (err instanceof Error && err.name === 'TimeoutError') {
        pushDiag({ time: new Date().toISOString(), method: opts.method ?? 'GET', url, status: 0, ms, error: '请求超时' })
        throw new Error('请求超时')
      }
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

/** 主题打开/分块拉取的超时（网络慢时右栏不能无限「加载中」；离线保存等长循环不传此参，语义不变） */
const TOPIC_FETCH_TIMEOUT_MS = 20_000

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
  category_id?: number
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
  /** 原始 Markdown（仅 /posts/{id}.json 单楼接口返回） */
  raw?: string
  /** 当前用户是否可编辑该楼（编辑入口以此为准） */
  can_edit?: boolean
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

/** Top 榜周期（Discourse 核心端点全六档支持，2026-10-16 抓包核实） */
export type TopPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all'

/** 最热列表（2026-10-16 抓包核实：与 latest.json 同构，more_topics_url 为 "/hot?page=1" 即 page 参数分页） */
export function fetchHot(page = 0): Promise<TopicListResponse> {
  return discourseRequest<TopicListResponse>('/hot.json', { query: { page, no_definitions: true } })
}

/** Top 榜（Discourse 核心端点，响应与 latest 同构） */
export function fetchTop(period: TopPeriod, page = 0): Promise<TopicListResponse> {
  return discourseRequest<TopicListResponse>('/top.json', { query: { period, page } })
}

export function fetchCategoryTopics(slug: string, id: number, page = 0): Promise<TopicListResponse> {
  return discourseRequest<TopicListResponse>(`/c/${slug}/${id}.json`, { query: { page } })
}

/** 全文搜索（/search.json）：q 原样透传，@用户/#分类/order:latest 等操作符由服务端解析 */
export interface SearchResultPost {
  id: number
  topic_id: number
  blurb?: string
  username?: string
  created_at?: string
}

export interface SearchResponse {
  posts?: SearchResultPost[]
  topics?: DiscourseTopicLite[]
  users?: DiscourseUserLite[]
  categories?: Array<{ id: number; name: string; color?: string }>
}

export function fetchSearch(q: string, page = 0): Promise<SearchResponse> {
  return discourseRequest<SearchResponse>('/search.json', { query: { q, page } })
}

/** 用户卡/详情页（Discourse 核心端点 /u/:username；字段以实际返回为准，缺失可选） */
export interface DiscourseUserInfo {
  id: number
  username: string
  name?: string
  avatar_template?: string
  title?: string
  bio_cooked?: string
  trust_level?: number
  moderator?: boolean
  admin?: boolean
  created_at?: string
  last_seen_at?: string
}

export interface UserResponse {
  user: DiscourseUserInfo
}

export interface UserSummary {
  likes_given?: number
  likes_received?: number
  topics_entered?: number
  posts_read?: number
  days_visited?: number
  topic_count?: number
  post_count?: number
  bookmark_count?: number
}

export interface UserSummaryTopic {
  id: number
  title: string
  slug: string
}

export interface UserSummaryResponse {
  user_summary: UserSummary
  topics?: UserSummaryTopic[]
}

export function fetchUser(username: string): Promise<UserResponse> {
  return discourseRequest<UserResponse>(`/u/${encodeURIComponent(username)}.json`)
}

export function fetchUserSummary(username: string): Promise<UserSummaryResponse> {
  return discourseRequest<UserSummaryResponse>(`/u/${encodeURIComponent(username)}/summary.json`)
}

export function fetchCategories(): Promise<CategoryListResponse> {
  return discourseRequest<CategoryListResponse>('/categories.json')
}

export function fetchTopic(id: number): Promise<DiscourseTopic> {
  return discourseRequest<DiscourseTopic>(`/t/${id}.json`, { timeoutMs: TOPIC_FETCH_TIMEOUT_MS })
}

export function fetchPostsByIds(topicId: number, postIds: number[]): Promise<PostStreamPostsResponse> {
  return discourseRequest<PostStreamPostsResponse>(`/t/${topicId}/posts.json`, {
    query: { post_ids: postIds },
    timeoutMs: TOPIC_FETCH_TIMEOUT_MS
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

// ---------- 帖子编辑 ----------

/** 取单楼完整数据（含 raw 原文，编辑预填用） */
export function fetchPostRaw(postId: number): Promise<DiscoursePost> {
  return discourseRequest<DiscoursePost>(`/posts/${postId}.json`)
}

/** 编辑楼层：PUT /posts/{id}.json，form-encoded 走既有 CSRF 逻辑（post[raw] 为 Rails 嵌套键记法） */
export function updatePost(postId: number, raw: string): Promise<DiscoursePost> {
  return writeRequest<DiscoursePost>('PUT', `/posts/${postId}.json`, {
    'post[raw]': raw,
    'post[edit_reason]': ''
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
