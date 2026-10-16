# 批 1 UI 打磨（设置页收口 / Top 榜交互 / 入队按钮）

## Goal

集中处理用户 2026-10-16 三处 UI 反馈：设置页正文宽高与控件风格突兀；Top 榜周期子档出现逻辑与位置突兀；入队按钮直白中文文案。纯前端 + 一个类型扩展，无新端点。

## Background

- 出处：用户本轮对话逐条反馈（roadmap 既有 UI 打磨范畴；设置中心任务 AC6 tokens 化视觉的延续）。
- 现状：`.settings-page` 锁 860px 居中，大窗下成窄条且高度不撑满；按钮三类规格不一（primary 实心 / 普通灰底 / 工坊行 12px 小钮），input/select 圆角字号跳。Top 周期子 chips 插在 crumb 第一行，点 Top 才现身、把「离线/分类」挤跳位，从属关系不明。入队按钮显示「＋ 入队 / ✓ 已入队」全文案。
- 交互先例：分类选择 = chip + 浮层面板（cat-panel）；Top 周期是同构交互（模式 + 参数），照抄该模式。
- 端点：client.ts 注释已核实 Discourse top.json 全支持 daily/quarterly/yearly，仅 UI 未放开。

## Requirements

- **R1 Top 榜**：`TopPeriod` 扩为 `daily/weekly/monthly/quarterly/yearly/all` 六档；Top chip 改 `Top ▾` 下拉（复用 cat-panel），点开浮层选周期，选中后 chip 显示 `Top · 本周 ▾`；子档不再插入 crumb 行，消除布局跳动；与「分类」浮层互斥（开一个关另一个）。
- **R2 入队按钮**：列表与主题页入队按钮改 icon-only（`＋` / `✓`）+ `title` 悬停提示 + aria-label；队列空态文案同步改。
- **R3 设置页收口**：`.settings-page` 放宽至 1040px、min-height 撑满；input/select/按钮统一 13px 字号 + `--radius-sm` 圆角 + 一致 padding；普通按钮补 hover（accent 描边）；工坊行小按钮并入同一规格。
- **R4 帖子排版（用户中途追加）**：图片下方 Discourse lightbox 自带 `.meta`（文件名/尺寸）无样式裸渲染占位巨大——隐藏 meta 块只留图本体；正文段/列表/楼间距按阅读排版惯例（对齐 Typora/GitHub 渲染惯例，非引入编辑器）用 tokens 规范化，不动 --reading-* 既有偏好。

## Acceptance Criteria

- [ ] **AC1** Top chip 点击出浮层（六档、当前档✓），选「日榜」列表切换且 crumb 行无跳动；chip 文案 `Top · 日榜 ▾`；再点分类浮层时 Top 浮层关闭。（代码落地：六档 TopPeriod + chip-wrap 浮层互斥；渲染待人工）
- [ ] **AC2** 列表/主题页入队按钮为 ＋/✓ 图标，悬停有提示，点击行为与之前一致。（代码落地：icon + title/aria；待人工）
- [ ] **AC3** 设置页大窗不再窄条悬空；各分类下 input/select/按钮规格一致无跳脱感。（代码落地：1040px + min-height + 控件统一规格/hover；待人工）
- [ ] **AC4** 帖子内图片下方无文件名大块占位；正文段距/列表间距/楼间距紧凑规整。（代码落地：lightbox meta 隐藏 + p/li/h 间距规整；排版效果待人工）
- [x] **AC5** `pnpm run typecheck` 0 错误；`pnpm run smoke` SMOKE_OK。（2026-10-16 实测通过；构建曾被并发编辑打断一次，复跑通过）

## Out of Scope

- 用户卡弹窗 / 个人详情页 / 图片灯箱（批 2 另立任务）
- Top 榜数据口径问题（站端行为，只透传 period）
