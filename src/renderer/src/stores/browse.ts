import { defineStore } from 'pinia'

/**
 * 双栏浏览选择态：右栏当前主题。
 * 不持有 router（避免 store ↔ router 循环依赖）：select 只改状态并递增 selectSeq，
 * URL 同步（replace/push、双栏/窄屏分流）由 BrowseView 监听 seq 统一执行。
 */
export const useBrowseStore = defineStore('browse', {
  state: () => ({
    /** 右栏当前主题 id（null = 未选择，右栏显示占位） */
    selectedId: null as number | null,
    /** 当前主题是否以离线快照阅读 */
    offlineFlag: false,
    /** 每次 select 递增：同 id 重复点击（如窄屏返回列表后再点同一主题）也要触发导航 */
    selectSeq: 0
  }),
  actions: {
    /** 列表点击：记录选中；URL 由 BrowseView 统一同步 */
    select(id: number, offline = false): void {
      this.selectedId = id
      this.offlineFlag = offline
      this.selectSeq++
    },
    /** 外部路由跳转（通知 ?pn / 队列上下贴 / 离线 ?offline=1 / 冷启动深链）归一进 store；与当前一致时 no-op 防循环 */
    syncFromRoute(id: number, offline: boolean): void {
      if (this.selectedId === id && this.offlineFlag === offline) return
      this.selectedId = id
      this.offlineFlag = offline
    }
  }
})
