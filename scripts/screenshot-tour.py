# 功能页截图巡礼：CDP 连 Electron（--remote-debugging-port=9222），逐路由截图到 docs/screenshots/。
# 前置：应用已关闭（单实例锁）；真实 userData（带登录态）。
# 用法：先 `node_modules/.bin/electron . --remote-debugging-port=9222 &`，再 `python scripts/screenshot-tour.py`
import base64
import json
import sys
import time
import urllib.request

import websocket

CDP = 'http://127.0.0.1:9222'
OUT = 'docs/screenshots'
SETTLE = 2.5  # 每页数据渲染等待（列表/正文请求经代理链，慢网可调大）


def find_page_ws():
    with urllib.request.urlopen(f'{CDP}/json') as r:
        targets = json.load(r)
    pages = [t for t in targets if t.get('type') == 'page' and 'devtools' not in t.get('url', '')]
    if not pages:
        raise SystemExit(f'未找到页面 target：{[t.get("url") for t in targets]}')
    return pages[0]['webSocketDebuggerUrl']


class CDPClient:
    def __init__(self, url):
        # Chromium 拒带 Origin 的 CDP 握手（403），suppress_origin 免 --remote-allow-origins
        self.ws = websocket.create_connection(url, timeout=30, suppress_origin=True)
        self.mid = 0

    def cmd(self, method, **params):
        self.mid += 1
        self.ws.send(json.dumps({'id': self.mid, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == self.mid:
                if 'error' in msg:
                    raise RuntimeError(f'{method}: {msg["error"]}')
                return msg.get('result', {})

    def evaluate(self, expr):
        r = self.cmd('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
        return r.get('result', {}).get('value')

    def shot(self, path):
        r = self.cmd('Page.captureScreenshot', format='png')
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))

    def navigate(self, hash_url, settle=SETTLE):
        self.evaluate(f'location.hash = {json.dumps(hash_url)}')
        time.sleep(settle)


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    ws_url = find_page_ws()
    c = CDPClient(ws_url)
    c.cmd('Page.enable')
    c.cmd('Runtime.enable')

    # 统一窗口尺寸，保证截图可比
    c.evaluate('window.resizeTo(1400, 940)')
    time.sleep(0.5)

    # 首页（最新列表）
    c.navigate('#/')
    c.shot(f'{OUT}/01-home.png')

    # 帖子页（双栏+正文）：从列表抽第一个真实帖链接
    href = c.evaluate(
        "(() => { const a = document.querySelector('.cooked a[href*=\"/t/\"], a[href*=\"/t/\"]');"
        " const m = a ? a.getAttribute('href').match(/\\/t\\/(?:[^/]+\\/)?(\\d+)/) : null;"
        " return m ? m[1] : null })()"
    )
    if href:
        c.navigate(f'#/t/{href}', settle=3.5)  # 正文+楼中楼渲染较慢
        c.shot(f'{OUT}/02-topic.png')
    else:
        print('!! 未抽到帖子链接，跳过 topic 截图', file=sys.stderr)

    # 通知
    c.navigate('#/notifications')
    c.shot(f'{OUT}/03-notifications.png')

    # 个人页（用当前登录用户名）
    user = c.evaluate(
        "document.querySelector('.rail-user, [class*=username]')?.textContent?.trim().replace(/^@/, '') || ''"
    )
    if user:
        c.navigate(f'#/u/{user}')
        c.shot(f'{OUT}/04-user.png')
    else:
        print('!! 未取到用户名，跳过 user 截图', file=sys.stderr)

    # 登录页（登录态下也照常渲染各登录方式卡片）
    c.navigate('#/login')
    c.shot(f'{OUT}/05-login.png')

    # 设置页
    c.navigate('#/settings')
    c.shot(f'{OUT}/06-settings.png')

    print('DONE:', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
