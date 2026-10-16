// 探针：验证 Electron net.fetch 是否支持非常规 HTTP method（PROPFIND/MKCOL，WebDAV 必需）。
// 方法：主进程内起本地 http server 回显请求 method，再用 net.fetch 以各 method 打它，比对。
// 运行：npx electron .trellis/tasks/10-16-webdav-sync/research/webdav-method-probe.mjs
import { app, net } from 'electron'
import { createServer } from 'node:http'

const seen = []

app.whenReady().then(async () => {
  const server = createServer((req, res) => {
    seen.push(req.method)
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(`echo:${req.method}:depth=${req.headers.depth ?? '-'}`)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port

  async function probe(method, headers) {
    try {
      const res = await net.fetch(`http://127.0.0.1:${port}/probe`, {
        method,
        headers,
        signal: AbortSignal.timeout(10_000)
      })
      const text = await res.text()
      return `status=${res.status} body=${text}`
    } catch (e) {
      return `THROW ${e instanceof Error ? e.message : String(e)}`
    }
  }

  console.log('GET      ', await probe('GET'))
  console.log('PUT      ', await probe('PUT', { 'Content-Type': 'application/json' }, ))
  console.log('PROPFIND ', await probe('PROPFIND', { Depth: '0' }))
  console.log('MKCOL    ', await probe('MKCOL'))
  console.log('seen-by-server:', JSON.stringify(seen))
  server.close()
  app.exit(0)
})
