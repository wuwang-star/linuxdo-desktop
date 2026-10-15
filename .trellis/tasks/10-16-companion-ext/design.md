# 技术设计：伴生扩展桥接

## 总览

| 组件 | 位置 | 说明 |
|---|---|---|
| MV3 扩展 | 新增 `extension/`（manifest.json / background.js / popup.html / popup.js / icons 无亦可） | 零构建，Edge 加载解压缩即用 |
| 接收口 | 新增 `src/main/api/bridge.ts` | http server 绑 `127.0.0.1:17366`，POST `/ingest` |
| 设置 | `src/main/api/settings.ts` | `bridgeEnabled`（默认 false）、`bridgePairCode`（首次启用时生成 6 位数字，持久化） |
| IPC/UI | `ipc.ts` + `LoginView.vue` 方式二卡片 | `bridge:getStatus`/`bridge:setEnabled`/`bridge:regenPair`；卡片内桥接行 |

## 扩展（extension/）

- manifest.json：MV3；`permissions: ["cookies", "storage"]`；`host_permissions: ["*://*.linux.do/*", "http://127.0.0.1:17366/*"]`；action popup。
- background.js（service worker）：
  - `cookies.onChanged`（domain 含 linux.do、name=_t）→ 读配对码（chrome.storage.local）→ 有码则 POST `http://127.0.0.1:17366/ingest`；
  - popup「立即推送」走同一函数。
- popup：配对码输入（存 storage）+ 立即推送 + 结果反馈。
- 注意：MV3 SW 会被休眠，onChanged 事件由浏览器唤醒，无常驻需求。

## 接收口（bridge.ts）

- `startBridge()`/`stopBridge()`：server.listen(17366, '127.0.0.1')；应用启动时按 `bridgeEnabled` 决定是否自动 start。
- POST /ingest：校验 `pairCode === settings.bridgePairCode` → `setTCookieManually(tCookie)`（复用 auth.ts 既有通道，含登录态刷新）→ 200 `{ok:true}`；码错 401；非 POST/路径错 404。
- 响应带 CORS 头 `Access-Control-Allow-Origin: *`（扩展 SW 有 host_permissions 本不受 CORS 限制，此头仅为调试便利）；拒绝时也要 OPTIONS 预检处理。
- 安全：仅回环绑定 + 配对码；`_t` 属敏感会话凭据，日志/响应中**绝不回显**。

## 交互流

开桥接 → 显示配对码 → 用户在扩展 popup 填一次（存扩展本地）→ 之后 Edge 侧 `_t` 变化（登录/续期）自动推送 → 应用自动登录态更新。

## 权衡

- 配对码明文存 settings.json：弱凭据仅防本机其他程序误撞，回环绑定已限攻击面；safeStorage 加密反而增加跨启动复杂度。
- 端口固定 17366：扩展 manifest 无法动态配端口（可写死），文档记录；被占用时报错透出 UI。

## 回滚

bridge.ts 不 start 即完全无痕；extension/ 目录独立删除即回退。
