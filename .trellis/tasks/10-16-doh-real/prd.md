# DoH 真实现（本地 DoH 代理解析）

## Goal

把「实验·暂未生效」的 DoH 设置做成真解析：主进程起本地 HTTP CONNECT 代理，目标域名经 DoH 上游解析后直连，secure/auto 语义落地，设置保存即时生效。

用户价值：linux.do 位于 Cloudflare，DNS 污染网络下系统解析拿到假 IP 直连失败；DoH 加密解析绕过污染恢复直连可达性。此为 coordination.md 挂账的「DoH 真实现立项」。

## Background（已核实事实）

- `specs/linuxdo-desktop/SPEC.md:53`：源码级核实 `dns-over-https-mode/templates` 是 Chrome 浏览器层开关，Electron v44 `system_network_context_manager.cc` 硬编码 `SecureDnsMode::kOff` 不消费；`src/main/index.ts:28-32` 现有开关接线为空转，DNS 实际走系统解析。SPEC 已写明真实现路径＝本地代理。
- 配置层全通可复用：`src/main/api/settings.ts`（DohConfig 持久化/校验/默认值 edge.1molchuan.top）、`SettingsView.vue:212-260,620-688`（UI + 诊断按钮）、`syncdata.ts`（WebDAV bundle 含 doh 三字段）、IPC `settings:getDoh/setDoh` + `diag:resolveDns`（`ipc.ts:131-147`，resolveHost 走 defaultSession resolver）。
- 覆盖面核实：renderer 页面请求与全部主进程 API（client/connect/webdav/messagebus/translate/probe）都走 `net.fetch` 且共享 defaultSession（`client.ts:72,86`）——`session.defaultSession.setProxy()` 一处设置全覆盖，无需逐模块改造。
- secure/auto 语义 SPEC 已定义：secure=仅加密解析（失败即断）；auto=加密优先、失败回退系统 DNS。
- 参考项目 FluxDO（github.com/Lingyan000/fluxdo，GPL-3.0 只参考行为不抄代码）：Rust 本地代理网关（流量指到 127.0.0.1:port、保留原 Host）+ 独立 DoH resolver 兜底；DoH 服务器自身域名先经系统 DNS bootstrap；DoH 失败回退系统解析并用更短缓存 TTL。本项目用 Node http server + session.setProxy 等价实现。
- Electron 侧技术约束：Chromium DNS 开关死路（见上）；`host-resolver-rules` 仅启动期静态映射、无运行时 DNS hook API；`session.setProxy` 支持运行时切换（免重启）；CONNECT 隧道 TLS 由 Chromium 端到端完成。

## Requirements

- R1 启用 DoH 时，主进程在 127.0.0.1 起本地 HTTP 代理（随机空闲端口），处理 CONNECT：解析目标域名后建立 TCP 隧道。`session.defaultSession.setProxy({ proxyRules: '127.0.0.1:<port>', bypassList: 'localhost;127.0.0.1;<local>' })`；禁用时还原 `setProxy({ mode: 'system' })`。
- R2 域名解析走 DoH 上游（RFC 8484，GET `<template>?dns=<base64url wireformat>`）。DoH 查询必须绕开本代理自身（用 Node 侧直连 fetch，不经 defaultSession），防递归。解析结果缓存，TTL 取响应或固定值。
- R3 bootstrap：DoH 模板自身为域名时，经系统 DNS 解析（Node dns 层）并缓存；IP 字面量模板（1.1.1.1）跳过。
- R4 模式语义：secure＝DoH 失败即断开连接；auto＝DoH 失败回退系统解析（Node dns.lookup，短 TTL 缓存）。
- R5 即时生效：设置保存后运行时切换代理，删除「改动重启生效」限制；UI 移除「实验功能：暂未生效」横幅并更新说明文案（含「开启后应用流量不走系统代理」提示）。
- R6 诊断按钮（测试解析 linux.do）实测经代理链路的真实解析结果；`diag:resolveDns` 保持现有 IPC 契约。
- R7 现有 `src/main/index.ts:28-32` Chromium 开关接线保留不动（备上游支持），但不再是本功能依赖。

## Acceptance Criteria

- [ ] AC1 开启 secure 后，DNS 污染环境（或 hosts 屏蔽验证法）下应用可加载 linux.do 列表与帖子（真机）
- [ ] AC2 诊断按钮开启前后返回不同结果：关闭=污染/系统 IP，开启=DoH 上游真实 IP
- [ ] AC3 auto 模式下 DoH 上游不可达（自定义模板指向不可用地址）应用仍可正常使用（回退生效）
- [ ] AC4 关闭 DoH 后解析还原系统路径；WebDAV/Connect/翻译等主进程请求行为不变
- [ ] AC5 保存设置免重启即生效；本机回环（bridge 17365/17366、localhost）不走代理
- [ ] AC6 `npm run typecheck` 通过；smoke 构建通过

## Out of Scope

- ECH/SNI 加密：CONNECT 隧道下无 HTTPS RR 注入路径（Chromium 自行终结 TLS），不承诺
- 与系统代理（Clash 等）串联：开启 DoH 后应用流量改走本地直连，二者互斥，UI 文档说明即可
- SOCKS5 上游、PAC、分域名规则表：YAGNI，需要时另立任务

## Open Questions

- 无（阻塞级）。已知取舍：本地代理为进程内单点，随主进程生命周期；secure 模式断网即断应用属设计语义。

## Risks

- 本地代理异常会拖垮全部应用流量：socket 级错误隔离 + auto 模式回退缓解；崩溃路径限于主进程内 Node http server（无原生依赖）。
- 用户同时跑系统代理（Clash）时开启 DoH 会使应用绕开 Clash 直连——文案明示。
