# 队列入藏 v1.0

## Goal

docs/roadmap.md M1 拍板：队列出 v1.0 scope（价值未验收、社区维护负担）。以 `QUEUE_ENABLED` 开关隐藏全部入口，代码保留，回归改一行。

## Requirements

- R1 `stores/queue.ts` 导出 `QUEUE_ENABLED = false`（注释挂 roadmap 出处与回归方式）。
- R2 RailNav 队列按钮+QueuePanel 挂载点 `v-if="QUEUE_ENABLED"`。
- R3 HomeView 列表行入队钮 `v-if="QUEUE_ENABLED"`。
- R4 内部管线不动（store / 快捷键 nextTopic / QueuePanel / 主题样式）。

## Acceptance Criteria

- [x] AC1 界面无队列入口（rail 无队列项、列表行无入队钮）——代码级保证（v-if false），真机复核随 M1 验收债
- [x] AC2 typecheck + build 通过
- [x] AC3 回归成本 = `QUEUE_ENABLED` 改 true 一行

## Out of Scope

- 删除 store/QueuePanel/快捷键代码（roadmap 明确保留）
