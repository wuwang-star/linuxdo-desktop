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
  UserSummaryResponse,
  UserActionsResponse
} from '../main/api/client'
import type {
  TranslateConfig,
  DohConfig,
  DohMode,
  NetworkConfig,
  ProxyMode,
  NotificationConfig,
  ExternalApiConfig
} from '../main/api/settings'
import type { AuthKind, LoginCredStatus } from '../main/api/auth'
import type { ConnectStatus, ConnectCallbackMode } from '../main/api/connect'
import type { MessageBusMessage, MessageBusStatus } from '../main/api/messagebus'
import type { BridgeStatus, WizardResult } from '../main/api/bridge'
import type { OfflineTopic, OfflineIndexEntry, SaveResult } from '../main/api/offline'
import type { ThemePackage, ThemeMeta, ImportResult, ExportResult } from '../main/themes'
import type { WebdavConfig, WebdavTestResult } from '../main/api/webdav'
import type { ShortcutsStatus, ShortcutKind } from '../main/api/shortcuts'
import type { DetectResult, DetectStepEvent } from '../main/api/netdetect'

export interface LoginStatus {
  cookie: boolean
  apiKey: boolean
  apiKeyKind: AuthKind | null
  user: CurrentUserResponse['current_user'] | null
}

export interface ApiBridge {
  fetchLatest(page: number, order?: 'views' | 'likes' | 'posts'): Promise<TopicListResponse>
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
  saveLoginCred(username: string, password: string): Promise<LoginCredStatus>
  loginCredStatus(): Promise<LoginCredStatus>
  clearLoginCred(): Promise<LoginCredStatus>
  setApiKey(key: string, username: string): Promise<LoginStatus>
  clearApiKey(): Promise<boolean>
  diagnostics(): Promise<DiagEntry[]>
  echDegradeNote(): Promise<string | null>
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
  /** 上游代理（网络设置）：manual=显式 host:port 最可靠；保存即时生效；testUpstream 实测 CONNECT linux.do */
  getNetworkConfig(): Promise<NetworkConfig>
  setNetworkConfig(mode: ProxyMode, host: string, port: number): Promise<NetworkConfig>
  testUpstream(host: string, port: number): Promise<{ ok: boolean; ms: number; error?: string }>
  /** AI 数据接口（kb-api）：读/存（保存即时生效；失败附 error 字段） */
  getExternalApiConfig(): Promise<ExternalApiConfig>
  setExternalApiConfig(enabled: boolean, port: number): Promise<ExternalApiConfig & { error?: string }>
  getNotificationConfig(): Promise<NotificationConfig>
  setNotificationConfig(enabled: boolean): Promise<NotificationConfig>
  resolveDns(): Promise<{
    ok: boolean
    addresses?: string[]
    error?: string
    via?: 'doh' | 'fallback' | 'literal' | 'system' | 'upstream'
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
  /** 用户卡/详情页（Discourse /u/:username）；actions 为动作流（filter 5=回复，个人页 tab 用） */
  getUser(username: string): Promise<UserResponse>
  getUserSummary(username: string): Promise<UserSummaryResponse>
  getUserActions(username: string, filter?: number, offset?: number): Promise<UserActionsResponse>
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
  /** 同步数据交换：主进程向 renderer 请求 progress/prefs/favorites（token 匹配），返回解绑函数 */
  onSyncRequest(
    cb: (
      channel:
        | 'prefs:getAll'
        | 'prefs:applyAll'
        | 'progress:getAll'
        | 'progress:applyAll'
        | 'favorites:getAll'
        | 'favorites:applyAll',
      token: string,
      payload: unknown
    ) => void
  ): () => void
  /** 应答主进程的同步数据请求（token 原样带回） */
  syncReply(token: string, data: unknown): void
  /** 阅读回传（/topics/timings）：timings 键=楼层号值=毫秒 */
  sendTopicTimings(topicId: number, timings: Record<number, number>, topicTimeMs: number): Promise<unknown>
  /** 自绘窗口钮（单向 send）：最小化 / 最大化切换 / 关闭（=隐藏到托盘） */
  winMinimize(): void
  winToggleMaximize(): void
  winClose(): void
  /** 主题模式镜像到主进程：nativeTheme.themeSource，亮暗全局跟随 */
  setTheme(theme: 'system' | 'light' | 'dark'): Promise<boolean>
  onNotificationPush(cb: (payload: MessageBusMessage) => void): () => void
  onNotificationOpen(cb: (payload: { topicId: number; postNumber: number | null }) => void): () => void
  onSaveProgress(cb: (payload: { id: number; loaded: number; total: number }) => void): () => void
  /** @scope: golden-path —— 三步网络检测（结论 direct-ok/need-shield/fail；步骤进度经 onNetDetectStep 回传） */
  netDetect(): Promise<DetectResult>
  onNetDetectStep(cb: (step: DetectStepEvent) => void): () => void
  /** Welcome 过盾出口：启用 DoH+ECH 并应用运行时（复用设置保存 + 运行时机制，返回网络配置） */
  applyEchOnboarding(): Promise<NetworkConfig>
  /** 使用中网络错误广播（403/429/5xx/断网等最终失败；诊断 toast 数据源） */
  onNetError(cb: (info: { status: number; kind: 'http' | 'network'; message: string }) => void): () => void
}

declare global {
  /** 构建期由 electron.vite.config.ts renderer define 注入的 package.json version */
  const __APP_VERSION__: string
  interface Window {
    api: ApiBridge
  }
}

export {}
