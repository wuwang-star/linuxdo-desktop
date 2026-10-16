# Design — DoH 真实现（本地 DoH 代理解析）

## 架构与边界

新增 `src/main/api/dohProxy.ts`（分区 A 主进程数据层，主会话责任区），纯 Node `http.Server`，无新依赖。

```
Chromium（renderer + net.fetch，共享 defaultSession）
   │  session.defaultSession.setProxy({ proxyRules: '127.0.0.1:<port>',
   │                                    bypassList: 'localhost;127.0.0.1;<local>' })
   ▼
dohProxy（127.0.0.1 随机端口，只处理 CONNECT）
   │ CONNECT host:port
   ├─ resolve(host) ── 缓存命中？── 是 ──┐
   │        否                            │
   │   DoH 查询（Node fetch 直连，不经 session）│
   │   失败：secure=断开 / auto=dns.lookup 回退 │
   ▼                                      ▼
  net.connect(ip, port) ── 200 Connection Established ── 双向 pipe
```

TLS 由 Chromium 端到端完成，代理只做解析+TCP 隧道，不见明文。

## 关键决策

1. **CONNECT-only**：应用流量全 https，明文 http 仅 localhost（已被 bypassList 排除）。不实现普通 GET 转发。
2. **DoH 查询绕开自身代理**：用 Node 侧全局 fetch（undici，默认无 env 代理、不经 defaultSession）直连模板地址。模板为域名时 undici 走 `dns.lookup`＝系统解析，**bootstrap 隐式完成**，无需手工解析 DoH 服务器 IP（FluxDO 同思路）。
3. **DNS 报文**：手工构 12 字节 header + QNAME + QTYPE=A（无 A 回退 AAAA），解析 answer 取首条 A/AAAA。~60 行，不引 dns2 之类依赖。
4. **缓存**：`Map<host, {ips, expires}>`，TTL 取 DoH answer TTL（钳 60s–10min）；auto 回退结果短 TTL 2min（FluxDO 行为）。上限 500 条，超限淘汰过期项。
5. **即时生效**：`settings:setDoh` 保存成功后同步启停代理并 `setProxy`；`app.whenReady` 时 enabled 则启动。删除「重启生效」约束。
6. **开关接线保留**：`index.ts:28-32` Chromium 命令行开关原样保留（备上游支持），与本实现无耦合。
7. **错误隔离**：CONNECT handler 内全捕获，失败只销毁当前 socket；server 监听 error 事件不抛主进程。代理挂死的影响面=该次连接失败，auto 模式可回退。
8. **诊断语义**：`diag:resolveDns` 走 `resolveHost`（defaultSession resolver）→ 代理启用时实测经代理链路，IPC 契约不变。

## 数据流与契约

- 模块出口：`startDohProxy(cfg): Promise<number>`（返回端口）、`stopDohProxy(): Promise<void>`、`applyDohRuntime(): Promise<void>`（读 getDohConfig 启停+setProxy，供 ready 与保存两处调用）。
- IPC `settings:setDoh`（`ipc.ts:132`）保存后追加 `applyDohRuntime()`；`index.ts` ready 后调用一次。preload/`index.d.ts` 契约零改动。
- renderer 仅改 SettingsView 文案（横幅、说明、auto/secure 描述），逻辑与布局不动（分区 F 设置页只动 DoH 卡片文案行）。

## 兼容与回滚

- `DohConfig` 三字段、syncdata bundle schema、默认值（enabled=false）全不动；默认关闭路径行为与现状一致。
- 回滚＝revert 单提交；新文件独立，改动点集中 index.ts/ipc.ts 各几行。

## 已知天花板（ponytail 记录）

- `ponytail:` 代理不串联系统代理（Clash）——开启 DoH 后应用流量直连；需要分流时升级为 PAC 或上游链。
- `ponytail:` 无按域名黑白名单——DoH 对所有出站域名生效（含 WebDAV/翻译上游），均为收益方向，暂不做开关。
