# UI 全量审计扫描器：多页面 × 多窗口尺寸 → 截图 + DOM 溢出/裁剪检测
# 前置：应用已关；`node_modules/.bin/electron . --remote-debugging-port=9222 &`
# 输出：docs/screenshots/audit/<尺寸>/<页>.png + 控制台问题清单
import base64
import json
import os
import sys
import time
import urllib.request

import websocket

CDP = 'http://127.0.0.1:9222'
OUT = 'docs/screenshots/audit'
SIZES = [(1400, 940), (1024, 720), (860, 620)]  # 常规 / 小窗 / 极窄


def targets():
    with urllib.request.urlopen(f'{CDP}/json') as r:
        return json.load(r)


class C:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=70, suppress_origin=True)
        self.mid = 0

    def cmd(self, method, params=None, sid=None):
        self.mid += 1
        msg = {'id': self.mid, 'method': method, 'params': params or {}}
        if sid:
            msg['sessionId'] = sid
        ws.send(json.dumps(msg))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == self.mid:
                if 'error' in m:
                    raise RuntimeError(f'{method}: {m["error"]}')
                return m.get('result', {})


def find_main_ws():
    for t in targets():
        if t.get('type') == 'page' and 'file:' in t.get('url', ''):
            return t['webSocketDebuggerUrl']
    raise SystemExit('main window not found')


def audit_dom(sid):
    """返回当前页面的问题列表：横向溢出 / 视口外元素 / 文本裁剪（固定高被截）"""
    expr = """(() => {
      const probs = []
      const vw = document.documentElement.clientWidth
      // 1) 文档横向溢出
      if (document.documentElement.scrollWidth > vw + 2) {
        const offenders = []
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect()
          if (r.right > vw + 2 && r.width > 8 && offenders.length < 5) {
            offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0,40)}@${Math.round(r.right)}`)
          }
        })
        probs.push(`h-overflow vw=${vw} scrollW=${document.documentElement.scrollWidth} ${offenders.join(' | ')}`)
      }
      // 2) 固定/限高容器文本被截（scrollHeight 明显大于 clientHeight）
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el)
        if ((cs.overflowY === 'hidden' || cs.overflow === 'hidden') && el.scrollHeight > el.clientHeight + 6 && el.clientHeight > 12 && el.clientHeight < 400) {
          const txt = (el.innerText || '').trim().slice(0, 24)
          if (txt) probs.push(`clip ${el.tagName.toLowerCase()}.${String(el.className).slice(0,36)} ch=${el.clientHeight} sh=${el.scrollHeight} "${txt}"`)
        }
      })
      return probs.slice(0, 12)
    })()"""
    r = c.cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True}, sid)
    return r.get('result', {}).get('value') or []


def shot(sid, path):
    r = c.cmd('Page.captureScreenshot', {'format': 'png'}, sid)
    with open(path, 'wb') as f:
        f.write(base64.b64decode(r['data']))


ws = websocket.create_connection(find_main_ws(), timeout=70, suppress_origin=True)
c = C.__new__(C)
c.ws = ws
c.mid = 0
c.cmd('Page.enable')
c.cmd('Runtime.enable')
root_sid = c.cmd('Target.attachToTarget', {'targetId': [t for t in targets() if 'file:' in t['url']][0]['id'], 'flatten': True})['sessionId']


def ev(expr, sid=None):
    sid = sid or root_sid
    r = c.cmd('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True}, sid)
    return r.get('result', {}).get('value')


# 页面状态：路由 + 可选前置动作（JS）
PAGES = [
    ('home-latest', '#/', None),
    ('home-views', None, "window.location.hash='#/'; document.querySelectorAll('.chip-wrap .chip')[1] ? Array.from(document.querySelectorAll('.chip')).find(b=>b.textContent.includes('最多浏览'))?.click() : null"),
    ('home-fav', None, "Array.from(document.querySelectorAll('.fav-wrap .fav-folder')).find(b=>b.textContent.includes('默认'))?.click()"),
    ('topic', None, "(()=>{const a=Array.from(document.querySelectorAll('a[href*=\"/t/\"]'))[0]; const m=a&&a.getAttribute('href').match(/\\/(?:t)\\/(?:[^/]+\\/)?(\\d+)/); window.location.hash='#/t/'+(m?m[1]:1)})()"),
    ('notifications', '#/notifications', None),
    ('user', '#/u/wuwang_star', None),
    ('login', '#/login', None),
    ('settings', '#/settings', None),
]

issues = {}
for (w, h) in SIZES:
    tag = f'{w}x{h}'
    os.makedirs(f'{OUT}/{tag}', exist_ok=True)
    ev(f'window.resizeTo({w}, {h})')
    time.sleep(0.6)
    for name, hash_url, action in PAGES:
        if hash_url:
            ev(f'window.location.hash = {json.dumps(hash_url)}')
        elif action:
            ev("window.location.hash = '#/'")
            time.sleep(0.8)
            ev(action)
        time.sleep(2.5)
        try:
            probs = audit_dom(sid=root_sid)
            shot(root_sid, f'{OUT}/{tag}/{name}.png')
            if probs:
                issues[f'{tag}/{name}'] = probs
            print(f'[{tag}] {name}: {"OK" if not probs else str(len(probs))+" 问题"}', flush=True)
        except Exception as e:
            # 断线重连（page 级失败不拖垮整轮）
            print(f'[{tag}] {name}: FAIL {type(e).__name__}', flush=True)
            try:
                ws.close()
            except Exception:
                pass
            ws2 = websocket.create_connection(find_main_ws(), timeout=70, suppress_origin=True)
            ws = ws2
            c.ws = ws2
            root_sid = c.cmd('Target.attachToTarget', {'targetId': [t for t in targets() if 'file:' in t['url']][0]['id'], 'flatten': True})['sessionId']

print('\n=== 问题清单 ===')
for k, v in issues.items():
    print(f'-- {k}')
    for p in v:
        print('  ', p)
print(f'\n截图: {OUT}/  | 问题页: {len(issues)}')
