---
id: spec-linuxdo-desktop
type: architecture-design
status: active
title: LinuxDo 桌面客户端架构（Electron + Vue 3 自建 UI）
tags: [linuxdo, discourse, electron, vue3, desktop]
---

## 驱动

linux.do（Discourse）的第三方桌面客户端，Windows + macOS。参考 FluxDO（Flutter，GPL-3.0，仅参考行为不复用代码）与 Awesome LinuxDo Reader（MIT，仅参考设计）。MVP 重点：连续阅读工作区、楼中楼/讨论上下文、翻译/离线/同步、桌面壳能力。

## 决策

1. **完全自建 UI + Discourse JSON API**，不做原站套壳；不内嵌 ALDR，全部自研。
2. **Electron**（非 Tauri）：单一 TS 语言栈；Win/mac 同 Chromium 内核；嵌入式登录窗口可与 API 请求共享 cookie jar（CF 兜底）；生态适合新手。代价是体积/内存，可接受。
3. **Vue 3 + Vite + Pinia + TypeScript**；构建链 electron-vite；打包 electron-builder + electron-updater（GitHub Releases）。
4. **网络层在主进程**：所有 linux.do 请求经主进程统一出口（浏览器级 UA、限流退避、诊断），renderer 只经 IPC 消费，避免 renderer 侧 CORS/CF 问题。
5. **登录通道（2026-10-15 实测定稿）**：linux.do 管理员已禁用 Discourse user-api-key 自助申请（`/user_api_key/new` 返回"页面不存在或是不公开"），普通用户无从申请。主通道 = 嵌入式浏览器登录（真实浏览器环境过 CF，`_t` cookie + `flushStore` 落盘，重启保留）；测试通道 = 手动注入 `_t` cookie；user-api-key 完整流程（RSA+nonce+协议回调）保留在代码中以备站点开放或用于其他 Discourse 站点。另调研 linux.do Connect（OIDC）：scopes 仅 openid/profile/email（身份联邦），无论坛 API 权限，不适用于本客户端的会话需求。
6. FluxDO 代码 GPL-3.0：禁止复制；API 端点知识可自由使用。ALDR MIT：亦不复用代码，仅参考设计。

## 不变量

- linux.do 站点私有插件端点（Reactions/Boost/Voting）实现前必须抓包核实，并集中封装在 API 客户端层。
- API 客户端必须内置：浏览器级 UA、429 指数退避、错误诊断信息透出。
- 登录凭据（api key / cookie）只存本机（safeStorage 加密），永不进同步/导出。

## 范围之外

- Linux 平台、移动端（FluxDO 已覆盖移动场景）。
- 原站替代（不镜像 linux.do 内容服务）。
- P2 之后的 VoIP/音视频通话等站内不存在的功能。

## P1 收尾实测与端点记录（2026-10-15）

### MessageBus 实时通知

- 端点：`POST https://linux.do/message-bus/<uuid>/poll`（uuid 每次启动随机），表单体 key=频道名、value=last_seen_id。
- **频道名按 `/notification/<user_id>` 实现，请求编码与响应形态未经登录态实测，待手工验收确认**（本机无登录 cookie；站点公开端点匿名 429）。实现于 `src/main/api/messagebus.ts`：长轮询独立生命周期（不走 client.ts 统一封装，429 退避语义不适用于 30s 挂起请求），我方 65s 超时按空轮询处理；响应解析自适应兼容完整 JSON 数组与流式分块（`/频道\n消息id\njson\n`）两种形态；连续失败 3 次进入回退（renderer 退回 60s 手动轮询，本会话不自动复活，重新登录且切换账号时可重置）。
- last_seen_id 存内存：重启从 0 重拉 backlog；push 仅触发全量 `auth.refresh()`，幂等由服务端状态重算保证；断线重连携带最后 seen id。

### 帖子编辑端点

- 读原文：`GET /posts/{id}.json`（单楼接口含 `raw` 与 `can_edit`；列表/流接口不含 raw）。
- 提交编辑：`PUT /posts/{id}.json`，form-encoded，参数为 Rails 嵌套键 `post[raw]`（`post[edit_reason]` 可空），走既有 CSRF 逻辑。编辑入口仅 `can_edit === true` 时渲染，权限判断以 API 为准。

### 阅读队列

- 纯 renderer 本地状态（Pinia + localStorage 键 `ldd-queue`），不发请求不经 IPC，无敏感数据不入 safeStorage。

### DoH 加密 DNS（P2，2026-10-15；评审后改判「开关无效，暂不生效」）

- **评审结论（源码级核实）**：`dns-over-https-mode`/`dns-over-https-templates` 是 Chrome 浏览器层开关（chrome/common/chrome_switches），Electron 的网络服务不消费——`shell/browser/net/system_network_context_manager.cc` 的 `OnNetworkServiceCreated` 硬编码 `SecureDnsMode::kOff`（v44.0.0 核实）。`src/main/index.ts` 的命令行开关接线为空转（保留以备上游支持），**DNS 实际走系统解析**。
- 本任务交付：设置基建（`settings.ts`：默认 enabled=false、mode=secure、template=`https://edge.1molchuan.top/linuxdo`（用户指定自建端点，2026-10-16 起为默认，旧值 Cloudflare 仍为预设之一）；模板必须 `https://` 合法 URL，规范化为 href、含空白拒绝，非法静默回退默认；`dohEnabled` 布尔归一防脏数据；配置原子写盘——临时文件 + rename，防半截 JSON 毁掉同文件 translate 配置）+ `diag:resolveDns` 诊断按钮（`resolveHost('linux.do')`，Electron 44 已移除 resolveDNS，用替代 API）。UI 顶部明示「实验功能：暂未生效」。
- 真实现路径（另立任务）：本地 DoH 代理 + `host-resolver-rules` 映射，或上游 Electron 消费浏览器层开关后直接复用现有接线。届时 mode 语义：secure=仅加密解析（失败即断）；auto=加密优先、失败回退系统 DNS（DoH 域被墙环境切 auto）。

### P2a 打包分发（2026-10-16）

- **electron-builder 配置**（`electron-builder.yml`）：appId `com.linuxdo.desktop` / productName `LinuxDo Desktop`；`files: out/**`（electron-builder 自动追加 package.json 与生产依赖 node_modules）；asar 开；NSIS oneClick per-user；产物 `dist/LinuxDo Desktop-<ver>-setup.exe` + `win-unpacked/`。
- **依赖归位**：vue/pinia/vue-router 移入 devDependencies（electron-vite 已整体打进 renderer 资产，进 `dependencies` 只会白白进 asar）；运行时依赖仅 `electron-updater`。
- **图标**：`build/icon.png` 512px 占位（圆角靛蓝底+白 L+橙点），由 `build/gen-icon.mjs` 生成——纯 Node 标准库（zlib + 手写 CRC32，2×2 超采样），零依赖；替换 png 重打即可换正式图标。托盘/安装包共用；托盘图标 dev 取 `build/`、打包取 `resources/icon.png`（extraResources），Windows 下 resize 16px。
- **踩坑记录**：`publish: never` 在 electron-builder 26 不是合法值——会去找名为 "never" 的 publisher 模块报 `Cannot find module for publisher "never"`。不想上传就整体省略 publish 键（本地无 GH_TOKEN 时本来就不上传）。
- **自动更新降级链**（`src/main/updater.ts`）：dev 完全不启用；publish 未配置 → 打包产物无 `resources/app-update.yml`（已实测）→ existsSync 守卫直接不初始化；检查/下载失败 logger 关闭 + catch 全静默。启用方式：builder.yml 填 publish owner/repo 重打。行为：启动延迟 30s 单次检查，`update-downloaded` 弹原生通知，点击聚焦，重启即装。
- **托盘与关窗语义**：`appIsQuitting` flag + `before-quit` 置位；点 × → `preventDefault + hide()` 驻留托盘，托盘菜单「退出」才真退。`win.ts focusMainWindow()` 为托盘点击/通知点击/second-instance 三处共用恢复+聚焦。
- **原生通知**（`src/main/notify.ts`）：MessageBus push → 主进程 `Notification`；payload 字段防御式提取（`topic_id`/`post_number`/`data.topic_title`，与频道名同一校正点：未经登录态实测），缺 `topic_id` 降级为点击仅聚焦、不猜字段。点击 → `notification:open` IPC → renderer `router.push('/t/<id>?pn=<n>')`（TopicView ?pn 直达楼层）。
- **协议注册（安装态）**：`index.ts` 的 `process.defaultApp` 分支仅 dev 生效；打包态 `setAsDefaultProtocolClient` 默认参数（`"...\LinuxDo Desktop.exe" "%1"`），NSIS per-user 下预期有效，真机安装验证待人工。
- **风险接受**：Windows 无签名证书，SmartScreen 告警不阻塞自用；macOS 构建签名后置另立任务。发版流程见 README「打包与发版」。
- **待真机人工验收**：双击安装（应用名/图标/SmartScreen）、`linuxdo-desktop://` 回调、托盘交互（×隐藏/恢复/退出）、原生通知点击跳转、AC5 升级链路（repo 就绪后）。

### 伴生扩展桥接（P2，2026-10-16，方案 C 定稿）

- **背景**：系统浏览器 cookie 沙箱化，应用无法直读；linux.do Connect（OIDC）仅身份联邦无论坛会话权限。用户选定方案 C——伴生 MV3 扩展作合规桥：「Edge 登录一次，应用自动跟随」。Chrome 商店分发、`_t` 以外 cookie、扩展自动更新均 Out of Scope。
- **扩展**（仓库根 `extension/`，零构建零依赖）：manifest MV3，permissions `cookies`+`storage`，host_permissions `*://*.linux.do/*` 与 `http://127.0.0.1:17366/*`。`background.js` service worker：`cookies.onChanged`（domain 匹配 `(^|\.)linux\.do$` 且 name=_t、非 removed）→ 1.5s 防抖 → 带配对码 POST /ingest；MV3 SW 可休眠，事件自动唤醒，无常驻需求。popup：配对码输入（存 `chrome.storage.local`，只存码不存 cookie）+ 立即推送（runtime message 走同一函数）+ 结果摘要。
- **接收口**（`src/main/api/bridge.ts`）：`node:http` server 绑 `127.0.0.1:17366`（与 connect.ts 的 17365 回环先例并列，独立端口防冲突）。`POST /ingest`，请求体 `{"pairCode":"123456","tCookie":"..."}`；码错 401、缺字段 400、方法/路径错 404、体超 16KB 413；合法 → `setTCookieManually(tCookie)`（复用 auth.ts 手动粘贴通道，含 flushCookies + loginStatus 刷新）→ 200 `{"ok":true,"username":"..."}`；OPTIONS 预检 204；CORS 头仅为调试便利（扩展有 host_permissions 不受限）。应用启动 `initBridge()` 按持久化开关自动 start（默认关，不 start 零痕）。
- **配对码**：6 位数字（`crypto.randomInt`，保留前导零），首次启用时生成并持久化 translate-settings.json（`bridgeEnabled`/`bridgePairCode`，Boolean 归一，沿用原子写盘；既有 translate/DoH/notification setter 均已改为透传 bridge 字段防覆盖）；UI 可重新生成，旧码立即失效。
- **安全边界**：仅回环绑定 + 弱配对码（防本机其他程序误撞，不做 safeStorage 加密——弱凭据加密反增跨启动复杂度）；`_t` 属敏感会话凭据，扩展与应用两端只在内存转发，响应/日志/chrome.storage 一律不落不回显；端口固定 17366（扩展 manifest 写死），被占用时报错透出 UI 不阻塞应用。
- **IPC 三件**：`bridge:getStatus` / `bridge:setEnabled` / `bridge:regenPair`（返回统一 `BridgeStatus`：enabled/pairCode/listening/lastPushTime/lastPushOk/lastError）；UI 在登录页方式二卡片内（开关 + 等宽配对码 + 重新生成 + 最近推送），renderer 5s 轮询 status、检测到新推送即 `auth.refresh()`。
- **待人工验收**：AC1 全链路（真实 Edge + linux.do 登录态，加载扩展 → 自动同步 10s 内可见）；端口占用场景与打包态行为。
