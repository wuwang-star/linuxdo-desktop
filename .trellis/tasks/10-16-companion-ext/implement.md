# 执行计划：伴生扩展桥接

## 顺序清单

1. [ ] settings.ts：`bridgeEnabled`（默认 false，Boolean 归一）+ `bridgePairCode`（首次 get 时若空且开关开则生成 6 位数字持久化；`regenBridgePair()`）；原子写盘复用 writeConfigFile。
2. [ ] bridge.ts：接收口（127.0.0.1:17366，POST /ingest，配对码校验 → setTCookieManually；401/404 分支；OPTIONS 预检；不回显 cookie）。
3. [ ] ipc.ts + preload 两件：`bridge:getStatus`（enabled/pairCode/listening/lastPush）/`bridge:setEnabled`/`bridge:regenPair`。
4. [ ] LoginView 方式二卡片：桥接行（switch 开关 + 配对码展示 + 重新生成 + 最近推送结果），开关即 start/stop。
5. [ ] extension/：manifest.json + background.js（onChanged 自动推 + popup 手动推）+ popup.html/js + README.md（Edge 加载步骤）。
6. [ ] README/SPEC 补记（扩展桥接节 + 端口 17366）。
7. [ ] 验证：typecheck 0 错 + smoke；手工 AC1–AC4（需真实 Edge + linux.do 登录态，留人工）。

每步后 `pnpm run typecheck`。

## 验证命令

- `pnpm run typecheck` / `pnpm run smoke`
- 手工：开桥接 → Edge 加载 extension/ → popup 填配对码 → 登录 linux.do → AC1；改错码 → AC2；关开关 → AC3；重新生成 → AC4。

## 风险文件与回滚点

- bridge.ts 端口被占用：错误透出到 UI，不阻塞应用其余功能。
- 扩展与本桥接口协议（字段名/端口）需一致——同一 commit 内交付。
