import { Notification, BrowserWindow } from 'electron'
import type { MessageBusMessage } from './api/messagebus'
import { focusMainWindow } from './win'

/**
 * MessageBus push → 系统原生通知。
 *
 * payload 字段未经登录态实测（与频道名同一校正点，见 SPEC）：按 Discourse 通知对象
 * 常规形态防御式提取 topic_id / post_number / data.topic_title，任一缺失即降级——
 * 无 topic_id 时点击只聚焦主窗，不猜字段、不跳转。
 */
interface PushInfo {
  topicId?: number
  postNumber?: number
  title?: string
}

function extractPushInfo(m: MessageBusMessage): PushInfo {
  const d = typeof m.data === 'object' && m.data !== null ? (m.data as Record<string, unknown>) : null
  if (!d) return {}
  const inner = typeof d.data === 'object' && d.data !== null ? (d.data as Record<string, unknown>) : null
  return {
    topicId: typeof d.topic_id === 'number' ? d.topic_id : undefined,
    postNumber: typeof d.post_number === 'number' ? d.post_number : undefined,
    title: typeof inner?.topic_title === 'string' ? inner.topic_title : undefined
  }
}

export function showPushNotification(m: MessageBusMessage): void {
  if (!Notification.isSupported()) return
  const info = extractPushInfo(m)
  const n = new Notification({
    title: 'linux.do 新通知',
    body: info.title ?? '收到新的论坛通知，点击查看'
  })
  n.on('click', () => {
    focusMainWindow()
    if (info.topicId === undefined) return
    // 交给 renderer 路由跳转（TopicView 已支持 ?pn 直达楼层）
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('notification:open', {
          topicId: info.topicId,
          postNumber: info.postNumber ?? null
        })
      }
    }
  })
  n.show()
}
