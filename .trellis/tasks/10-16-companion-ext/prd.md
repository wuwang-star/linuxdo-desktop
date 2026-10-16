# 伴生扩展桥接：Edge 自动同步 _t 登录态（方案 C）

## Goal

用户在系统浏览器（Edge）登录 linux.do 后，其登录态（`_t` cookie）自动同步进应用，免去内嵌窗口二次登录/手动复制——「Edge 登录一次，应用自动跟随」。

## Background（已确认事实）

- 系统浏览器 cookie 沙箱化，应用无法直接读取——伴生 MV3 扩展是唯一合规桥（用户 2026-10-16 明确选方案 C）。
- 应用已有 `_t` 注入通道：`auth:setTCookie` IPC（LoginView 方式二），桥接收到 cookie 后走同一函数，行为一致。
- connect.ts 已有本地回环服务器先例（17365）；桥接口用独立端口 17366 避免冲突。
- 用户 Edge 装扩展方式：edge://extensions 开发人员模式 → 加载解压缩扩展。

## Requirements

- **R1 扩展**（`extension/` 目录，MV3，零构建）：读 linux.do 域 `_t` cookie；`cookies.onChanged` 自动推送 + popup 手动「立即推送」；配对码存 `chrome.storage.local`。
- **R2 应用接收口**（`src/main/api/bridge.ts`）：`127.0.0.1:17366` POST `/ingest` `{pairCode, tCookie}`；配对码校验（不符 401）；合法 → 走 `setTCookieManually` 落登录态；仅绑 127.0.0.1。
- **R3 配对码**：6 位数字，首次启用桥接时生成、持久化 settings；UI 可重新生成（旧码立即失效）。
- **R4 开关**：桥接默认关；LoginView 方式二卡片内「Edge 扩展桥接」行：开关（即开即监听，关即停）+ 配对码展示 + 最近推送时间/结果。
- **R5 文档**：extension/README.md（Edge 加载步骤截图级说明）；README/SPEC 补记。

## Acceptance Criteria

- [ ] **AC1** 应用开启桥接 → Edge 加载扩展 → popup 填一次配对码 → Edge 登录 linux.do → 应用 10s 内变为已登录（用户名正确），无需任何手动粘贴。
- [x] **AC2** 配对码错误 → 扩展推送被拒（401），应用登录态不变。（bridge.ts 401 分支静态核实；登录态仅合法码路径才动）
- [x] **AC3** 关闭桥接 → 端口停止监听，推送失败；重新开启恢复。（setBridgeEnabled 开关即 stopBridge/startBridge，stop 即 server.close）
- [x] **AC4** 配对码重新生成后旧码失效。（regenBridgePair 现场生成新码持久化，校验以最新 settings 为准）
- [ ] **AC5** `pnpm run typecheck` 0 错；`pnpm run smoke` SMOKE_OK。

- **R6 安装向导（用户 2026-10-16「做」）**：桥接行加「安装到 Edge（向导）」按钮 → 主进程复制扩展路径到剪贴板 + 拉起 Edge 打开 `edge://extensions`（命令行参数可行，外部协议不行）→ 应用内浮层分步指引（开发人员模式→加载解压缩→粘贴路径）→ 桥接口收到首次推送（既有 5s 轮询）浮层自动变「✅ 安装成功」。打包态扩展目录经 extraResources 进 resources。

- **R7 实测反馈迭代（2026-10-16 用户真机反馈）**：
  - 配对码一键复制按钮；
  - 修 Edge 拉起失败：不再走 `cmd /c start msedge`（静默失败无反馈），改为定位 msedge.exe（常见安装路径 → App Paths 注册表回退）后 spawn 直呼 `edge://extensions`，失败原因透出 UI；
  - 扩展握手：background.js onInstalled/SW 启动时 POST `/ingest-hello {pairCode}`，bridge 记 `extConnectedAt`；向导步骤②「加载解压缩」显示实时「已检测到扩展 ✅」（步骤①开发人员模式无接口，保持指引）；
  - 方式一卡片加「在系统浏览器登录（需扩展桥接）」：shell.openExternal 打开 linux.do/login，依赖桥接自动同步登录态；桥接未开启时置灰提示。

## Out of Scope

- Chrome/Firefox 扩展商店分发（本机加载解压缩即可）
- 除 `_t` 外的其他 cookie/凭据
- 扩展自动更新

## Open Questions

（无）
