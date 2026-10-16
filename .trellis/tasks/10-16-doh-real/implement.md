# Implement — DoH 真实现（本地 DoH 代理解析）

## 前置

- [ ] coordination.md 认领登记：主会话动公用文件 `ipc.ts`（settings:setDoh 段追加 applyDohRuntime 调用）、`main/index.ts`（ready 后接线）；新文件 `src/main/api/dohProxy.ts` 属分区 A。

## Checklist（按序）

1. [ ] `src/main/api/dohProxy.ts` 新建：
   - DNS wire-format 构造/解析（header+QNAME+QTYPE=A，回退 AAAA；answer 取首条 A/AAAA + TTL）
   - `resolve(host)`：缓存（TTL 钳 60s–10min，auto 回退 2min，上限 500）
   - DoH 查询：Node 全局 fetch GET `template?dns=<base64url>`，超时 5s
   - http.Server CONNECT 处理：解析→net.connect→pipe；secure 失败断、auto 回退 dns.lookup
   - 出口 `startDohProxy/stopDohProxy/applyDohRuntime`
2. [ ] `src/main/index.ts`：`app.whenReady` 内（现有 ready 逻辑之后）调用 `applyDohRuntime()`（enabled=false 时零副作用）
3. [ ] `src/main/ipc.ts`：`settings:setDoh` handler 保存成功后 `await applyDohRuntime()`（try/catch，写失败不回滚设置）
4. [ ] `SettingsView.vue` DoH 卡片：删「实验功能：暂未生效」横幅；desc 改「即时生效」「开启后应用流量改走本地直连代理（不走系统代理）」；secure/auto 描述对齐实际行为
5. [ ] README/SPEC 状态更新：p2-doh「空转」结论补真实现落地记录（SPEC.md:53-55 段落追加）

## 验证命令

- `npm run typecheck`
- `npm run smoke`（构建 + `--smoke` 冒烟）
- 手工 dev 冒烟：开启 DoH（secure/默认模板）→ 诊断按钮返回非污染 IP → 列表可加载；auto + 坏模板 → 仍可用；关闭 → 还原

## 风险文件与回滚点

- `ipc.ts`/`index.ts` 公用文件：只追加调用行，不动他人区间（铁律）
- 回滚：revert 单提交即回到「实验·未生效」状态（默认 enabled=false，主路径零影响）

## start 前检查

- [ ] prd.md AC1–6 可测；design.md 决策齐；本清单有序
- [ ] 最终规划摘要已过用户批准
