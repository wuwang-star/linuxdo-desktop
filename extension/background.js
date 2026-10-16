// LinuxDo Desktop 伴生扩展 service worker（MV3）：
// 监听 linux.do 的 _t cookie 变化 → 带配对码 POST 到桌面客户端本机回环口。
// 注意：_t 值只经内存转发到 127.0.0.1:17366，绝不写入 chrome.storage / console。
const INGEST_URL = 'http://127.0.0.1:17366/ingest'
const HELLO_URL = 'http://127.0.0.1:17366/ingest-hello'
const PUSH_DEBOUNCE_MS = 1500 // 登录时 _t 可能连续 set 多次，合并为一次推送

let pushTimer = null

function isTargetCookie(cookie) {
  return cookie && cookie.name === '_t' && /(^|\.)linux\.do$/.test(cookie.domain || '')
}

async function getPairCode() {
  const { pairCode } = await chrome.storage.local.get('pairCode')
  return typeof pairCode === 'string' ? pairCode.trim() : ''
}

/** 读取浏览器里 linux.do 的 _t 值（多个域条目时取最后一个，即最新写入） */
async function readTCookie() {
  const cookies = await chrome.cookies.getAll({ domain: 'linux.do', name: '_t' })
  if (!cookies.length) return null
  return cookies[cookies.length - 1].value
}

async function pushTCookie() {
  const result = { time: new Date().toISOString(), ok: false, message: '' }
  try {
    const pairCode = await getPairCode()
    if (!pairCode) throw new Error('未填写配对码，请点击扩展图标填写')
    const t = await readTCookie()
    if (!t) throw new Error('浏览器里没有 linux.do 的 _t cookie，请先登录')
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairCode, tCookie: t })
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) {
      result.ok = true
      result.message = data.username ? `已同步（@${data.username}）` : '已同步'
    } else {
      result.message = `推送被拒（HTTP ${res.status}）${data.error ? `：${data.error}` : ''}`
    }
  } catch (e) {
    result.message = e instanceof Error ? e.message : String(e)
  }
  // 只存结果摘要，不存 cookie 本体
  await chrome.storage.local.set({ lastPush: result })
  return result
}

/** 自动推送入口：防抖合并，SW 休眠时由 onChanged 事件唤醒 */
function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    pushTCookie()
  }, PUSH_DEBOUNCE_MS)
}

chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
  if (removed) return
  if (!isTargetCookie(cookie)) return
  schedulePush()
})

// popup「立即推送」经消息走同一推送函数
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'push') {
    pushTCookie().then(sendResponse)
    return true // 异步应答
  }
})

/** 握手（R7）：带码 POST /ingest-hello，让应用知道「扩展已连接」；只发配对码，无任何 cookie */
function sendHello() {
  getPairCode().then((code) => {
    if (!code) return // 未配对时不打扰
    fetch(HELLO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairCode: code })
    }).catch(() => {
      /* 应用未开桥接等，静默 */
    })
  })
}

// SW 每次启动（顶层执行）+ 安装/更新时各握手一次；应用据此在向导/桥接行显示「已连接」
chrome.runtime.onInstalled.addListener(sendHello)
sendHello()
