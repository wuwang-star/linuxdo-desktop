/**
 * 用户卡全局单例状态（utils 层，无组件依赖）：
 * 任意列表/帖子头像、@作者 点击 openUserCard(username)，App.vue 挂载的 <UserCard/> 消费。
 */
import { ref } from 'vue'

const username = ref<string | null>(null)

export function openUserCard(u: string): void {
  username.value = u
}

export function closeUserCard(): void {
  username.value = null
}

export function useUserCard() {
  return username
}
