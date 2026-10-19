# Implement — ECH 直连引擎

## Phase 1 — Go 网关原型（本次启动）
1. [ ] `ech-gateway/main.go`：flag(port/template/ca) → MITM TLS server + SNI 预读 + DoH RR 查询 + ECH 拨号 + 状态行
2. [ ] 本地 CA 生成（crypto/x509，运行时签发目标域证书，DNS:目标域 SAN）
3. [ ] standalone 验收：curl --proxy CONNECT 过网关取 https://linux.do/about → 200 且 ECHAccepted=true；Chromium 手动挂网关开站点

## Phase 2 — Electron 集成
4. [ ] sidecar 生命周期（main/api/echGateway.ts）：spawn/端口上报/健康检查/崩溃重启/退出回收
5. [ ] settings.ts NetworkConfig 增档位 `ech`；dohProxy upstream 解析接入 echGateway；降级协议解析
6. [ ] 本地 CA：首次生成存 userData；`setCertificateVerifyProc` 接入 defaultSession
7. [ ] 设置页「ECH 直连」档 + 诊断面板链路显示；IPC 四点
## Phase 3 — 打包与验收
8. [ ] scripts/build-ech-gateway.mjs + electron-builder extraResources
9. [ ] AC1-5 终验 + SPEC/journal

## 验证命令
- Phase1: `go run ./ech-gateway --listen 127.0.0.1:9443 --template <doh>` + curl 代理测试
- 常规: `npm run typecheck && npm run smoke`
