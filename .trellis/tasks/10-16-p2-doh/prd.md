# DoH 加密 DNS 解析（直连可达性）

## Goal

linux.do 位于 Cloudflare，部分网络环境存在 DNS 污染/SNI 干扰导致直连不稳。应用内置 DoH（DNS over HTTPS）解析提升直连可达性；Cloudflare 域名的 HTTPS 记录附带 ECH（SNI 加密）收益。参考 FluxDO 的 DOH 行为（其为 Rust 侧代理；本项目用 Chromium 原生能力自研实现，不复用代码）。

## Background（已确认事实）

- 网络层全部在主进程 `net` 模块 = Chromium 网络栈，原生支持 DoH 命令行开关：`appendSwitch('enable-features', 'DnsOverHttps')` + `dns-over-https-mode`（secure/auto）+ `dns-over-https-templates`（可多个 URL）。**启动时生效，运行期不可变**（Chromium 限制，Electron 无热切换 API）。
- Electron 44.7.2（新 Chromium 内核；M117+ 在 DoH secure 模式下具备 ECH 支持路径）。
- linux.do = Cloudflare（SPEC 风险节），ECH 由 Cloudflare 支持。
- 设置基建已有：`src/main/api/settings.ts`（translate 配置 JSON 落盘 + 密钥 safeStorage）+ renderer 设置区（`LoginView.vue:25/99` 走 settings IPC）。
- 诊断基建已有：client.ts `pushDiag`（100 条环形）+ `diag:list` IPC。

## Requirements

- **R1 启动开关**：主进程在 `app.whenReady` 前，按持久化设置 appendSwitch。默认：enabled=true、mode=secure、template=`https://1.1.1.1/dns-query`。
- **R2 设置项**：DoH 开关、模式（secure/auto）、解析器模板（预设：Cloudflare `https://1.1.1.1/dns-query`、Google `https://dns.google/dns-query`、阿里 `https://dns.alidns.com/dns-query` + 自定义输入）。明文 JSON 落盘（无敏感数据，沿用 settings.ts 模式）。改动**重启生效**，UI 明示。
- **R3 诊断与验证**：设置区「测试解析」按钮 → `session.defaultSession.resolveDNS('linux.do')` 展示解析结果；diag 面板继续透出请求成败。
- **R4 降级**：mode=auto 供 secure 失效环境使用（DoH 优先、系统 DNS 兜底）；关闭 DoH 时行为与现状完全一致（零开关）。

## Acceptance Criteria

- [ ] **AC1** 设置页可开关 DoH、切换模式、选/填模板，保存后持久化，UI 标注「下次启动生效」。
- [ ] **AC2** 重启后设置生效（resolveDNS 测试结果 + 实际访问 linux.do 成功佐证）；DoH 关闭时与现状一致。
- [ ] **AC3** dev 模式与安装版均生效（命令行开关不受打包影响）。
- [ ] **AC4** `pnpm run typecheck` 0 错误；`pnpm run smoke` 输出 SMOKE_OK。

## Out of Scope

- HTTP/SOCKS 代理支持（独立任务，有需求另立）
- ECH 显式开关/状态展示（Chromium 内部行为，不暴露 UI）
- 系统级/全局 DoH（只管本应用流量——SPEC 边界：主进程统一出口）
- 运行时热切换（Chromium 限制，重启生效）

## Open Questions

（无。默认解析器与模式均为可调默认值，使用中可改。）
