# 执行计划：双栏主从

1. [ ] stores/browse.ts（selectedId/offlineFlag/select/route 归一）。
2. [ ] TopicView 参数化（topicId/offline props，route 兜底）。
3. [ ] HomeView 加 pane prop（列表点击走 browse.select；按钮/工具栏行为不变）。
4. [ ] BrowseView 骨架 + 路由改造（/ 与 /t/:id → BrowseView）+ matchMedia dual 响应。
5. [ ] styles.css browse/list-pane/reader-pane/empty。
6. [ ] README/SPEC 补记；typecheck（每步）+ smoke；prd 勾 AC5，AC1–AC4 留人工。
