# 主题工坊（皮肤分享/导入，飞书风打样）

## Goal

应用级主题系统 + 主题工坊：用户可导入/导出/管理主题包（token 覆盖 + 自定义 CSS），一键换肤；内置「飞书 IM 风」主题作为首个样例，验收主题格式表达力。工坊承载机制，软件皮肤（飞书/钉钉/企微/Slack…）作为内容一份份攒，新增皮肤零机制改动。

## Background（出处与参考）

- **roadmap 出处**：用户 2026-10-16 本对话拍板新增方向（roadmap 原无此项）。设置中心任务（10-16-settings-center）R5 外观分类现为「主题系统规划中」占位卡，本任务将其变为真实内容。
- **参考依据**：
  - 用户提供的社区 userscript《Linux DO · 飞书 IM 外观》（czm15053）作为**行为参照**：证明「整应用换肤成办公 IM 风」是真实需求形态。其手法 = CSS 覆写 + JS 造 DOM；本应用是自建 UI，等价物 = token 覆盖 + CSS 主题（JS 部分不导入，见红线）。
  - ALDR：主题/外观/字体偏好域 + 设置导入导出（行为参考）。
  - FluxDO：未查到主题工坊/主题分享（无对应实现，如实记录）。
- **DOM 基础**：BrowseView 已是双栏主从（`.list-pane` + `.reader-pane`），对位飞书「中栏列表 + 右侧会话」；脚本中最左 rail 本身即纯装饰，CSS 可表达。
- **分层先例**：prefs.ts 已确立「主题属 UI 状态 → renderer localStorage + documentElement，不经主进程持久化」；data-theme 单轨亮暗（styles.css）。

## 红线（安全边界）

1. **主题包绝不携带/执行 JS**。格式仅允许声明式数据：一份 `css` 样式文本（含 `:root{}` token 覆盖）。CSS 在 Electron renderer 无法执行脚本，风险上限是样式错乱与远程 `url()` 引用，可接受。
2. **导入即校验**（trust boundary）：format 版本、name/id 字符集与长度、tokens 键值类型、css 尺寸上限，非法整包拒绝。

## Requirements

- **R1 主题格式 v1**：`{ format: 1, id, name, author?, version, css }`。css 文本自足——token 覆盖写在 `:root{}`、亮暗差异写 `:root[data-theme='dark']{}`；应用侧单一注入路径（head 末尾 `<style data-app-theme>`，晚于应用样式同权重覆盖）。不设独立 tokens 字段（规划后简化：单路径免清理，亮暗变体天然支持）。文件扩展名 `.ldtheme.json`。
- **R2 主题系统（renderer utils/themes.ts）**：应用主题 = 注入 css；取消 = 清空该 style 元素。选择持久化 localStorage（`ldd-theme`）；App.vue 启动时应用（异步，主题切换瞬间允许短暂回退默认色，不做首帧缓存）。主题模式（亮/暗/系统）沿用 prefs，独立于工坊主题。
- **R3 主进程（src/main/themes.ts）**：`userData/themes/` 目录存主题包 JSON；IPC `themes:list`（元信息）/`themes:get`（整包）/`themes:import`（系统打开对话框 + 校验落盘）/`themes:exportData`（另存对话框，内置主题同样可导出）/`themes:remove`。原子写沿用 offline.ts 模式。
- **R4 工坊 UI（设置页·外观分类）**：替换占位卡为「主题工坊」卡片：主题列表（默认 + 内置飞书 + 已导入），行内 应用/导出/删除（内置与默认不可删）；「导入主题」按钮；当前主题标识。复用 field-row/card/tip 组件类，不引新依赖。
- **R5 内置飞书风主题**（`assets/themes/feishu.json`）：飞书配色 tokens（#3370FF 主色、浅灰底、白面板）+ CSS（列表行卡片化 hover、圆形头像、左缘装饰 icon rail、亮暗两套）作为格式表达力验收样例。追求「神似」不做像素级复刻；无交互新组件（im/native 切换、头像伪装等明确不做）。
- **R6 主题钩子约定**：主题 CSS 面向应用现有稳定类名（.browse/.list-pane/.reader-pane/.topic-row/.card/.topbar 等）；PRD 记录为契约，格式含 `version` 字段为将来破坏性演进留位（本期不做兼容层）。

## Acceptance Criteria

- [ ] **AC1** 设置→外观→主题工坊可见列表（默认/飞书）；点「飞书风」即时换肤（配色/列表卡片化/装饰 rail），点「默认」完全还原，重启后保持选择。（代码链路已落地：工坊 UI + applyThemeById + localStorage 持久化；换肤效果待人工）
- [ ] **AC2** 导出内置飞书主题得 `.ldtheme.json`；删除本地 `userData/themes` 下某导入主题后列表同步；再导入该文件成功应用。（IPC 链路已落地；对话框操作待人工）
- [x] **AC3** 非法主题包（format 错/超限 css/坏 tokens）导入被拒并有错误提示，不落盘。（validateTheme 断言已进 smoke——合法放行、坏 format/坏 id/超限 css 拒绝；导入路径代码序为先校验后写盘）
- [ ] **AC4** 主题与亮暗模式叠加无布局破坏：默认亮/暗、飞书亮/暗 四态截图人工过目。
- [x] **AC5** `pnpm run typecheck` 0 错误；`pnpm run smoke` SMOKE_OK。（2026-10-16 实测通过，smoke 含 validateTheme 自检）

## Out of Scope

- 主题内声明式交互组件（decor/JS）、im/native 布局切换、头像伪装
- 主题市场/在线分发（文件分享即 MVP）
- 首帧零闪烁（启动异步应用，接受短暂默认色）
- 更多软件皮肤内容（钉钉/企微/Slack…按需后续逐个加）

## Open Questions

（无——范围已在对话中与用户对齐：机制+飞书打样，皮肤内容后续攒）
