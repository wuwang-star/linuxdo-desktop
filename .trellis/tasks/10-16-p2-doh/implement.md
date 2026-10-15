# 执行计划：DoH

## 顺序清单

1. [ ] `settings.ts`：`StoredConfig` 扩展 doh 三字段（默认值兜底）、`loadDohEarly()`（只读 JSON 不碰 safeStorage）、`getDohConfig/setDohConfig`、模板 URL 校验。
2. [ ] IPC + preload：`settings:getDoh/setDoh`、`diag:resolveDns`，`preload/index.ts` 与 `index.d.ts` 同步。
3. [ ] `main/index.ts`：ready 前 `loadDohEarly()` + 条件 appendSwitch（校验后的模板）。
4. [ ] `LoginView.vue` 设置区 DoH 分组 UI + 测试解析按钮（结果展示成功/失败与地址）。
5. [ ] README/SPEC 补记：DoH 行为与默认值、重启生效、secure/auto 差别与降级指引、resolveDNS 校正结论。
6. [ ] 全量验证。

每步后 `pnpm run typecheck`。

## 验证命令

- `pnpm run typecheck` / `pnpm run smoke`
- 手工：设置页改配置 → 重启 → 测试解析 → 访问 linux.do；关闭 DoH 重启回归现状。

## 风险文件与回滚点

- `src/main/index.ts`：开关接线在启动最早期，错误会全局生效——模板校验 + 默认值兜底必须先于接线完成。
- `settings.ts`：只增不改既有 translate 逻辑。
- resolveDNS 校正点结论若为「不走 DoH」：测试按钮降级为纯诊断展示，DoH 生效性以实际访问为准（AC2 措辞已兼容）。

## task.py start 前检查

- [ ] implement.jsonl / check.jsonl 含真实条目
- [ ] prd/design/implement 齐备
- [ ] 用户批准最终规划摘要
