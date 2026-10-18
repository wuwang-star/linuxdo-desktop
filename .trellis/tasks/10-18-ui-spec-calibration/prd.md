# UI 设计规范全站校准

## Goal

按已拍板的 13 章设计规范（research/ui-design-spec.html，用户 2026-10-18「开始工作吧」拍板）全站校准样式：tokens 重构 + 变量替换 + 逐页对齐。消灭双轨配色与散数，全站一个视觉语言。

## Requirements

- R1 色板单轨：底座 tokens 定为规范 9 槽位（bg/panel/canvas/text/muted/accent/accent-weak/bad + quote-bg），亮暗双态按规范值；`--im-*` 颜色槽位全部删除，全站引用底座变量。旧社区绿 `--accent: #3ecf9a` 退役 → `#3370ff`（暗 #457aff）。
- R2 字阶 token 化：--font-xl 19 / lg 17 / body 15.5(1.6) / md 14 / base 13 / sm 12（下限）；全部 font-size 散数（12 档 ~100 处）替换归档；树形三级 13.5px 作为 --font-md-nested 特例保留。
- R3 间距 tokens：--space-1..5（8/16/24/32/48）全站化（现 --im-space-* 更名），行内 16/卡片 16/组件隙 8 对齐规范。
- R4 圆角五档：--radius-xs 4 / sm 6 / md 8 / lg 10 / pill 999；1/2/3px 微圆角全废。
- R5 阴影三档：--shadow-1/2/3（亮暗两套值），替换现散写 box-shadow。
- R6 z-index 归位：全站只 0/5/10/60/70/80/90 七层，按规范表对齐（现散写 z-index 全部收编）。
- R7 控件五态：按钮（pri/ghost 四态+disabled opacity .4）/输入框（默认/焦点蓝圈/禁用）/开关/勾选/单选/下拉/步进/滑杆按规范校准（base.css 公用控件为主战场）。
- R8 浮层四级：menu/popover/dialog/toast 形态+阴影档+入场动效档按规范（含危险动作红主钮约定，本批只对齐既有浮层形态，不新增对话框功能）。
- R9 反馈态：骨架屏（shimmer≥300ms 才显示可后续）、spinner、空态虚线框、错误条红软底——对齐既有实现的样式壳。
- R10 布局栅格与安全区不变量保持：rail 184/56、中栏 312、内容区 flex、断点 1200、拖拽区三处、112px 窗口钮安全区——校准不得破坏。
- R11 图标三档 20/16/13（.ic 13px 盒基准，rail 层已修 20px 对齐根因），越档使用归一。
- R12 动效维持既有三档+单曲线+reduced-motion 降级（已上线，本批不重复动）。

## Acceptance Criteria

- [ ] AC1 `--im-` 前缀在 src/ 下零残留（颜色槽位删除；结构/间距 token 更名后允许 --space-*/--motion-* 等无 im- 名）。
- [ ] AC2 font-size 散数归档：styles 内仅剩 token 引用 + 规范允许的特例（body 15.5、md-nested 13.5、19/17 标题档）。
- [ ] AC3 border-radius 仅出现 4/6/8/10/999（或 token 引用）。
- [ ] AC4 box-shadow 仅三档 token。
- [ ] AC5 z-index 仅七层值。
- [ ] AC6 亮/暗色切换全站不炸；主题工坊切换皮肤仍生效（皮肤覆盖底座变量的机制不变）。
- [ ] AC7 列表行/楼层/浮层/控件与规范稿视觉一致（用户真机核对）。
- [ ] AC8 `npm run typecheck` + `npm run build` 通过。

## Out of Scope

- 新增功能（对话框/toast 目前无宿主，本批只定规范样式壳与既有浮层对齐）
- SettingsView 阅读偏好项文案调整（独立后续）
- 各分区功能逻辑（本任务零逻辑改动，纯样式）

## Constraints

- 跨全部 styles 部位文件（A-F 区）：coordination.md 已登记为「主会话主导的全站样式校准」；只动 CSS/样式相关模板类名，不动任何功能逻辑与 IPC。
- 底座 tokens.css/base.css 允许本次结构性修改（唯一一次破例，用户拍板单轨化）；改动后仍保持「prefs 基础 → 主题包覆盖」顺序兼容。
- 主题工坊皮肤包（themes/*.ts）引用的类名（.queue-panel 等）必须存活。
