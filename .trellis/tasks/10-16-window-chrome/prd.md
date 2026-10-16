# 窗口观感：隐藏原生标题栏融合顶栏

## Goal

消除默认原生标题栏与整体设计的不协调（外围边框/标题栏颜色与顶栏割裂）：隐藏原生标题栏，改用系统窗口按钮叠加层（titleBarOverlay）与顶栏同色融合；顶栏本身成为拖拽区。

## Requirements

- R1 `BrowserWindow`：`titleBarStyle:'hidden'` + `titleBarOverlay`（win32），颜色跟随当前主题（亮/暗各配 color+symbolColor），`nativeTheme.on('updated')` 与 prefs 主题切换时经 `win.setTitleBarOverlay()` 同步；高度与顶栏一致。
- R2 顶栏（App.vue .topbar）整体 `-webkit-app-region: drag`，内部可点元素（链接/按钮/chip）`no-drag`；最大化窗口下双击顶栏还原/最大化行为保留（drag 区自带）。
- R3 交互回归：顶栏所有入口（最新/队列/铃/设置/登录）与浮层可用；窗口缩放/贴边（Aero Snap）不受影响。

## Acceptance Criteria

- [ ] AC1 无原生标题栏；窗口按钮叠加在顶栏右端且配色融合（亮/暗一致）。（实现完成，待真机目测）
- [ ] AC2 顶栏可拖动窗口、双击最大化/还原；所有顶栏控件可正常点击。（实现完成，待真机目测）
- [ ] AC3 切换主题（阅读体感）时 overlay 颜色跟随。（实现完成，待真机目测）
- [x] AC4 `pnpm run typecheck` 0 错；`pnpm run smoke` SMOKE_OK。（2026-10-15 实测通过）

## Out of Scope

- 自绘窗口按钮（用系统 overlay）、Linux、多窗口
