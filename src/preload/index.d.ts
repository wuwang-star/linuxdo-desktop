import type {
  CategoryListResponse,
  CurrentUserResponse,
  DiscourseTopic,
  NotificationsResponse,
  PostStreamPostsResponse,
  SearchResponse,
  TopicListResponse,
  TopPeriod,
  DiagEntry,
  UserResponse,
  UserSummaryResponse
} from '../main/api/client'
import type { TranslateConfig, DohConfig, DohMode, NotificationConfig } from '../main/api/settings'
import type { AuthKind } from '../main/api/auth'
import type { ConnectStatus, ConnectCallbackMode } from '../main/api/connect'
import type { MessageBusMessage, MessageBusStatus } from '../main/api/messagebus'
import type { BridgeStatus, WizardResult } from '../main/api/bridge'
import type { OfflineTopic, OfflineIndexEntry, SaveResult } from '../main/api/offline'
import type { ThemePackage, ThemeMeta, ImportResult, ExportResult } from '../main/themes'
import type { WebdavConfig, WebdavTestResult } from '../main/api/webdav'
import type { ShortcutsStatus, ShortcutKind } from '../main/api/shortcuts'

export interface LoginStatus {
  cookie: boolean
  apiKey: boolean
  apiKeyKind: AuthKind | null
  user: CurrentUserResponse['current_user'] | null
}

export interface ApiBridge {
  fetchLatest(page: number): Promise<TopicListResponse>
  fetchHot(page: number): Promise<TopicListResponse>
  fetchTop(period: TopPeriod, page: number): Promise<TopicListResponse>
  fetchCategories(): Promise<CategoryListResponse>
  fetchCategoryTopics(slug: string, id: number, page: number): Promise<TopicListResponse>
  fetchTopic(id: number): Promise<DiscourseTopic>
  fetchSearch(q: string, page: number): Promise<SearchResponse>
  fetchPosts(topicId: number, postIds: number[]): Promise<PostStreamPostsResponse>
  loginStatus(): Promise<LoginStatus>
  openLogin(): Promise<boolean>
  openUserApiKeyLogin(mode?: 'system-browser' | 'embedded'): Promise<{ ok: boolean; username?: string; error?: string }>
  cancelUserApiKey(): Promise<boolean>
  setTCookie(value: string): Promise<LoginStatus>
  setApiKey(key: string, username: string): Promise<LoginStatus>
  clearApiKey(): Promise<boolean>
  diagnostics(): Promise<DiagEntry[]>
  createReply(topicId: number, raw: string, replyTo?: number): Promise<import('../main/api/client').DiscoursePost>
  likePost(postId: number): Promise<unknown>
  unlikePost(postId: number): Promise<unknown>
  bookmarkTopic(topicId: number): Promise<unknown>
  getPostRaw(postId: number): Promise<import('../main/api/client').DiscoursePost>
  updatePost(postId: number, raw: string): Promise<import('../main/api/client').DiscoursePost>
  fetchNotifications(page: number): Promise<NotificationsResponse>
  markNotificationsRead(): Promise<unknown>
  translatePost(postId: number, text: string): Promise<string>
  getTranslateConfig(): Promise<TranslateConfig>
  setTranslateConfig(baseUrl: string, model: string, key?: string): Promise<TranslateConfig>
  getDohConfig(): Promise<DohConfig>
  setDohConfig(enabled: boolean, mode: DohMode, template: string): Promise<DohConfig>
  getNotificationConfig(): Promise<NotificationConfig>
  setNotificationConfig(enabled: boolean): Promise<NotificationConfig>
  resolveDns(): Promise<{
    ok: boolean
    addresses?: string[]
    error?: string
    via?: 'doh' | 'fallback' | 'literal' | 'system'
  }>
  getConnectStatus(): Promise<ConnectStatus>
  saveConnectConfig(clientId: string, callbackMode: ConnectCallbackMode, clientSecret?: string): Promise<ConnectStatus>
  connectLogin(): Promise<{ ok: boolean; username?: string; error?: string }>
  messageBusStart(userId: number): Promise<MessageBusStatus>
  messageBusStop(): Promise<boolean>
  messageBusStatus(): Promise<MessageBusStatus>
  getBridgeStatus(): Promise<BridgeStatus>
  setBridgeEnabled(enabled: boolean): Promise<BridgeStatus>
  regenBridgePair(): Promise<BridgeStatus>
  installWizard(): Promise<WizardResult>
  openSystemLogin(): Promise<void>
  saveOffline(id: number): Promise<SaveResult>
  offlineList(): Promise<OfflineIndexEntry[]>
  offlineGet(id: number): Promise<OfflineTopic | null>
  offlineRemove(id: number): Promise<boolean>
  /** 主题工坊：list=已导入元信息，get=整包，exportData 内置/导入主题通用另存 */
  themesList(): Promise<ThemeMeta[]>
  themesGet(id: string): Promise<ThemePackage | null>
  themesImport(): Promise<ImportResult>
  themesExportData(theme: ThemePackage): Promise<ExportResult>
  themesRemove(id: string): Promise<boolean>
  /** 用户卡/详情页（Discourse /u/:username） */
  getUser(username: string): Promise<UserResponse>
  getUserSummary(username: string): Promise<UserSummaryResponse>
  /** WebDAV 手动同步：配置（password 留空=不修改）、测试连接（needMkCol=目录不存在可自动创建）、推送/拉取 */
  getWebdavConfig(): Promise<WebdavConfig>
  setWebdavConfig(server: string, username: string, remoteDir: string, password?: string): Promise<WebdavConfig>
  webdavTestConn(): Promise<WebdavTestResult>
  webdavPush(): Promise<{ ok: boolean; error?: string }>
  webdavPull(): Promise<{ ok: boolean; exportedAt?: string; error?: string }>
  /** 全局快捷键：状态（含注册失败原因）与单项开关切换（即时生效） */
  getShortcutsStatus(): Promise<ShortcutsStatus>
  setShortcutEnabled(kind: ShortcutKind, enabled: boolean): Promise<ShortcutsStatus>
  /** 主进程 Alt+Shift+N 广播 → renderer 执行队列下一贴跳转，返回解绑函数 */
  onQueueNext(cb: () => void): () => void
  /** 同步数据交换：主进程向 renderer 请求 progress/prefs（token 匹配），返回解绑函数 */
  onSyncRequest(
    cb: (
      channel: 'prefs:getAll' | 'prefs:applyAll' | 'progress:getAll' | 'progress:applyAll',
      token: string,
      payload: unknown
    ) => void
  ): () => void
  /** 应答主进程的同步数据请求（token 原样带回） */
  syncReply(token: string, data: unknown): void
  /** 自绘窗口钮（单向 send）：最小化 / 最大化切换 / 关闭（=隐藏到托盘） */
  winMinimize(): void
  winToggleMaximize(): void
  winClose(): void
  /** 主题模式镜像到主进程：nativeTheme.themeSource，亮暗全局跟随 */
  setTheme(theme: 'system' | 'light' | 'dark'): Promise<boolean>
  onNotificationPush(cb: (payload: MessageBusMessage) => void): () => void
  onNotificationOpen(cb: (payload: { topicId: number; postNumber: number | null }) => void): () => void
  onSaveProgress(cb: (payload: { id: number; loaded: number; total: number }) => void): () => void
}

declare global {
  /** 构建期由 electron.vite.config.ts renderer define 注入的 package.json version */
  const __APP_VERSION__: string
  interface Window {
    api: ApiBridge
  }
}

export {}
