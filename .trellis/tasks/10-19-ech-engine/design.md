# Design — ECH 直连引擎

## 链路

```
Chromium ── CONNECT any:443 ──▶ dohProxy(现有 Node 代理, 127.0.0.1:ephemeral)
                                    │ upstream = ECH 档
                                    ▼
                        Go 网关 127.0.0.1:ephemeral2（sidecar）
                        ├─ 读 CONNECT 目标 SNI
                        ├─ 对内：以本地 CA 签发的目标域证书终结 TLS（MITM）
                        ├─ DoH 查 A + HTTPS RR(type 65) → ECHConfigList（60s 缓存）
                        ├─ ECH 出站（crypto/tls EncryptedClientHelloConfigList）
                        └─ ECH 失败(RST/ECHAccepted=false) → 返回可识别错误 → Node 降级上游代理档
```

两级代理而非一级的原因：Node 无 ECH，Go 不懂 Electron session——Node dohProxy 保留既有接管/契约/降级逻辑，Go 只做「TLS 终结 + ECH 出站」单职责。

## 关键决策

0. **sidecar 语言备选**：P1 用 Go（标准库 crypto/tls 原生 ECH，2026-10-19 原型已实测 ECHAccepted=true）；若 P1 暴露 Go/ECH 问题，P2 前可换 Rust（rustls-ech，FluxDO 同款栈）——网关对外协议（端口上报/MITM/降级状态行）语言无关，Electron 侧零改动。Rust 只是 sidecar 实现备选，不是应用框架语言（Electron 主进程即 Node，不可替换）。

1. **MITM 范围**：仅本应用 defaultSession（`setCertificateVerifyProc` 校验本地 CA 签名即 pass，其余走默认校验）；CA 私钥存 userData（`safeStorage` 加密可选 P2）。不写系统证书库。
2. **DoH 复用**：Go 侧独立实现 RFC 8484 查询（GET ?dns=，与 Node 侧同款模板配置经 argv/stdin 传入），bootstrap 走系统 DNS；模板不可达 → ECH 档整体降级。
3. **降级协议**：Go 网关对每条隧道回结构化状态行（首字节 `JSON`）告知 ECHAccepted/失败原因；Node 侧 secure 模式下 ECH 不可用即断（语义一致），auto 降级上游代理档。
4. **HTTP/2 与 WS**：MITM 后 Chromium 与网关间 ALPN 协商 h2/http1.1（Go tls Server 自动）；出站 Go 按 ALPN h2 转发（net/http2.Transport）；wss 即 CONNECT 隧道同路径，天然覆盖。
5. **sidecar 协议**：`--port 0 --template <doh> --ca <key> --log stdout`；stdout 首行 `{"port":N}`；Electron 侧 spawn/kill + 3s 健康检查（GET /healthz）。
6. **体积与工具链**：Go 交叉编译 `GOOS=windows GOARCH=amd64 -ldflags "-s -w"`≈8MB；CI/本地脚本 `scripts/build-ech-gateway.mjs` 检测 go 环境缺省时跳过并提示（不阻塞无 Go 的构建）。

## P1 原型边界（先行验收）

Go 网关 standalone：`--listen :0` 起 MITM + ECH，手动 curl/浏览器过网关开 linux.do 首页，观察 ECHAccepted=true 与页面 200。不含 Electron 集成。验收过才进 P2（集成 + 设置档 + 降级）。

## 兼容与回滚

- 新档位默认不启用；上游代理/系统/关闭三档行为零变化。
- 回滚＝设置切回上游代理档；sidecar 未启动时 ECH 档不可选（UI 禁用态）。

## 已知天花板（ponytail）

- 非 linux.do 域同样走网关 ECH（HTTPS RR 无 ech 时普通直连，等价现状）；不做分域策略表。
- ECHConfigList 缓存 60s；CF 轮换密钥导致的偶发失败靠重查兜底。
