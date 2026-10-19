# ECH 直连引擎（Go 网关 + MITM）

## Goal

根治 SNI 阻断：本地 Go sidecar 作为「支持 ECH 的自研 HTTP 引擎」，让应用在**不开 Clash、只配 DoH** 的条件下完整访问 linux.do（接口/图片/WebSocket 全流量）。

用户 2026-10-19 拍板方向；同日原型实验证实技术可行（见 Background）。

## Background（实验证据，2026-10-19 本机实测）

- Go 1.26 原型（`.ech-probe`，已验证后清理）：DoH（edge.1molchuan.top）查 A 记录 + HTTPS RR（type 65）→ 取 71 字节 ECHConfigList → `crypto/tls.EncryptedClientHelloConfigList` 发起握手：
  - 明文 SNI：`FAIL forcibly closed (124ms)`（复现 GFW RST）
  - **ECH：`OK TLS 1.3 (185ms) ECHAccepted=true`**——GFW 在此线路放行 ECH
- FluxDO 源码定性（zread）：其 DOH Proxy Service 即「circumvents SNI-based censorship」的根基——Rust rhttp 引擎自带 DNS override + ECH config；我们与它的差距不在 DoH，在「TLS 由谁发起」。
- Electron 侧约束（既有核实）：CONNECT 隧道端到端加密、代理无法注入 ECH；Chromium 原生支持 ECH 但走隧道时不自解析拿不到 HTTPS RR；内置 DoH 被网络服务硬编码关；Node OpenSSL 无 ECH → **纯进程内无解，必须 sidecar**。

## Architecture（design.md 详）

Chromium → session.setProxy(CONNECT 本地网关) → **Go 网关在本环回终结 TLS（MITM，本地 CA）** → 以 ECH 出站到真实目标。覆盖矩阵：主进程 API / renderer 图片头像 / MessageBus wss 全部经同一链路；cookie/origin 因 MITM 保 Host 语义零变化。

## Requirements

- R1 Go 网关：DoH 查询（A + HTTPS RR，消费应用既有模板配置）、ECH 拨号池、SNI 预读 MITM、回环绑定 + 随机端口、stdout 上报端口
- R2 本地 CA：首次运行生成（userData 下，OSDP 加密可选）、`setCertificateVerifyProc` 仅本应用 session 信任、不进系统证书库
- R3 Electron 集成：sidecar 生命周期（启动/崩溃重启/退出回收）、健康检查、网络设置新档位「ECH 直连」（与上游代理/系统/关闭并列，互斥生效）
- R4 全流量覆盖验证：API JSON、正文图片/头像、MessageBus wss、Cloudflare 挑战页
- R5 打包：Windows 单文件 sidecar（~10MB）入 extraResources；构建脚本接 Go 工具链
- R6 回退：ECH 直连失败（ECHAccepted=false / RST）自动降级到「上游代理」档并在诊断面板可见

## Acceptance Criteria（P2 集成后终验，P1 原型验收另列）

- [ ] AC1 关闭 Clash、DoH+ECH 直连档开启：列表/帖子/图片/实时通知全部可用
- [ ] AC2 诊断面板显示链路「ECH 直连」且实测 ECHAccepted=true
- [ ] AC3 上游代理档与 ECH 档切换即时生效，失败自动降级有提示
- [ ] AC4 本地 CA 仅存在于应用 userData 与本应用 session 信任，卸载无残留
- [ ] AC5 typecheck + smoke + 打包产物含 sidecar

## Out of Scope

- macOS/Linux sidecar 交叉编译（后续任务）
- 非 linux.do 域的 ECH 白名单策略（默认全域名走 ECH，HTTPS RR 无 ech 则普通直连）
- SOCKS/系统级代理共享

## Risks

- **ECH 军备竞赛**：GFW 未来可能针对性 RST CF ECH（今日此线路实测放行）；R6 降级为兜底
- MITM 实现复杂度高（证书/WS/HTTP2）；分 P1 原型先行验证再全量投入
- 体积 +10MB；Go 工具链进构建链
