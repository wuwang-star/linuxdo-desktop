# LinuxDo 桌面客户端 P1：互动写操作、通知与翻译

## Goal

CSRF 基建+回复/点赞/收藏写操作（主进程 form-encoded）；通知（session/current 轮询未读徽标+通知列表+原生 toast）；翻译（OpenAI 兼容端点设置+楼内双语显示）。MessageBus/Reactions 延后：需抓包核实。

## Requirements

- 回复：composer 走原站 API（form-encoded + CSRF），支持指定楼层回复，成功后追加新楼并跳转。
- 点赞/取消点赞：actions_summary(id=2) 状态渲染，乐观更新失败回滚。
- 收藏：主题页收藏按钮（仅添加）。
- 通知：列表页（/notifications.json）+ 顶栏未读徽标（session/current 轮询）+ 原生 toast。
- 翻译：OpenAI 兼容端点设置（baseUrl/model/key，safeStorage），楼层按需翻译显示双语。
- MessageBus 实时通知：转入任务 10-15-p1-wrapup。
- Reactions/Boost/Voting 站点私有端点：延后，另立任务。

## Acceptance Criteria

- [x] 回复/点赞/收藏/通知列表/翻译已交付（typecheck 0 错误、build 通过，2026-10-15）
- [ ] MessageBus / Reactions 未交付（按上节去向跟踪）

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
