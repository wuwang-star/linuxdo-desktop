# 执行计划：设置中心

## 顺序清单

1. [ ] electron.vite.config.ts renderer `define` 注入 `__APP_VERSION__`（package.json version）；`src/preload/index.d.ts` 或 env.d.ts 补类型声明（按项目现有 d.ts 约定放对位置）。
2. [ ] 新建 `SettingsView.vue`：三分类布局（网络/翻译/关于），从 LoginView 原样搬移 DoH 组与 translate 组逻辑（语义不变），关于组渲染应用名+版本+文档指针。
3. [ ] `router/index.ts` 加 `/settings`（懒加载）；`App.vue` 顶栏加设置入口。
4. [ ] `LoginView.vue` 删除内嵌设置区，保留「设置」入口；确认登录/Connect 授权流代码未被误伤。
5. [ ] `styles.css` 补 `.settings-*` 规则（左导航/面板布局）。
6. [ ] README 能力清单提一行设置中心（可选）；本任务 prd 勾 AC。

每步后 `pnpm run typecheck`；收尾 `pnpm run smoke`。

## 验证命令

- `pnpm run typecheck` / `pnpm run smoke`
- 手工：dev 起 → 未登录直达 /settings → 三分类切换 → DoH 测试解析、翻译保存回填与迁移前行为一致 → LoginView 仅剩登录+入口 → 顶栏入口可达。

## 风险文件与回滚点

- `LoginView.vue`：删除区域边界要准（登录/授权逻辑一根线不动），revert 单 commit 即回退。
- `electron.vite.config.ts`：define 只增不改。

## task.py start 前检查

- [x] implement.jsonl / check.jsonl 真实条目
- [x] prd/design/implement 齐（research.md 在库）
- [x] 用户目标指令批准实现（goal 继续 + 用户明确「参考这俩项目做设置」）
