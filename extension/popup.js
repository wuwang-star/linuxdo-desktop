// popup：配对码输入（存 chrome.storage.local）+ 立即推送（经消息走 SW 同一函数）
const codeInput = document.getElementById('pairCode')
const saveBtn = document.getElementById('save')
const pushBtn = document.getElementById('push')
const statusEl = document.getElementById('status')

function render(result) {
  statusEl.className = result.ok ? 'ok' : 'err'
  const t = new Date(result.time).toLocaleTimeString()
  statusEl.textContent = `${result.ok ? '✅' : '❌'} ${t} ${result.message}`
}

async function showLast() {
  const { lastPush } = await chrome.storage.local.get('lastPush')
  if (lastPush) render(lastPush)
}

async function showCode() {
  const { pairCode } = await chrome.storage.local.get('pairCode')
  if (typeof pairCode === 'string') codeInput.value = pairCode
}

saveBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim()
  if (!/^\d{6}$/.test(code)) {
    statusEl.className = 'err'
    statusEl.textContent = '❌ 配对码必须是 6 位数字'
    return
  }
  await chrome.storage.local.set({ pairCode: code })
  statusEl.className = 'ok'
  statusEl.textContent = '✅ 配对码已保存'
})

pushBtn.addEventListener('click', () => {
  pushBtn.disabled = true
  statusEl.className = ''
  statusEl.textContent = '推送中…'
  chrome.runtime.sendMessage({ type: 'push' }, (result) => {
    pushBtn.disabled = false
    if (chrome.runtime.lastError) {
      statusEl.className = 'err'
      statusEl.textContent = `❌ ${chrome.runtime.lastError.message}`
      return
    }
    if (result) render(result)
  })
})

showCode()
showLast()
