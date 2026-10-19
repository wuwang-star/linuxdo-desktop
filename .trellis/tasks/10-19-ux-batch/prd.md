# 体验批次：Q弹动效 / 阅读回传 / 等级进度

## Goal

用户 2026-10-19 点名三项体验补课：① 应用缺「Q 弹」动效；② 配置页 UI 设计待 v2（下轮，先欠账）；③ linux.do 子系统/TL 升级条件展示、当前进度、**在应用里阅读是否计入升级记录**。

## 已核实事实

- **升级记录真相**：days_visited（当日有登录请求）/topics_entered（打开主题）服务端已计；**posts_read 依赖 `/topics/timings` 回传**（网页版持续上报阅读毫秒数），应用从未实现 → 在应用读帖不计入已读帖数，影响 TL 升级。本批修复。
- CSRF/写通道已有（writeRequest 表单编码 + X-CSRF-Token），`timings[楼层]=毫秒` 键直接兼容。
- 动效现状：仅 page-fade 透明度过渡（shell.css），无弹性曲线/无按压反馈；shell 会话已建 --motion-fast/--ease-out 令牌。
- linux.do 子系统：connect.linux.do（OAuth 已接）；show/learn 等子域同 CF 域名——ECH 网关按域名通查 DoH，同 zone 域名天然可访问（无应用层功能则只是可达）。
- TL 阈值：Discourse 默认 TL1（进 5 主题/读 100 帖）TL2（访问 15 天/送赞 1/获赞 1/进 20 主题/读 100 帖/回 3 主题…）；**linux.do 自定义阈值不暴露 API**，展示用默认值并标注「参考值，以官方公告为准」。

## Requirements

- R1 Q弹动效：tokens 增弹性曲线；页面切换改为 scale+fade 弹入；按钮/卡片按压与悬停微弹（@scope 追加，不动他人规则）
- R2 阅读回传：TopicView 打开且非离线时，IntersectionObserver 记可见楼层，5s 节流 POST /topics/timings（topic_id/timings/topic_time），路由切换/关闭时终flush；离线模式不回传
- R3 等级进度卡：个人页展示 counters（访问天数/阅读帖数/进入主题/送出赞/获赞）对 TL1/TL2 参考阈值的进度条 + 「参考值」免责；UserSummary 补 time_read 可选字段

## Acceptance Criteria

- [ ] AC1 页面切换/按钮按压有弹性动效（目测），暗色/主题工坊皮肤不破
- [ ] AC2 应用内读帖数分钟后，个人页 posts_read 增长（真机对照网页版数值）
- [ ] AC3 等级进度卡显示各项 x/目标 与进度条；离线/未登录不炸
- [ ] AC4 typecheck + smoke 通过

## Out of Scope

- 配置页 UI v2（下轮专项）
- TL3 滚动窗口计算（服务端不暴露）
