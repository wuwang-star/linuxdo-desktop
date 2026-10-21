# 前端组件化 P1+P2

## Goal

结构重构：布局壳组件化（P1）+ 高频控件提取（P2）。**纯结构重构、零行为变化**——DOM 结构与渲染结果不变（类名保持），typecheck/build/视觉三不变。

## Requirements

- R1 **P1 布局组件化**：
  - 新建 `src/renderer/src/layouts/AppShell.vue`：App.vue 模板整体迁入（RailNav + shell-main 路由出口含 page-fade Transition + win-btns + UserCard）；App.vue 保留全部启动逻辑（prefs/theme/MessageBus/watchers），模板缩为一个 `<AppShell />`。
  - 新建 `src/renderer/src/layouts/PageShell.vue`：整宽页通用页壳——props `{ title: string }` + 具名 slot `actions`（右上动作，自带 112px 安全区）+ 默认 slot；自带页面 padding/滚动。NotificationsView 接入；SettingsView/UserProfile/Login 结构特殊，**不强迁**（P3 再说）。
  - 样式归属：壳层相关规则随迁（shell.css 的 .app-shell/.shell-main 等保留全局——P3 scoped 化不做，本批只搬结构）。
- R2 **P2 控件提取**：
  - `components/FieldRow.vue`：设置页「label+desc 左 / 控件右」行——props `{ label, desc? }` + 默认 slot 控件；SettingsView 全部 field-row 替换（预计 ~20 处）。
  - `components/SegGroup.vue`：分段单选——props `{ options: {value,label}[], modelValue }` + emit update；SettingsView 主题模式等 seg 组替换。
  - `components/QueuePanel.vue`：RailNav 内队列浮层整体迁出（含 h4/items/移除/清空），直接用 queue store，开关由父控。
- R3 类名保持：迁移后 DOM 类名与现有一致（皮肤 .queue-panel 钩子、样式依赖不破）。
- R4 零逻辑改动：不碰 IPC/store/业务函数；组件化=模板+props 接线。

## Acceptance Criteria

- [ ] AC1 App.vue 模板 ≤5 行（只含 AppShell）；壳层结构在 layouts/AppShell.vue。
- [ ] AC2 SettingsView 行数显著下降（≥120 行）；FieldRow/SegGroup 可复用。
- [ ] AC3 QueuePanel 独立组件，RailNav 模板只留挂载点；.queue-panel 类名存活。
- [ ] AC4 NotificationsView 用 PageShell，视觉零变化。
- [ ] AC5 `npm run typecheck` + `npm run build` 通过；HMR 后各页视觉/交互与重构前一致（用户真机抽查）。

## Out of Scope

- P3 scoped 化（部位 CSS 迁 SFC）——独立后续
- SettingsView/TopicView 深度拆分（本批只做控件提取级别的瘦身体）
- 任何行为/视觉变化

## Constraints

- coordination.md 登记；皮肤类名存活；遵循 ui-spec-calibration 的 token 体系（新组件用现有全局类/tokens，不引入新样式体系）。
