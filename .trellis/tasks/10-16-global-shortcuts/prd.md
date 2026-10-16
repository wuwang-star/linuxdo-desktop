# 全局快捷键

## Goal

应用最小化/失焦时仍可用系统级快捷键呼出主窗与切换队列阅读——P2b 父任务第三子项（roadmap「托盘/全局快捷键」余项）。

## Requirements

- R1 呼出主窗：`Alt+Shift+L`（默认**开**）→ 复用 win.ts focusMainWindow。
- R2 队列下一贴：`Alt+Shift+N`（默认**关**，全局组合易与系统冲突）→ 队列 store 下一贴（无下一贴忽略）；需主进程能驱动 renderer 队列（IPC 或 webContents.send → renderer 执行既有 next 逻辑）。
- R3 设置中心新「快捷键」分类：两个 switch + 组合键展示 + 注册失败错误行（被占用等），互不影响。
- R4 开关持久化 settings（沿用 bridge 字段模式），启动按配置注册；关闭即 unregister。

## Acceptance Criteria

- [ ] AC1 应用最小化时按 Alt+Shift+L → 主窗恢复聚焦。
- [ ] AC2 队列下一贴开关联活，触发切到队列下一主题，无下一贴无副作用。
- [ ] AC3 注册失败显示错误且不影响另一开关。
- [x] AC4 typecheck 0 错 + smoke SMOKE_OK。

## Out of Scope

- 自定义组合键录制、更多动作绑定
