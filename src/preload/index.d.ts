import type {
  CategoryListResponse,
  CurrentUserResponse,
  DiscourseTopic,
  NotificationsResponse,
  PostStreamPostsResponse,
  TopicListResponse,
  TopPeriod,
  DiagEntry
} from '../main/api/client'
import type { TranslateConfig, DohConfig, DohMode, NotificationConfig } from '../main/api/settings'
import type { AuthKind } from '../main/api/auth'
import type { ConnectStatus, ConnectCallbackMode } from '../main/api/connect'
import type { MessageBusMessage, MessageBusStatus } from '../main/api/messagebus'
import type { BridgeStatus, WizardResult } from '../main/api/bridge'
import type { OfflineTopic, OfflineIndexEntry, SaveResult } from '../main/api/offline'

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
  resolveDns(): Promise<{ ok: boolean; addresses?: string[]; error?: string }>
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
  /** 主题模式镜像到主进程：nativeTheme.themeSource + titleBarOverlay 联动 */
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
