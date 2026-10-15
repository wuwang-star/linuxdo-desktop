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
        this.message = ok ? '登录成功（cookie 已落盘）' : '登录窗口已关闭（未检测到登录态）'
      } catch (e) {
        this.message = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
        await this.refresh()
      }
    },
    async startUserApiKey(mode: 'system-browser' | 'embedded' = 'system-browser') {
      this.loading = true
      this.message = mode === 'system-browser' ? '已在系统浏览器打开授权页，点击页面上的「授权」按钮即可…' : ''
      try {
        const res = await window.api.openUserApiKeyLogin(mode)
        this.message = res.ok
          ? `授权成功${res.username ? `：@${res.username}（API Key 已加密保存，重启免登录）` : '（API Key 已加密保存）'}`
          : `授权失败：${res.error ?? '未知错误'}`
      } catch (e) {
        this.message = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
        await this.refresh()
      }
    },
    async cancelUserApiKey() {
      await window.api.cancelUserApiKey()
      this.loading = false
      this.message = '已取消授权等待'
    },
    async pasteTCookie(value: string) {
      if (!value.trim()) return
      this.loading = true
      try {
        this.status = await window.api.setTCookie(value)
        this.message = this.status.user ? 'cookie 注入成功' : 'cookie 已注入，但未识别到登录态（值可能已过期）'
      } finally {
        this.loading = false
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
