import { net, session } from 'electron'
import { USER_AGENT, ensureCsrfToken, fetchCurrentUser, fetchNotifications } from './client'

/** P1 自检：登录态下 cookie/CSRF/通知端点可达性（只读，无副作用）。逐步输出，失败即停。 */
export async function probeP1(): Promise<void> {
  const cookies = await session.defaultSession.cookies.get({ url: 'https://linux.do' })
  console.log(`COOKIES names=${cookies.map((c) => c.name).join(',') || '(none)'}`)
  // user_api_key 授权页是否开放（决定方式一是否可用）
  const uak = await net.fetch('https://linux.do/user_api_key/new', {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    credentials: 'include'
  })
  console.log(`UAK_PAGE status=${uak.status}${uak.status === 200 ? ' (开放)' : ' (可能被禁用)'}`)
  const me = await fetchCurrentUser()
  console.log(`SESSION_OK user=${me.current_user?.username ?? '(未登录)'}`)
  const token = await ensureCsrfToken()
  console.log(`CSRF_OK len=${token.length}`)
  const notifications = await fetchNotifications(1)
  console.log(`NOTIF_OK count=${notifications.notifications?.length ?? 0}`)
}
