# design — 飞书版 IM 外框架改版

视觉基准：`research/feishu-im-frame-mockup.html`（用户验收稿，尺寸/间距/配色以它为准，配色再经 tokens 化）。

## 1. 壳层结构（App.vue 重构，公用文件）

```
#app-shell (flex row, 100vh)
├── aside.rail            ← 新组件 RailNav.vue
└── .shell-main (flex col, flex:1)
    └── RouterView         ← BrowseView / SettingsView / NotificationsView / …
├── .win-btns (absolute 右上)   ← 从现 topbar 原样迁出，data-nodrag
└── UserCard（全局浮层，保留）
```

- 顶栏（header.topbar 整段）删除：brand、nav（最新/队列/通知/设置/登录链接）、queue-wrap 全部迁入 RailNav；win-btns 迁为 shell 层 absolute。
- 路由不变（router/index.ts 不动）。`/`、`/t/:id` → BrowseView（中栏+内容区）；其余整页路由 rail 常驻、内容区整宽。
- 拖拽区：`.rail-top`（头像+搜索段）、中栏节头、`.ldd-t-head`（内容区标题段）加 `-webkit-app-region: drag`；内部交互控件 `no-drag`。双击最大化行为跟 drag 区自带。

## 2. RailNav.vue（新组件，components/）

- Props 无；内部用 auth/queue store + router。
- 结构自上而下：头像（登录=auth 头像+`openUserCard`；未登录=灰态占位，点击跳 /login）＋「＋」占位钮 → 搜索框（复用现 HomeView 搜索交互：回车/输入触发既有搜索 MVP 通路，交互等价迁移，不重写搜索逻辑）→ nav 项：最新(/)、队列（徽标=queue.count，点击开队列浮层——现 queue-panel 逻辑整体迁入，浮层绝对定位于 rail 右侧）→ 通知(/notifications，徽标=unread 现有 computed 迁入) → spacer → 设置(/settings) → 收起/展开钮。
- 收起态：56px 纯 icon+徽标浮角；展开态 184px icon+文字。状态存 `ldd-reading` prefs（`railCollapsed: boolean`），经 utils/prefs 读写（该文件已有 loadPrefs/savePrefs 模式）。
- 未读通知 watcher + MessageBus 接线（现 App.vue script 中的通知/队列/主题应用逻辑）保留在 App.vue，仅模板重构；谁用谁引 store，不新增跨组件事件。

## 3. BrowseView（分区 C 文件）

- 双栏判定 mql ≥1200 保留：dual=true 时 list-pane + reader-pane 并驻（=飞书中栏+内容区）；窄屏维持 route 模拟单栏（列表 OR 阅读）。
- reader-pane 改白底通铺：`.ldd-main` 背景白、无圆角浮卡；空态（现 reader-empty）改居中占位（lucide 风格 icon 不引入——项目已有行内 SVG ICONS 模式，沿用之）。
- TopicView 头部（标题/meta/页签行/动作）在 TopicView 内实现（见 §5），BrowseView 只管容器与空态。

## 4. HomeView 列表飞书化（分区 C 文件）

- 行结构：OP 头像（`opOf()` 已有：posters[0]→usersById）+ 标题 + 摘要行 + 时间右对齐。
- **摘要行数据源**（约束：latest.json 无 blurb，禁止加请求）：
  `last_poster_username`（DiscourseTopicLite 已有则直接用）：`<b>xxx:</b> ` + 无正文可用时展示统计串「N 人参与 · M 回复 · V 浏览」。
  实现前先读 `main/api/client.ts` 的 DiscourseTopicLite 类型定字段；缺 last_poster_username 就用统计串方案，不许臆造字段。
- 时间渲染：created_at/last_posted_at 距今 <24h 用 relTime 现有函数，否则 `MM月DD日`（format utils 内加小函数或内联）。
- 选中态：browse.selectedId===id 时蓝底（tokens 变量）。
- 工具条/节头/Top 六档下拉/分类浮层逻辑不动，只挪样式位；吸顶保留。
- 入队「＋」钮现位置若在行内则保留（mockup 未展开此细节，按现状最小改动）。

## 5. TopicView thread 折叠（分区 B 文件）

- 删除 viewMode（时间流/树形）切换 UI 与偏好读取；`ViewModePref` 类型留型删除用法，prefs 里残留键无害不迁移。
- **聚类算法**（纯函数，放 store/topic.ts 或组件内 computed）：
  ```
  输入 orderedPosts（post_number, reply_to_post_number）
  1. parentOf = Map(reply 楼 → 直接 parent 楼号)
  2. threadRoot：沿 reply_to 链上溯到「无 reply_to 或其 parent 不在已加载范围」的楼层作为串根
  3. 串成员 = 以该根为祖先的所有回复（按 post_number 升序），平铺展示（层级用「回复 #N」chip 表达，不做多级缩进）
  4. 主干 = 所有非成员楼层（含串根）
  ```
  分页边界注意：loadOlder 增量加载后重算聚类即可（纯函数幂等）。
- 渲染：主干楼层卡（现 PostItem 结构保留：头像/作者/#楼/时间/cooked/动作行，头部加「楼主」角标=楼号===1 或 user===OP）；串根底部折叠钮「N 条回复」；展开容器=缩进竖线+子楼小卡（PostItem 复用，小尺寸变体 class）。
- 页签行：「正文」（全部）+「只看楼主」（OP=楼层1 作者；过滤后主干只留 OP 楼层、串内只留 OP 子楼；某串过滤后为空则整串隐藏）。reactive 状态组件内 ref 即可，不入 store。
- 跳楼/闪烁（pendingJump、flash）逻辑保留；jump 到的楼层若在折叠串内，自动展开该串。
- 回复/编辑/翻译/点赞/入队/离线逻辑全部不动。

## 6. styles（部位文件方案）

- **新建 `assets/styles/shell.css`**：rail、shell 布局、win-btns、队列浮层、空态（从 mockup CSS tokens 化移植）。main.ts 在 base.css 后引入。
- **tokens.css 追加变量组**（`/* @scope: feishu-im-frame */` 段注释）：`--rail-bg/--panel/--line/--acc/--accsoft/--red/--hov/--tx/--tx2` 等，亮色暗色两套 data-theme 值；**不改动既有变量**，底座规则不动。
- topic.css：thread 折叠/页签行/callout 引用卡（blockquote 飞书浅蓝卡）段追加；旧树形缩进段标记废弃或删除（先确认无他处引用）。
- home.css：列表行飞书化段。
- topbar.css：顶栏类全部废弃——文件保留但清空/注释并头部注明 deprecated（避免他处 @import 断链），后续任务删文件。

## 7. 配色 tokens（临时方案）

亮色（参考 mockup）：`--rail-bg:#f5f6f7; --panel:#fff; --line:#e7e8ea; --tx:#1f2329; --tx2:#8f959e; --acc:#3370ff; --accsoft:rgba(51,112,255,.10); --red:#f54a45`。
暗色：同槽位深色映射（#1f2329→浅灰文本反转、面板用现有暗色底变量值），保证 AC6 不炸即可，不做精调。

## 8. 风险与回滚

- App.vue 是公用文件：本次重构=用户拍板的顶栏删除（coordination.md 认领登记在案）；提交前 `git diff` 自查无他人段被误删。
- viewMode 删除影响 prefs 读方：仅 TopicView；grep 确认无其他引用。
- 回滚点：整任务单提交批次，revert 即回旧顶栏。
