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
- 本任务交付：设置基建（`settings.ts`：默认 enabled=false、mode=secure、template=Cloudflare；模板必须 `https://` 合法 URL，规范化为 href、含空白拒绝，非法静默回退默认；`dohEnabled` 布尔归一防脏数据；配置原子写盘——临时文件 + rename，防半截 JSON 毁掉同文件 translate 配置）+ `diag:resolveDns` 诊断按钮（`resolveHost('linux.do')`，Electron 44 已移除 resolveDNS，用替代 API）。UI 顶部明示「实验功能：暂未生效」。
- 真实现路径（另立任务）：本地 DoH 代理 + `host-resolver-rules` 映射，或上游 Electron 消费浏览器层开关后直接复用现有接线。届时 mode 语义：secure=仅加密解析（失败即断）；auto=加密优先、失败回退系统 DNS（DoH 域被墙环境切 auto）。
