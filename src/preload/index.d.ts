import type {
  CategoryListResponse,
  CurrentUserResponse,
  DiscourseTopic,
  PostStreamPostsResponse,
  TopicListResponse,
  DiagEntry
} from '../main/api/client'

export interface LoginStatus {
  cookie: boolean
  apiKey: boolean
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
  setApiKey(key: string, username: string): Promise<LoginStatus>
  clearApiKey(): Promise<boolean>
  diagnostics(): Promise<DiagEntry[]>
}

declare global {
  interface Window {
    api: ApiBridge
  }
}

export {}
