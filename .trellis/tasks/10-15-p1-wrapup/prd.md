# P1 收尾：实时通知、多主题队列、帖子编辑

## Goal

完成 roadmap P1 剩余三项能力，同时还清仓库/文档债。用户价值：① 通知实时到达，不再等手动刷新；② 多主题连续阅读不丢队列；③ 自己发的楼层发现错漏可就地修改。

## Background（已确认事实）

- 现状：P0 全部与 P1 大部（回复/点赞/收藏/通知列表/翻译/Connect 登录）已实现；`pnpm run typecheck` 通过（2026-10-15 实测 exit 0）。
- 通知目前仅 `notifications:list`（session/current）拉取，无推送通道（src/main/ipc.ts:70）。
- 登录主通道为 cookie 会话（嵌入式浏览器过 CF）；user-api-key 被站点禁用、代码保留（specs/linuxdo-desktop/SPEC.md 决策 5）。
- MessageBus 协议已调研（github.com/discourse/message_bus）：`POST /message-bus/<client-id>/poll`，表单 body 携带各订阅频道 last_seen_id，服务端长轮询约 30s，响应 JSON 数组（channel/message_id/data/global_id），message_id 按频道连续、可断点续传。频道名（预期 `/notification/<user_id>`）与分块编码细节须实现首包实测校验（SPEC 不变量：端点先抓包核实）。
- 队列交互用户已定稿（2026-10-15）：手动入队 + 顺序读。
- 已确认债务：`src/renderer/out-verify/`（编译产物）已入库；旧任务 `10-15-linuxdo-desktop-p0`、`10-15-linuxdo-desktop-p1` 功能完成但未归档，旧 p1 prd 验收标准为 TBD。

## Requirements

- **R1 实时通知**：主进程 MessageBus 长轮询订阅用户通知频道；收到消息经 IPC 推送 renderer 更新徽标/toast；长轮询断开自动重连；实时不可用时（未 cookie 登录、连续失败）回退现有手动轮询。
- **R2 多主题队列**：列表行与主题页均可入队/移除；队列非空时主题页提供"上一贴/下一贴"顺序导航（按入队顺序）；支持移除单项与清空；队列本地持久化、重启保留。
- **R3 帖子编辑**：仅本人楼层（以 API 返回 `can_edit` 为准）显示编辑入口；加载原文 raw 预填编辑器；提交 `PUT /posts/{id}.json` 后就地更新楼层内容；失败保留原文并提示。
- **R4 清理与归档**：删除 `src/renderer/out-verify/` 并加 .gitignore；旧 p0/p1 任务补齐验收证据后归档；SPEC 补记 MessageBus 实测结论与编辑端点。

## Acceptance Criteria

- [ ] **AC1** cookie 登录后，站内产生新通知 30s 内徽标/toast 更新，无需手动刷新；网络中断恢复后长轮询自动续上；实时通道不可用时通知列表仍可手动刷新（回退轮询）。（代码已交付：MessageBus 长轮询 + 推送订阅 + 回退；**频道名/请求编码/响应形态未经登录态实测，待人工验收**）
- [ ] **AC2** 列表行与主题页均可入队；入队 ≥2 个主题后，主题页"上一贴/下一贴"按入队顺序切换；移除单项与清空生效；重启应用后队列保留。（代码已交付；**交互与重启持久化待人工验收**）
- [ ] **AC3** 本人楼层可见"编辑"、非本人楼层不可见；编辑保存后楼层内容即时更新；保存失败时显示错误且原内容不变。（代码已交付：can_edit 条件渲染 + raw 预填 + 就地更新/失败保留原文；**待登录态人工验收**）
- [x] **AC4** `pnpm run typecheck` 0 错误；`pnpm run smoke` 输出 SMOKE_OK；`git status` 不再出现 `src/renderer/out-verify/`。（2026-10-15 实测：typecheck exit 0、SMOKE_OK、out-verify 已 rm --cached + 物理删除 + .gitignore）
- [x] **AC5** 旧 p0/p1 任务归档完成；specs/linuxdo-desktop/SPEC.md 记录 MessageBus 实测结论与编辑端点。（归档至 .trellis/tasks/archive/2026-10/；SPEC 追加"P1 收尾实测与端点记录"节）

## Out of Scope

- Reactions/Boost/Voting 等站点私有端点（仍需抓包，另立任务）
- P2 全部：离线 Topic、WebDAV 同步、托盘/全局快捷键、打包自动更新、macOS 签名
- 多选批量入队、自动收集队列（交互已定稿为手动入队）
- Linux 平台、移动端

## Open Questions

（无）
