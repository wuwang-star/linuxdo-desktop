import { session } from 'electron'
import { ensureCsrfToken, fetchCurrentUser, fetchNotifications } from './client'

/** P1 自检：登录态下 cookie/CSRF/通知端点可达性（只读，无副作用）。逐步输出，失败即停。 */
export async function probeP1(): Promise<void> {
  const cookies = await session.defaultSession.cookies.get({ url: 'https://linux.do' })
  console.log(`COOKIES names=${cookies.map((c) => c.name).join(',') || '(none)'}`)
  const me = await fetchCurrentUser()
  console.log(`SESSION_OK user=${me.current_user?.username ?? '(未登录)'}`)
  const token = await ensureCsrfToken()
  console.log(`CSRF_OK len=${token.length}`)
  const notifications = await fetchNotifications(1)
  console.log(`NOTIF_OK count=${notifications.notifications?.length ?? 0}`)
}
