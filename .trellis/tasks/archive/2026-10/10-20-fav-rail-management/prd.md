# 收藏夹管理闭环到 rail

## Goal

修复收藏夹流程断裂：查看入口在 rail、管理中心却藏在帖子页。拍板方案 A——rail 面板升级为完整管理中心，管理动作闭环在侧栏完成。

## 拍板记录（grill 三问）

1. 管理中心 = rail 面板内联（方案 A）；TopicView 只留勾选入/出夹 + 新建夹，删夹/重命名从帖子页移除
2. 删夹确认 = 行内二次确认（复用 TopicView 现有「删除「XX」？[删除][取消]」交互，不弹系统框）
3. 列表行内移出本夹 = 无确认直接移出（移出≠删帖，站点书签两套并行）

## Requirements

- R1 RailNav fav 面板升级：夹行 = 点名筛选 + 重命名（行内输入，enter/esc/blur）+ 删除（行内确认，默认夹无此钮）；底部新建输入框；点夹 = switchMode + 回首页（已有）
- R2 TopicView fav 菜单精简：保留勾选入/出夹 + 新建夹；移除重命名/删夹 UI 及其状态（favRenaming/favConfirmDelete 等）
- R3 HomeView 收藏夹模式列表行内加「移出本夹」小钮：调 `fav.setTopic(当前夹, id, null, false)`，无确认；行随 store 消失
- R4 默认夹保护：默认夹不可删（removeFolder 已拒）；rail/TopicView 的默认夹行均不显示管理钮

## Acceptance Criteria

- [ ] AC1 rail 面板可新建/重命名/删除夹，操作即时生效且 localStorage 持久化；删默认夹无入口
- [ ] AC2 删夹走行内确认；确认后夹消失，其内帖子若不在其他夹则快照清理
- [ ] AC3 收藏夹模式列表行内「移出本夹」点击后行消失、rail 面板计数减一
- [ ] AC4 TopicView 勾选入/出夹 + 新建夹照常工作
- [ ] AC5 typecheck + build 通过

## Out of Scope

- 云同步逻辑（store 动作复用，exportData/applyRemote 链路不动）
- 拖拽排序、多选批量移动

## 任务形态

Lightweight：PRD-only，本会话内联实现。
