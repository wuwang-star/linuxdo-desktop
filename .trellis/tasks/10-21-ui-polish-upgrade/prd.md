# 质感升级

## Goal

「设计太 low」六根因对治，视觉语言整体上探一档。交互/视觉基准（用户已看过迭代稿）：`research/ui-polish-upgrade.html`（Before/After 同数据对照）。

## Requirements

- R1 品牌锚点（RailNav）：
  - rail 顶品牌 mark（渐变 L 方块，brand 色与 accent 同源）
  - 头像升级身份环（白环+accent 软环）+ 右侧名字/等级两行（未登录=「未登录/点击登录」灰态）
  - 导航分组：「社区」（最新/收藏夹/队列/通知）与「我的」（设置/收起导航）小标签分隔
  - 激活态：左缘 3px 蓝条 + accent 软底 + 图标文字同蓝；rail 底部微渐变
- R2 层次张力（HomeView 中栏）：
  - 节头：「帖子」15px/650 + 主题计数胶囊 + 功能图标组（定位/回顶/筛选）右置带 hover 态
  - 工具条改 **segmented 实心分段**（容器浅灰胶囊内白色浮起选中）；Top ▾/分类 ▾ 保持下拉行为并入分段行尾（ghost 样式）
  - 列表行：标题 13.5px/550 两行；统计行图标+数字 11.5px 三档灰；选中=蓝软底+左 3px 蓝条（inset shadow）
- R3 状态设计：
  - 列表错误：裸 error 文本 → **红软底「结论+动作」卡**（图标+一句话结论+「重试」/「查看诊断」按钮）；`store.error` 的英文原文只进诊断不进 UI
  - 网络类错误（ERR_TUNNEL/403/-100 经 diagBus 既有 toast）保持底部轻 toast（已有），不重复打断列表
  - 加载：列表首载=骨架屏 3 行（base.css .skel 已有，≥300ms 才显示可用现有 loading 延迟或直接替换文案行）
  - 空态（列表无数据 + 阅读区未选主题）：几何插画（CSS 卡片组合，见 mockup .a-art）+ 一句文案 + 主按钮（列表空=「去热榜逛逛」切 top；阅读空=「从左侧选择主题」文案保留+插画）
- R4 节奏细节：rail 渐变底；行 hover 灰底渐显（transition fast）；分隔线弱化；chip/按钮圆角统一 --radius-sm
- R5 图标杂讯清理：sec-head 图标组重排（见 R2）；残留 emoji 全清（grep 🔍📌 等于模板）
- R6 零逻辑改动：只动模板结构/类名/样式；store/IPC 不碰；诊断 toast、定位/回顶/入队等既有交互行为不变

## Acceptance Criteria

- [ ] AC1 rail=品牌 mark+身份环+分组+左条激活态，亮暗两态不炸
- [ ] AC2 工具条 segmented 实心选中，Top/分类下拉行为不变
- [ ] AC3 断网/错误时列表显示「结论+动作」卡（无英文原文）；重试可用
- [ ] AC4 空态两处有插画+主按钮；首载骨架屏出现
- [ ] AC5 `npm run typecheck` + `npm run build` 双绿；对比 research/ui-polish-upgrade.html After 稿视觉一致（用户终审）

- R7 排版方向拍板（2026-10-21 用户：「排版选择飞书类型的IM软件」，三方向 A/B/C 落选）：
  - 全局字体栈 = `-apple-system, "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Microsoft YaHei", sans-serif`
  - 排版 tokens 对齐飞书系：cooked 正文 15px/1.7、UI base 14px、meta 12px、标题 20px/650（阅读页）/15px/650（节头）；段落距 0.8em
  - 阅读页按飞书文档式排版重构：层级只靠灰阶+字重（不引入新色相）、链接=#3370ff 无下划线 hover 下划线、引用=浅灰底+左线、代码块=灰底圆角 6、行内 code 灰底、图片圆角 6、行宽 720 保持
  - 列表行标题 14px/550-600、meta 12px；整体密度中等（不密不疏）
  - 三方向 A/B/C 废弃

## Out of Scope

- 阅读页（TopicView）内文样式（R11 已做）
- 设置/通知/用户页内部重排（PageShell 已统一壳层）
- 暗色主题精调（沿用映射）

## Constraints

- 样式落点：shell.css（rail）+ home.css（中栏）+ base.css（如需公共 err-card/empty 类）@scope 追加；不动部位文件既有规则
- 类名约定：新增类 gp- 已占用，本批用 up- 前缀；皮肤钩子类名（.queue-panel/.row-q 等）保活
