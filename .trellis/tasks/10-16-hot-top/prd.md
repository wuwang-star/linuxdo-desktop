# 列表通道扩展：最热与 Top 榜

## Goal

列表增加「最热」与「Top」两个原站通道。**排行榜（gamification 用户积分榜）经实测 `/leaderboard.json` 返回 not_found，非原站功能**（用户所见排行榜来自第三方增强工具 LDStatus Pro 的自有服务）——明确排除并记 SPEC。

## Background（已确认事实，2026-10-16 Edge 实测抓包）

- `/hot.json?no_definitions=true&page=0` 200 ✅：响应与 latest.json 同构（`topic_list.filter:"hot"`、`topics[]`、`users[]`、`more_topics_url:"/hot?page=1"` 分页、额外 `top_tags`）。
- `/leaderboard.json` → `{"errors":["找不到请求的 URL 或资源。"],"error_type":"not_found"}` ❌。
- `/top.json?period=...` 为 Discourse 核心端点（period: daily/weekly/monthly/quarterly/yearly/all），响应同构（未单独实测，核心风险低，实现后真机验证）。

## Requirements

- R1 client.ts：`fetchHot(page)`、`fetchTop(period, page)`（复用 latest 解析，`more_topics_url` 支持 hot/top 分页）。
- R2 HomeView chips：最新 / 最热 / Top / 离线（Top 选中时出现周期子选：周/月/全部，默认周）。
- R3 双栏左栏与窄屏整页行为一致；队列/离线等功能不受影响。

## Acceptance Criteria

- [ ] AC1 「最热」chip 拉取 hot 列表并可分页（more_topics_url）。（留人工：需登录态/网络）
- [ ] AC2 「Top」chip 默认周榜，可切月/全部并可分页。（留人工：需登录态/网络）
- [x] AC3 最新/离线既有行为不变。（静态可证：store latest/category/offline 分支与离线渲染模板零改动）
- [x] AC4 typecheck 0 错 + smoke SMOKE_OK。（2026-10-16 实测通过）

## Out of Scope

- gamification 排行榜（原站无此端点，实测 not_found）
- Top 多 period 并存展示、top_tags 展示
