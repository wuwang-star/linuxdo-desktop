# 冷启动黄金路径

## Goal

北极星「新用户下载即用」的主战场：首启→网络检测→ECH 过盾/降级→登录→第一帖 的全流程产品化，外加使用中故障的诊断面板。交互基准（用户已拍板「流程通了」）：`research/golden-path-mockup.html`，8 屏逐屏对照实现。

## Requirements

- R1 首启门：prefs 加 `onboardingDone`（默认 false）；未完成时 router 导航一律先进 `/welcome` 流程（完成后写 true 放行）；老用户升级后不回访（检测到已有登录 cookie 或 ECH 配置时直接写 true 跳过——判断顺序：cookie 有效 > 配置存在 > 走流程）。
- R2 Welcome 流程壳（`views/WelcomeView.vue`，8 屏状态机按 mockup）：welcome → detect → (shield → connected | fallback) → login（复用既有 LoginView 能力或嵌其核心段）→ 完成=写 onboardingDone + 进主框架。
- R3 三步检测编排：主进程 IPC `net:detect`，逐步上报进度事件（DNS 解析 → ECH 直连测试 → 站点连通），渲染层三步 UI 同步点亮；结论三态：直连 OK / 需过盾（SNI 阻断特征）/ 彻底失败。探测实现复用 dohProxy/ech 既有能力（resolveProxy、diagResolve、ech 探测），不重复造轮子；整体超时 15s。
- R4 ECH 过盾屏：复用既有自动化过盾链路（challenge→重试，30min 冷却），本任务只做**进度可视化屏**（盾 icon + 两步状态 + 「仍然失败→降级指引」出口），不改动过盾机制本身。
- R5 降级指引屏：出路 A（系统代理两步图文+「重新检测」）/ 出路 B（稍后重试+社区反馈）；文案按 mockup。
- R6 使用中诊断：全局错误钩子——discourseRequest 403/-100 等网络错误时 toast 带「查看诊断」；诊断面板组件（DiagPanel.vue）：三步结论+重试/降级出口；诊断入口常驻设置→网络诊断（已有则对齐样式）。诊断结论格式规范：**任何错误必须给结论+下一步动作**，禁止裸状态码。
- R7 第一帖成功时刻：onboarding 完成后首次进主框架，右上角「🎉 一切就绪」badge（8s 自动消失或点击关闭），一次性（prefs 标记）。
- R8 文案规范：面向新用户，禁止裸状态码/术语裸奔；每个错误必带动作。

## Acceptance Criteria

- [ ] AC1 删 prefs 模拟新用户：启动直接进 Welcome 流程；完成登录后进主框架，重启不再进（onboardingDone 持久化）。
- [ ] AC2 老用户（有 cookie/配置）升级启动：不进 Welcome，直接主框架。
- [ ] AC3 检测三步逐点点亮，三态分支与 mockup 一致；整体 >15s 超时落 fallback。
- [ ] AC4 过盾屏只在「需过盾」分支出现，进度真实反映既有自动化链路状态（不造假进度）。
- [ ] AC5 降级指引两出路可用；「重新检测」回到 detect 屏。
- [ ] AC6 使用中触发网络错误 → toast → 诊断面板结论正确；设置内手动诊断入口对齐。
- [ ] AC7 文案零裸状态码（AC 抽查全部错误路径）。
- [ ] AC8 `npm run typecheck` + `npm run build` 双绿。

## Out of Scope

- ECH 过盾机制本身改动（ech-engine 任务域）
- WebDAV/收藏夹向导化（设置里已有，流程内只留文字提及）
- 多语言/深链恢复

## Constraints

- 主进程检测编排属分区 A；ech/doh 模块只读复用不改内部逻辑；kb-api 会话若有新 WIP 按登记隔离。
- 样式走 ui-spec tokens；新界面全部对照 mockup 逐屏实现（尺寸/文案/状态）。
