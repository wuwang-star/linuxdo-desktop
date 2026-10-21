# UI 审计第二轮：深度态遍历（帖子页深态/设置九分类/rail 面板/搜索/飞书皮肤回归）
import base64
import json
import os
import time
import urllib.request

import websocket

CDP = 'http://127.0.0.1:9222'
OUT = 'docs/screenshots/audit/r2'


def targets():
    with urllib.request.urlopen(f'{CDP}/json') as r:
        return json.load(r)


ws = None
c = None
root_sid = None


def reconnect():
    global ws, c, root_sid
    try:
        ws.close()
    except Exception:
        pass
    ws = websocket.create_connection(find_main_ws(), timeout=70, suppress_origin=True)
    c.ws = ws
    c.mid = 0
    root_sid = c.cmd('Target.attachToTarget', {'targetId': [t for t in targets() if 'file:' in t['url']][0]['id'], 'flatten': True})['sessionId']


def find_main_ws():
    for t in targets():
        if t.get('type') == 'page' and 'file:' in t.get('url', ''):
            return t['webSocketDebuggerUrl']
    raise SystemExit('no main window')


class C:
    def __init__(self, url):
        self.ws = None
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


ws = None
c = C(None)
reconnect()


def ev(expr):
    r = c.cmd('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True}, root_sid)
    return r.get('result', {}).get('value')


def shot(name):
    path = f'{OUT}/{name}.png'
    try:
        r = c.cmd('Page.captureScreenshot', {'format': 'png'}, root_sid)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))
        return True
    except Exception as e:
        print(f'  shot fail {name}: {type(e).__name__}', flush=True)
        reconnect()
        return False


def audit_dom():
    expr = """(() => {
      const probs = []
      const vw = document.documentElement.clientWidth
      if (document.documentElement.scrollWidth > vw + 2) probs.push(`h-overflow vw=${vw} sw=${document.documentElement.scrollWidth}`)
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el)
        if ((cs.overflowY === 'hidden' || cs.overflow === 'hidden') && el.scrollHeight > el.clientHeight + 6 && el.clientHeight > 12 && el.clientHeight < 400) {
          const txt = (el.innerText || '').trim().slice(0, 20)
          if (txt) probs.push(`clip .${String(el.className).slice(0,30)} ch=${el.clientHeight} sh=${el.scrollHeight} "${txt}"`)
        }
      })
      return probs.slice(0, 8)
    })()"""
    return ev(expr) or []


def go(name, setup):
    print(f'-- {name}', flush=True)
    try:
        setup()
        time.sleep(2.2)
        probs = audit_dom()
        ok = shot(name)
        tag = 'OK' if not probs else f'{len(probs)} 问题'
        print(f'   {tag}', flush=True)
        if probs:
            for p in probs:
                print('   !', p, flush=True)
            with open(f'{OUT}/issues.txt', 'a', encoding='utf-8') as f:
                f.write(f'[{name}] ' + ' | '.join(probs) + '\n')
    except Exception as e:
        print(f'   FAIL {type(e).__name__}: {str(e)[:60]}', flush=True)
        reconnect()


os.makedirs(OUT, exist_ok=True)
if os.path.exists(f'{OUT}/issues.txt'):
    os.remove(f'{OUT}/issues.txt')

ev('window.resizeTo(1400, 940)')
time.sleep(0.8)

# ===== 帖子页深度态 =====
def open_topic():
    ev("window.location.hash = '#/'")
    time.sleep(1.2)
    ev("(()=>{const a=document.querySelector('a[href*=\"/t/\"]');const m2=a&&a.getAttribute('href').match(/(\\d+)/);if(m2)window.location.hash='#/t/'+m2[1]})()")

go('topic-base', open_topic)

def toggle_thread():
    ev("(()=>{const b=Array.from(document.querySelectorAll('.ldd-fold')).find(x=>x.textContent.includes('回复'));if(b)b.click()})()")
go('topic-thread', toggle_thread)

def open_reply():
    ev("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='回复')?.click()")
go('topic-replybox', open_reply)

def close_reply_open_lom():
    ev("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='取消')?.click()")
    ev("(()=>{const b=Array.from(document.querySelectorAll('.ldd-fold')).find(x=>x.textContent.includes('回复'));if(b)b.click()})()")
go('topic-lom-only', close_reply_open_lom)

# ===== 设置九分类 =====
def settings_nav(label):
    def fn():
        ev("window.location.hash = '#/settings'")
        time.sleep(1.0)
        ev(f"Array.from(document.querySelectorAll('.settings-nav button')).find(b=>b.textContent.trim()==='{label}')?.click()")
    return fn

for label in ['阅读', '通知', '网络', '翻译', '同步', 'AI 接口', '快捷键', '日志', '关于']:
    go(f'settings-{label}', settings_nav(label))

# ===== rail 面板开态 =====
def open_fav_panel():
    ev("window.location.hash = '#/'")
    time.sleep(1.0)
    ev("document.querySelector('.fav-wrap .rail-item')?.click()")
go('rail-fav-open', open_fav_panel)

def open_queue_panel():
    ev("document.querySelector('.fav-wrap .rail-item')?.click()")
    time.sleep(0.3)
    ev("document.querySelector('.queue-wrap .rail-item')?.click()")
go('rail-queue-open', open_queue_panel)

# ===== 搜索态 =====
def search_flow():
    ev("document.querySelector('.queue-wrap .rail-item')?.click()")
    ev("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))")
    time.sleep(0.4)
    ev("""(() => { const i = document.querySelector('.rail-search input'); if (i) { i.value = 'ech'; i.dispatchEvent(new Event('input', { bubbles: true })); } })()""")
go('search-results', search_flow)

# ===== 飞书皮肤回归 =====
def theme_feishu():
    ev("window.location.hash = '#/settings'")
    time.sleep(1.2)
    ev("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='飞书 IM 风')?.scrollIntoView()")
    ev("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='应用')?.click()")
go('theme-feishu-home', theme_feishu)

def theme_feishu_topic():
    ev("window.location.hash = '#/'")
    time.sleep(1.0)
    ev("(()=>{const a=document.querySelector('a[href*=\"/t/\"]');const m2=a&&a.getAttribute('href').match(/(\\d+)/);if(m2)window.location.hash='#/t/'+m2[1]})()")
go('theme-feishu-topic', theme_feishu_topic)

def theme_back_default():
    ev("window.location.hash = '#/settings'")
    time.sleep(1.2)
    ev("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='默认' && b.closest('.theme-row, [class*=theme]'))?.click()")
    ev("Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='应用')[0]?.click()")
go('theme-default-home', theme_back_default)

print('\nDONE. 截图:', OUT, '| issues.txt 汇总问题')
