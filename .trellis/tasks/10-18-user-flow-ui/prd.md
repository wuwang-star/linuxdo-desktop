# 用户身份流 UI：头像悬浮卡 / 个人主页 / 评论聚焦

## Goal

三条身份与评论互动流落地：① 头像悬浮卡替代点击弹窗（方案 A，用户 2026-10-18 拍板，授权后续按推荐项执行）；② `/u/:username` 个人页信息架构升级（banner 头卡 + 8 统计 + 主题/回复 tab）；③ 回复关系可视化（「回复 #pn」跳父楼 + 高亮）。要求完成度足够高。

## Decisions（已拍板，详见 design.md）

- D1 方案 A：hover 400ms 出轻量卡（可移入、滚动/Esc/路由即隐、数据 60s 缓存+inflight 去重），点击头像直达 /u；modal 弹卡（UserCard.vue）删除。触点五处统一：列表行头像/@用户名、楼内作者头像/@用户名、rail 自身头像、cooked 引用楼头像、cooked @mention。
- D2 个人页：banner（card_background 有则用图，无则渐变兜底）+ 头像叠压 + 8 项统计（主题/发帖/获赞/送出赞/访问天数/阅读帖数/进入主题/书签）+「主题/回复」tab；回复流新端点 `/user_actions.json?filter=5`（IPC 四点），失败降级文案。
- D3 回复关系：楼层「回复 #pn」点击 → jumpTo 父楼 + flashPost 高亮 1.6s（store.flashPn）；树形折叠既有不动。

## Background（已核实）

- 原 UserCard modal：`components/UserCard.vue`（已删）经 `utils/userCard.ts` openUserCard 触发，触点 HomeView/PostItem/RailNav。
- cooked 内链拦截在 TopicView `onCookedClick`（capture），/u/ 原落系统浏览器；本次前置拦截 /u/（相对或 linux.do 域名）应用内路由。
- `DiscoursePost.reply_to_post_number` 字段已有；PostItem「回复 #pn」条已有（emit jump→go→jumpTo），缺高亮反馈。
- 并行会话外框架改造（RailNav 常驻/顶栏删除）已同步适配：App.vue 挂载点、RailNav 头像触点随方案 A 更新。

## Acceptance Criteria

- [ ] AC1 列表行头像/@用户名、楼内头像/@用户名、rail 头像 hover 约 0.4s 出轻量卡（头像/名/TL/STAFF/title/bio 两行/3 统计/最近一贴/查看主页），指针移入卡不消失；点击直达 /u 页
- [ ] AC2 正文引用楼头像与 @mention hover 出卡；其链接点击在应用内进 /u（不落系统浏览器）
- [ ] AC3 滚动/Esc/路由切换即时收卡；同用户重复 hover 60s 内不重复发请求（缓存）
- [ ] AC4 个人页：banner 头卡（card_background 或渐变）+ 8 项统计 + 主题/回复 tab；回复 tab 出真实回复流（标题链到楼层 pn、excerpt、时间），请求失败显示降级文案不炸页
- [ ] AC5 楼层「回复 #pn」点击 → 定位父楼且父楼高亮 1.6s
- [ ] AC6 `npm run typecheck` + `npm run smoke` 通过

## Out of Scope

- 关注/私信/屏蔽等账号操作（Discourse 用户 API 权限受限）；编辑资料
- 回复流翻页（拉一页 30 条内）；badge 徽章墙
- user_actions 匿名/字段形态的真机核验遗留为验收项（失败路径已降级）

## Notes

- 交互形态与端点形态的残留不确定性（user_actions 403/字段）由 AC4 降级路径兜底，不阻塞交付。
