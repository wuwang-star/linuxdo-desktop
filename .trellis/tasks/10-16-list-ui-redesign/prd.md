# 帖子列表 UI 重设计（行内容/工具条/下拉）

## Goal

按三方案设计稿（悬浮行/卡片流/紧凑密排，visualize 轮播）落地「悬浮行」方案：行去分隔线改 hover 浮起、emoji 图标换内联 SVG、时间右对齐、入队幽灵按钮、下拉浮层统一单列带标题；顺带把飞书主题覆盖到新组件（用户中途指示「飞书主题 UI 继续精进」）。

## Background

- 出处：用户 2026-10-16「左侧帖子列表的内容和按钮 下拉菜单的展示 UI 重新设计一下 可以调用skill」+「飞书主题ui 继续 精进」。
- 设计稿：`.zcode` 会话可视化目录 topic-list-redesign.html（三方案轮播，用户可选改）。推荐「悬浮行」：最接近飞书/FluxDO 列表密度，hover 反馈清晰，改动面最小（无边框线依赖）。
- 现状问题：行 border-bottom 生硬、emoji 图标（💬❤📄）跨平台渲染不一致、meta 项松散、末回复者小头像添乱、cat-panel 420px 双列过重、Top/分类浮层风格不统一。

## Requirements

- **R1 行重设计**：去 border-bottom，hover 浮起（panel 底+圆角+浅影）；标题行 = 徽标（pin/lock SVG）+ 标题 + 入队幽灵按钮（26px，＋/✓ SVG，title 提示）；meta 行 = @作者 + SVG 计数（回复/赞）+ 时间右对齐；去掉末回复者小头像。
- **R2 工具条**：chips 改轻量态（透明底，hover accent-weak，active accent 实底白字，仅作用于 .crumb 不波及顶栏）；「分类」chip 靠右带边框 ghost。
- **R3 下拉统一**：cat-panel 改单列 260px + 面板标题「选择分类」+ 当前分类 ✓；top-panel 同构 220px「Top 榜周期」；浮层圆角/阴影 tokens 化。
- **R4 飞书主题精进**：feishu.ts 覆盖新组件——chips/act 圆角矩形化（--radius-sm）、浮层 popover 质感（radius-sm + 柔影）、列表行 hover 用 --bg 与白面板区分、浮层 item hover 同步、工具条底色跟面板。
- **R5 工具条吸顶（用户中途追加）**：`.list-toolbar` sticky 置顶，负 margin 满宽，列表行从其下滚过。

## Acceptance Criteria

- [ ] **AC1** 列表行 hover 浮起、SVG 图标清晰、时间右对齐、入队按钮悬停有提示、工具条吸顶；暗色下同样成立。（代码落地；渲染待人工）
- [ ] **AC2** Top/分类下拉开合正常、单列带面板标题、当前项 ✓、互相排斥；chips active 态实底可辨。（代码落地；待人工）
- [ ] **AC3** 切飞书主题后：chips 矩形化、浮层 popover 质感、行 hover 灰、与默认主题明显区分。（代码落地；待人工）
- [x] **AC4** `pnpm run typecheck` 0 错误；`pnpm run smoke` SMOKE_OK。（2026-10-16 实测通过）

## Out of Scope

- 卡片流/紧凑密排两方案（设计稿备选，用户点名即切，结构同源改动小）
- 用户卡/详情页/灯箱（批 2）
