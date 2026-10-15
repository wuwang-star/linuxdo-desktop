import type {
  CategoryListResponse,
  CurrentUserResponse,
  DiscourseTopic,
  NotificationsResponse,
  PostStreamPostsResponse,
  TopicListResponse,
  DiagEntry
} from '../main/api/client'
import type { TranslateConfig } from '../main/api/settings'
import type { AuthKind } from '../main/api/auth'
import type { ConnectStatus, ConnectCallbackMode } from '../main/api/connect'

export interface LoginStatus {
  cookie: boolean
  apiKey: boolean
  apiKeyKind: AuthKind | null
  user: CurrentUserResponse['current_user'] | null
}

export interface ApiBridge {
  fetchLatest(page: number): Promise<TopicListResponse>
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
  fetchNotifications(page: number): Promise<NotificationsResponse>
  markNotificationsRead(): Promise<unknown>
  translatePost(postId: number, text: string): Promise<string>
  getTranslateConfig(): Promise<TranslateConfig>
  setTranslateConfig(baseUrl: string, model: string, key?: string): Promise<TranslateConfig>
  getConnectStatus(): Promise<ConnectStatus>
  saveConnectConfig(clientId: string, callbackMode: ConnectCallbackMode, clientSecret?: string): Promise<ConnectStatus>
  connectLogin(): Promise<{ ok: boolean; username?: string; error?: string }>
}

declare global {
  interface Window {
    api: ApiBridge
  }
}

export {}
