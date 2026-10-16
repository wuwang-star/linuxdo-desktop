# 搜索功能 UI MVP

## Goal

列表页内嵌搜索态：用户在列表页输入关键词，调 Discourse `/search.json` 展示结果，点击结果打开主题。零自建索引，q 原样透传（操作符免费）。

## Background

- 出处：roadmap 功能清单（`.thinkrail/context/TASK-linuxdo-desktop.md:19`）对标 FluxDO，搜索在列；两参考项目均有搜索模块——FluxDO 独立搜索页 + 过滤面板 + 帖子卡片（`lib/widgets/search/`，`_SearchMixin` 走 `/search.json`），ALDR 有 `search/` 界面模块。本任务只抄「输入 → 结果列表」主干。
- 现状：HomeView 列表工具栏（`.list-toolbar`）有 latest/hot/Top/分类/离线 chips，无搜索入口；全应用无任何搜索。
- 端点：Discourse `/search.json?q=`，返回 `topics`（id/title）+ `posts`（topic_id/blurb/username）+ users/categories/tags，支持 `?page=` 翻页；操作符 `@user` `#分类` `order:latest` `in:title` 等服务端解析，客户端透传即用。
- 端点核实（2026-10-16，Discourse 上游文档 + 匿名探针）：full_page 模式 `?page=` 翻页上限 10 页，第 11 页起空页——UI 侧空页即判 exhausted，非错误；blurb 300 字符；响应 posts/topics/users/categories 旁加载，客户端按 `posts[].topic_id → topics[].id` 关联；linux.do 匿名请求 403，AC2/AC3/AC4 需登录态真机验收。

## Requirements

- **R1 入口**：列表工具栏右端加搜索 icon 按钮，风格与现有 chip 一致；点击进入搜索态（工具栏替换为搜索条），焦点自动入 input；`Ctrl+K` 随时聚焦/进入搜索态。
- **R2 搜索态**：搜索条 = input（placeholder 提示操作符）+ 取消按钮；输入防抖 400ms 触发查询；空输入回到列表。
- **R3 结果列表**：复用现有列表行样式展示——标题 + blurb 摘要 + 分类徽标 + 作者 + 回复/赞数 + 时间；点击行走现有打开主题路径（双栏右栏 / 窄屏整页）。
- **R4 翻页**：结果底部「加载更多」按钮 `?page=` 追加；不做无限滚动。
- **R5 状态**：加载中/加载失败（复用现有「加载失败：原因 + 重试」模式）/空结果三态。

## Acceptance Criteria

- [ ] **AC1** 工具栏出现搜索 icon；点击后工具栏变搜索条且 input 聚焦；Esc 或「取消」回列表态。
- [ ] **AC2** 输入「electron」出结果列表（标题/blurb/分类/作者/数字/时间齐全），点击行打开对应主题（双栏右栏加载）。
- [ ] **AC3** 输入 `@某用户` 或 `order:latest xxx` 服务端操作符生效（透传即可，不解析）。
- [ ] **AC4** 结果 >50 条时「加载更多」追加下一页，不重复不丢失。
- [ ] **AC5** 断网/超时显示「加载失败：原因」+ 重试；无结果显示空态文案。
- [x] **AC6** `pnpm run typecheck` 0 错误；`pnpm run smoke` SMOKE_OK。（2026-10-16 实测通过；与并行会话改动同树验证）

## Out of Scope

- 筛选面板（分类/作者/时间过滤，FluxDO 有）——操作符透传兜底
- 语义搜索、用户/标签搜索下拉、主题内搜索（TopicView）、搜索历史
- 无限滚动、高亮关键词渲染（标题直接展示 Discourse 返回的纯文本即可）
