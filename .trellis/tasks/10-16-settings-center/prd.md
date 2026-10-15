# 设置中心 UI（参考 FluxDO/ALDR）

## Goal

把散落在 LoginView 的设置区（translate、DoH）与后续将新增的设置项（托盘行为、同步、通知偏好等）收拢为独立设置中心页面。信息架构**参考 FluxDO 与 ALDR 两项目的设置结构**（用户 2026-10-16 明确要求：功能/UI/设置都参考这俩项目）。

## Background（已确认事实）

- 现状：设置内嵌在 `LoginView.vue`（translate 配置 + DoH 分组），随登录页膨胀，不可持续。
- 参考边界（SPEC 决策 6）：FluxDO（GPL-3.0）只参考行为/结构，禁止复制代码；ALDR（MIT）可参考设计。
- 待收拢设置项：translate（settings.ts）、DoH（同文件）、未来：托盘行为（p2a）、通知偏好、同步（P2b）。

## Requirements（初稿，进入规划时细化）

- R1 先做参考调研：抓取 FluxDO / ALDR 仓库的设置页分类与条目（zread/文档级），产出对比笔记存本任务目录。
- R2 依据调研定信息架构（分类、每类条目、哪些不搬），PRD 收敛后再实现。
- R3 独立路由页面（/settings），登录页只留入口；各设置分区读写复用既有 settings IPC。
- R4 布局与交互遵循现有 styles.css 设计语言；桌面端习惯（左分类右内容或顶 tab）。

## Acceptance Criteria

- [ ] TBD（规划收敛后定稿）

## Out of Scope

- 设置项的功能逻辑变更（只做搬运与重组，行为不变）
- 主题/外观系统（如参考项目有，评估后另立）

## Open Questions

- 分类取舍与命名（等 R1 调研结论）
- 是否需要设置导入导出（ALDR 有，MVP 是否搬）
