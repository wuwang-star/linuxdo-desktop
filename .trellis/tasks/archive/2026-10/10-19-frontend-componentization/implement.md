# implement — 前端组件化 P1+P2

复杂任务轻 design：设计决策已并入 prd.md R1-R4（纯结构迁移，无视觉/逻辑变化空间）。执行顺序：

1. **P1a**：`layouts/AppShell.vue` 建档，App.vue 模板原样迁入（含 page-fade Transition、win-btns、UserCard）；App.vue script 的启动逻辑不动，模板替换为 `<AppShell />`。样式仍走全局 shell.css（P3 才 scoped）。
2. **P1b**：`layouts/PageShell.vue`（title prop + actions slot + 112px 安全区 + 滚动容器）；NotificationsView 接入（其 .notif-page padding/head 结构迁入 PageShell 槽位，类名保持）。
3. **P2a**：`components/FieldRow.vue`（props label/desc + slot）→ SettingsView 全部 field-row 行替换。
4. **P2b**：`components/SegGroup.vue`（options/modelValue/update）→ SettingsView seg 组替换（主题模式等）。
5. **P2c**：`components/QueuePanel.vue`（queue store 自取）→ RailNav 浮层段替换为挂载点。

## 验证

```bash
npm run typecheck && npm run build
grep -c "field-row" src/renderer/src/views/SettingsView.vue   # 模板中应降为 0（组件内部保留类名）
```
类名存活：.queue-panel / .field-row / .seg 全部保留（组件内）。

## 回滚

单提交 revert。
