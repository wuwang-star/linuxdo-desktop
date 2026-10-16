# 批 2 附属页面（用户卡/个人详情/图片灯箱）

## Goal

补齐阅读动线的附属能力：点头像/用户名出**用户卡**浮层（摘要+跳详情）；**个人详情页** /u/:username（资料+统计+最近主题）；帖子图片**灯箱**（放大 + Esc/遮罩/按钮回退）。参考 ALDR（用户观察/灯箱行为）与 Discourse 标准端点。

## Background

- 出处：用户 2026-10-16「任务头像、个人详情 等等附属二级页面开发呢？弹窗呢？图片放大问题？放大回退问题？」+ 本轮「开工」。
- 端点：`/u/{username}.json` 与 `/u/{username}/summary.json` 为 Discourse 核心端点（社区版默认开）；响应结构实现时以实际返回为准，诊断面板可见 404。
- 弹层先例：`.overlay`（遮罩+卡片）已用于安装向导，用户卡/灯箱复用。
- 信任边界同帖内 cooked：bio_cooked 为站点成品 HTML，v-html 渲染，与现有 .cooked 同级风险。

## Requirements

- **R1 用户卡**：utils/userCard.ts 全局单例状态 + UserCard.vue（App.vue 挂载一次）；列表头像/列表 @作者/帖子头像/@作者 点击打开；内容 = 大头像 + username/name/title/信任级 + bio + 统计四格（话题/发帖/获赞/访问天数）+ 「查看主页」；Esc/遮罩/关闭钮回退。
- **R2 个人详情页**：路由 `/u/:username` → UserProfileView：资料头卡（头像/名/title/bio/加入时间/信任级）+ 统计行 + 最近主题列表（summary.topics 前 10，链接进阅读）。
- **R3 图片灯箱**：TopicView 对 `.cooked img` 委托点击开灯箱（贴 scroller 单监听，树形/离线同覆盖）；默认适屏，点图切换原始尺寸（可滚动），Esc/遮罩/关闭钮回退；翻页不需要（MVP 单图）。
- **R4 列表样式切换（并入列表任务）**：prefs 增 `listStyle: 'float'|'card'|'compact'`（默认 float），`data-list-style` 上 documentElement；设置→阅读增分段控件；CSS 三态变体对齐设计稿。

## Acceptance Criteria

- [ ] **AC1** 列表/帖子头像与 @作者 点击出用户卡，四格统计正确，「查看主页」进详情页；Esc/遮罩可关。（代码落地；待人工）
- [ ] **AC2** `/u/:username` 直达详情页，资料/统计/最近主题渲染，最近主题可点进阅读。（代码落地；端点返回待真机）
- [ ] **AC3** 帖子图片点击放大，点图切原始尺寸，Esc/遮罩/关闭钮均可回退；离线快照同样生效。（代码落地；待人工）
- [ ] **AC4** 设置→阅读切换 悬浮/卡片/紧凑 即时生效并持久化。（代码落地；待人工）
- [x] **AC5** `pnpm run typecheck` 0 错误；`pnpm run smoke` SMOKE_OK。（2026-10-16 实测通过）

## Out of Scope

- 用户卡徽章/完整主页 tab（活动/私信等）
- 灯箱多图翻页、缩放手势
