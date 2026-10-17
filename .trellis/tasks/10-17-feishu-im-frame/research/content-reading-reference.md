# Research: 帖子「正文 + 回复流」阅读页 UI 开源参考

- Query: 论坛帖子正文+回复流的阅读页排版参考（Discourse / Flarum / FluxDO / ALDR / 其他），为 Electron+Vue3 linux.do 客户端的阅读页优雅化提供落地规则
- Scope: external（外部开源项目源码与文档）+ 少量 internal（确认 ALDR 名称）
- Date: 2026-10-17
- 检索方式：zread 直接读取 GitHub 源码文件（非泛搜），以下数值均为源码摘录，标注文件路径

## 用户现状（问题）

白底通铺内容区、楼层 = 头像 + @作者 + #楼号 + 时间 + cooked 正文 + 常显动作行（赞/回复/编辑/翻译）、回复串默认展开三级缩进、引用块 = 浅蓝 callout 卡。核心不适：**内容无边界、动作行噪音大、引用与嵌套回复过度展开**。

## 各参考项目

### 1. Discourse 官方默认主题（linux.do 的上游，最直接对标）

- 仓库：https://github.com/discourse/discourse （master，2026-10 摘录）
- 关键文件：
  - `app/assets/stylesheets/common/foundation/variables.scss`（布局变量）
  - `app/assets/stylesheets/common/base/topic-post.scss`（楼层结构/动作行/引用）
  - `app/assets/stylesheets/common/base/base.scss`（spacing token）
  - `app/assets/stylesheets/common/font-variables.scss`（字号/行高）
- 排版参数（源码原文）：

| 参数 | 值 | 出处 |
|---|---|---|
| 正文区宽度 | `--topic-body-width: 690px` + 两侧 padding 12px（`--topic-body-width-padding: var(--space-3)` = 0.75rem），即文字实际宽 ~714px | variables.scss `$topic-body-width: 690px`；base.scss |
| 头像列 | `--topic-avatar-width: 45px`，头像 45×45 圆形，列随楼层通高 | variables.scss；topic-post.scss `.topic-avatar` |
| 基准字号 | `--base-font-size: 1em`（16px），用户可选 13/14/16/18/20px | font-variables.scss |
| 正文行高 | `--cooked-line-height: 1.5`（cooked 专用，区别于全局 1.4） | font-variables.scss |
| 行高阶梯 | small 1 / medium 1.2（标题）/ large 1.4（普通文本） | font-variables.scss |
| 字号阶梯 | 每级 ×2^(1/5)：down-2 0.758em → 0 1em → up-6 2.296em；元信息用 `--font-down-1`（≈13.9px） | font-variables.scss |
| 楼层分隔 | 相邻楼层间 `border-top: 1px solid var(--content-border-color)`（= primary-low），第一楼无线；`padding: var(--space-3) 0 0 0`（12px 顶距） | topic-post.scss `.topic-body` |
| 动作行 | 次级动作默认 `opacity: 0.7`（桌面端），`&:hover .actions .fade-out { opacity: 1 }`；触屏端常显 opacity 1 | topic-post.scss `nav.post-controls .fade-out` |
| 代码块复制钮 | 桌面端默认 `opacity: 0; visibility: hidden`，hover 容器后 0.7 | topic-post.scss `.codeblock-buttons` |
| 引用块 | `aside.quote`：`.title` 行（背景 `--d-post-aside-background` + 左边条 `--d-post-aside-border-left`，padding 0.8em，含头像/用户名/标题 + `quote-controls`）；`data-can-toggle-quote` 时可点折叠；嵌套引用降级为 `background: var(--primary-very-low); border-left: 5px solid var(--primary-low)` | topic-post.scss `aside.quote` |
| 折叠楼层提示 | `.gap`：`font-size: var(--font-down-1)`，加粗、大写，`padding-left: calc(头像宽 + 正文 padding)` 与正文列对齐 | topic-post.scss `.gap` |
| 时间空隙 | `.time-gap`：给下一楼取消分隔线，desc 行 `padding-top: var(--space-3)` | topic-post.scss |
| 回复指向 | `a.reply-to-tab`：纯文字链（muted 色）+ 图标，`max-width: 400px` 截断 | topic-post.scss |
| 「N 条回复」 | `.btn.show-replies`：扁平钮，展开后 `background: var(--primary-low)` | topic-post.scss |
| 头像吸顶 | `.topic-post.sticky-avatar`：长楼滚动时头像 sticky 在 header 下方 | topic-post.scss |
| 版面宽度 | `$small-width: 800px / $medium-width: 995px / $large-width: 1110px`（整页容器） | variables.scss |

### 2. Flarum PostStream（公认优雅的评论流）

- 仓库：https://github.com/flarum/framework （`framework/core/less/`，master）
- 关键文件：`less/forum/Post.less`、`less/forum/PostStream.less`、`less/common/root.less`、`less/common/variables.less`、`less/common/scaffolding.less`
- 排版参数（源码原文）：

| 参数 | 值 | 出处 |
|---|---|---|
| 头像列 | `--avatar-column-width: 85px`；桌面端大头像 64px（`.Post-avatar .Avatar--size(64px)`），楼层头里另有 32px 小头像；移动端隐藏左列头像 | root.less；Post.less @tablet-up |
| 楼层内边距 | `--post-padding: 20px`；`.Post` 四边 padding（左侧 0，因头像列自带） | root.less；Post.less |
| 楼层容器 | 桌面端 `grid-template-columns: var(--avatar-column-width) 1fr` 的两列 grid | Post.less @tablet-up |
| 正文 | `.Post-body { font-size: 14px; line-height: 1.7; overflow-wrap: break-word }` | Post.less |
| 用户名 | 14px 加粗；元信息（时间/楼号）继承 muted 色 | Post.less `.PostUser-name` |
| 楼层分隔 | 相邻楼层间 1px 线：`width: calc(100% - var(--post-padding)); margin-right: auto`（右对齐短线，不从头像列起） | PostStream.less `.PostStream-item::after` |
| 时间空隙 | `.PostStream-timeGap`：12px、加粗、大写、muted，`padding: 20px 20px 20px var(--avatar-column-width)` | PostStream.less |
| 动作行 | 桌面端**默认 opacity: 0**：`@media @tablet-up { .no-touch & { opacity: 0 } }`，`.Post:hover / :focus-within / .openWithin → opacity: 1`，带 0.2s 过渡；正文内嵌的页脚（谁赞过）常显 | Post.less `.Post-actions` |
| 引用块 | 卡片化：`background: var(--control-bg); color: var(--control-color); border-radius: var(--border-radius)(4px); padding: 8px 15px; border-top/bottom: 2px dotted var(--body-bg)`（不缩进文字、整块独立卡） | Post.less `.Post-body blockquote` |
| 行内代码/代码块 | 行内 code：90% 字号、`--code-bg` 底、4px 圆角；pre 内 code `padding: 1em; max-height: max(50vh, 250px)` 内滚 | Post.less |
| 回复占位 | `.ReplyPlaceholder`：`border: 2px dashed`，桌面端边框透明、hover 才显边框色，圆角 10px，含 64px 头像 | Post.less |
| 隐藏楼层 | `.Post--hidden`：头部保留，正文/动作隐藏，整体 opacity 0.5 | Post.less |
| 页面容器 | `width: 768px(tablet) / 992px(desktop) / 1100px(desktop-hd)` 居中；`--sidebar-width: 190px`，正文列与侧栏 gap 50px | scaffolding.less `.container`；PageStructure.less |
| 全局字号 | body 13px / 1.5（正文才放大到 14px） | scaffolding.less |

### 3. FluxDO（Lingyan000/fluxdo，Flutter，同为 linux.do 第三方客户端）

- 仓库：https://github.com/Lingyan000/fluxdo （master）；截图 `screenshots/preview.png`；介绍帖 https://linux.do/t/topic/1609212
- 关键文件：`lib/widgets/post/post_item/widgets/post_header.dart`、`post_action_bar.dart`、`lib/widgets/content/discourse_html_content/builders/quote_card_builder.dart`、`lib/pages/topic_detail_page/`
- 排版参数（Dart 源码摘录）：

| 参数 | 值 | 出处 |
|---|---|---|
| 楼层头像 | 半径 20（40px），1px `outlineVariant` 描边；与文字列间距 12px | post_header.dart `PostAvatar` |
| 作者行 | 名字 14px 加粗（版主/admin 用主题 primary 色）；OP/我 用小彩底 chip（`primaryContainer`/`tertiaryContainer`） | post_header.dart |
| 次要行 | `@username` 11px `onSurfaceVariant` + 头衔 11px primary 80% 透明度 | post_header.dart |
| 回复指向 | 药丸 chip：`padding h8 v5`、圆角 20、`primary α0.08` 底 + `primary α0.1` 边框，内含 14px 回复图标 + 20px 迷你头像，可点展开回复历史 | post_header.dart `_buildReplyIndicator` |
| 动作栏 | 常显药丸按钮：高 36、圆角 18、`surfaceContainerHighest α0.3` 底；激活态 `primaryContainer α0.3` 底 + `primary α0.2` 1px 边框；点赞长按出表情 picker；右侧「更多」为 36px 圆钮 | post_action_bar.dart |
| 回复数展开 | 回复数药丸带展开/收起 chevron（`keyboard_arrow_down/up`），展开态换 primary 色 | post_action_bar.dart |
| 引用卡 | `margin v8`、`surfaceContainerHighest α0.3` 底、**左边条 4px `outline` 色**、仅右侧圆角 4px；标题行 padding 12/8/12/0：24px 圆头像 + 用户名 `labelLarge w600` + 原帖标题（primary 色、11px 分类 chip、单行省略）；引用正文 `bodyMedium`、行高 1.5、`onSurfaceVariant` 色 | quote_card_builder.dart |
| cooked 渲染 | 富文本 builder 体系：引用卡/代码块/剧透/折叠 callout（`foldable_callout.dart`）/图片轮播/表格等独立 builder，长帖分段物化（`segmented_long_post.dart` + chunk 缓存） | lib/widgets/content/discourse_html_content/ |
| 楼中楼 | 楼内回复列表独立 widget（`post_replies_list.dart`），默认收起、由动作栏「回复数」药丸展开 | lib/widgets/post/post_item/ |

### 4. ALDR = sunbigfly/awesome-linuxdo-reader（A**wesome L**inuxDo R**eader**，userscript）

- 名称对齐：本项目 `.trellis/tasks/10-16-settings-center/research.md:10` 已确认 ALDR 即 `sunbigfly/awesome-linuxdo-reader`（MIT）。仓库：https://github.com/sunbigfly/awesome-linuxdo-reader
- 关键文件：`lite/styles/00-foundation.css`（design tokens）、`lite/styles/40-reply-tree.css`（回复树/引用）
- 排版参数（CSS 源码摘录）：

| 参数 | 值 | 出处 |
|---|---|---|
| 字阶 | micro 9 / xs 10 / sm 11 / **ui 12 / base 13 / md 14（默认正文字号）** / lg 15 / xl 16 / 2xl 18 | 00-foundation.css |
| 树形回复头像 | `--ldp-thread-avatar-size: 28px`，头部 gap 8px；正文/动作列偏移 `body-offset = avatar + gap = 36px` | 00-foundation.css |
| 回复连接线 | 宽 `1.15px`、色 `accent` 混 `ink-muted`（浅色 #47855f / 深 #78c295，即 linux.do 绿）、弯头圆角 16px、命中区 14px（点击线即折叠） | 00-foundation.css `--ldp-reply-line-*` |
| 楼层留白 | 树内楼层 `padding: 5px 0 7px`，相邻楼层 `margin-top: 1px`，无卡片、无背景（线性流） | 40-reply-tree.css `.ldp-reply-list > .ldp-post` |
| 分支折叠 | 16px 圆形 +/− 钮（1.25px 边框、圆形、hover 变 accent 底白字）；折叠后整支变**单行 chip**：头像缩到 20px、作者+楼号单行省略、「N」计数 opacity .72 | 40-reply-tree.css `.ldp-reader-branch-toggle` / `.ldp-branch-parent-collapsed` |
| 深度边界 | 默认不展全部：非叶子也截断，`+` 逐层揭示；同位置「完整讨论」开浮窗（居中 `min(960px, 100vw-48px)` × `min(78vh, 720px)`，或 inline 内嵌） | 40-reply-tree.css `.ldp-has-hidden-child-branches` / `.ldp-descendant-replies-*` |
| 嵌套正文字号 | 楼中楼正文 = 楼层字号 ×0.96（`--ldp-nested-content-scale`），视觉上逐级轻微缩小 | 40-reply-tree.css `.ldp-nested-preview` |
| 引用块 | `aside.ldp-post-quote`：`padding: 12px 14px`、**左边条 5px**（可强调）、`surface-muted` 底；标题行 min-height 28px = 24px 圆头像 + 用户名 w650；**blockquote `max-height: 220px; overflow: hidden`（超长默认折叠）**；右上 28×28 展开钮 + accent-soft 底跳转钮 | 40-reply-tree.css |
| 引用回跳 | 返回原楼 pill：圆角 999、accent-soft 底、font-sm w650 | 40-reply-tree.css `.ldp-quote-return-entry` |
| 楼号 chip | 当前楼号高亮：`padding: 1px 5px`、圆角 5、accent 7% 底 | 40-reply-tree.css `.ldp-floor.ldp-jump-self` |
| 分隔线 | 1px（`--ldp-divider-line-width`），色为 border 的 88% 透明混合 | 00-foundation.css |
| 圆角阶梯 | xs 4 / sm 7 / md 10 / lg 14 | 00-foundation.css |

### 5. 其他参考

- **GitHub Issues 时间线**：Primer Timeline 组件——`TimelineItem-avatar` 40px、条目由 badge 串在垂直 rail 上（官方组件文档 https://primer.style/product/components/timeline ；类说明见 https://www.geeksforgeeks.org/css/primer-css-timeline-timelineitem-avatar ）。**只核实到 40px 头像与「rail+badge」形态**；rail 线宽/缩进等一手 SCSS 未取到（primer/css 新版已移除 timeline 模块）。可借鉴的是「系统事件（关闭/引用/改名）= rail 上小 badge 行，与评论楼区分」。
- **Reddit 新版（shreddit）**：shadow DOM 封装，社区观察主内容列约 744–756px、评论按嵌套缩进 + 折叠线（参考 https://www.reddit.com/r/userstyles/comments/1m9d7tz/reddit_style_not_fully_working ）。**数值未一手核实**，仅作旁证。
- **V2EX**：帖子页需登录，线上 CSS 抓取超时；社区版仓库 livid/v2ex 未被索引。定性印象（两栏布局 + `.cell` 分隔回复、正文字号 14-15px）**全部未核实**，不建议作为数值依据。
- **CNode**：cnodejs/node-club 仓库存在，但样式文件未取到（zread 未索引、jsDelivr 404）。**未核实**。
- 同类替代参考（linux.do 客户端矩阵，出自 https://linux.do/t/topic/2369360 汇总帖）：Doer（moliango/doer，iOS 原生）、Oh My LinuxDo（fzlzjerry/linuxdo-macos，Tauri 2 + React）。

## 可落地设计规则（按投入产出排序）

1. **正文行宽封顶 690–760px 居中，禁止通铺**。内容区给浅色页面底、正文卡片/列用表面色。出处：Discourse `--topic-body-width: 690px`（+24px padding）；Flarum 正文列 = 1100px 容器 − 190px 侧栏；ALDR 完整讨论浮窗 `min(960px, 100vw-48px)`。成本最低、「不优雅感」改善最大。
2. **动作行默认退场，hover/focus 显现；有内容的项（赞数、回复数、引用/翻译结果）常显**。Discourse：次级动作 0.7 → hover 1；Flarum：桌面端 0 → hover/focus-within 1（0.2s 过渡）；FluxDO 反例：常显但收成高 36 圆角 18 的浅底药丸。移动/触屏一律常显（Discourse 同款分支）。
3. **引用块 = 左色条卡片 + 默认折叠超长内容**。参数直接抄 ALDR：padding 12px 14px、左边条 4–5px、浅灰底（浅色 #f7f9fa 级别，不要饱和蓝）、标题行 24px 头像+用户名、正文 `max-height: 220px` 折叠 + 右上 28px 展开钮 + 跳转原楼 pill。Discourse 的 `aside.quote` title 行 + `data-can-toggle-quote` 是交互范本；Flarum 证明「去缩进、整块卡片化」更优雅。
4. **排版基线：正文 15–16px / 行高 1.5–1.7；元信息 11–13px + muted 色；行高只用 1/1.2/1.4(1.7) 三档**。Discourse：cooked 16px/1.5；Flarum：14px/1.7；ALDR：14px 可调、楼中楼 ×0.96；FluxDO：名字 14 加粗、次行 11。当前客户端若正文与元信息同字号，先分层。
5. **楼层分隔用 1px 发丝线 + 小间距，不做重卡片**。Discourse：1px `content-border-color`、楼层顶距 12px；Flarum：右对齐短线 `calc(100% - 20px)`；ALDR：楼层 padding 5/7px、楼间 1px。只有特殊楼层（管理操作/删除/时间空隙）用浅底或居中文字区分（Discourse `.small-action`/`.time-gap`）。
6. **头像列定宽 40–45px，正文与动作行统一缩进到头像列右侧**。Discourse 45px 列 + 长楼 `sticky-avatar`；FluxDO 40px + 12px gap；Flarum 宽屏 64px/85px 列；ALDR 紧凑树 28px + body-offset=36px。动作行与正文左缘对齐（不缩到头像下方）是三家共同点。
7. **长帖折叠单元：折叠楼层/分支变单行 chip，不直接砍断**。ALDR：分支折叠成「20px 头像+作者+N 计数（opacity .72）」一行；Discourse `.gap`：「N 条已折叠」小号加粗大写、缩进对齐正文列；回复数药丸（Discourse `.show-replies` / FluxDO 回复数药丸+chevron）作为展开入口。
8. **回复指向用 pill/细线，不用纯文字堆在头部**。FluxDO 回复指向 pill（primary α0.08 底、圆角 20、20px 迷你头像、可点展开被回复串）；ALDR 回复线 1.15px 主题绿细线 + 16px 圆钮折叠 + 命中区 14px；Discourse `reply-to-tab`（muted 文字链）是最低配。三级缩进若保留，每级缩进量 = 头像宽的一半（ALDR 树线左移 `avatar/2` 的几何）。

## Caveats / Not Found

- `ALDR` 名称已在项目内文档（`.trellis/tasks/10-16-settings-center/research.md`）确认为 sunbigfly/awesome-linuxdo-reader；论坛汇总帖中未见同名其他项目。
- Discourse `.cooked` 的行高取自 master 的 `--cooked-line-height: 1.5`；linux.do 线上用的可能是旧版（15px 基准、行高更大），以 master 为准即可。
- GitHub Timeline 仅核实 40px 头像与形态；rail 具体线宽/位置未取到一手 SCSS。Reddit / V2EX / CNode 数值全部未核实，只可作定性参考，不得直接抄数值。
- FluxDO 是 Flutter 端，其数值是移动/桌面通用的密度参考，字号略小一档（14px 正文）——搬到 Electron+Vue3 桌面端时建议按 Discourse 的 15–16px 基线放大。
- FluxDO `foldable_callout.dart`（可折叠 callout）确认存在但未读取实现细节；引用折叠交互以 ALDR 220px 折叠方案为主参考即可。
