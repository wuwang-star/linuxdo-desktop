import { defineStore } from 'pinia'
import type { LoginStatus } from '../../../main/api/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    status: null as LoginStatus | null,
    loading: false,
    message: '' as string
  }),
  actions: {
    async refresh() {
      try {
        this.status = await window.api.loginStatus()
      } catch {
        this.status = null
      }
    },
    async openLogin() {
      this.loading = true
      this.message = ''
      try {
        const ok = await window.api.openLogin()
        this.message = ok ? '登录成功' : '登录窗口已关闭（未检测到登录态）'
      } catch (e) {
        this.message = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
        await this.refresh()
      }
    },
    async saveApiKey(key: string, username: string) {
      this.loading = true
      try {
        this.status = await window.api.setApiKey(key, username)
        this.message = 'API Key 已保存'
      } finally {
        this.loading = false
      }
    },
    async clearApiKey() {
      await window.api.clearApiKey()
      this.message = 'API Key 已清除'
      await this.refresh()
    }
  }
})
