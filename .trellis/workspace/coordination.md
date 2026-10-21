# 多会话协同公告板（所有 AI 会话开工前必读）

> 更新：2026-10-16（styles 拆分 044c0bb 后同步）｜ 维护：主会话（编排/分析项目）
> 用法：开工前读本文件 → 在「认领登记」追加一行（会话标识+责任区+时间）→ 公用文件只追加不重排 → 原子功能完成立即提交。

## 会话责任分区（2026-10-16 定稿，styles 文件按 044c0bb 拆分后更新）

| 分区 | 责任文件（独占） | 在途会话 |
|---|---|---|
| A 编排+主进程数据层 | client.ts / offline.ts / webdav.ts / syncdata.ts / settings.ts / ipc.ts 主进程段 / 任务编排 | 主会话（分析项目） |
| B 阅读与内容区 | TopicView.vue / PostItem.vue / stores/topic.ts / topic.css / topbar.css / 内链跳转 / 树形 | 内链跳转会话（fa05630 已交付） |
| C 发现与列表 | HomeView.vue / BrowseView.vue / stores/topicList.ts / stores/browse.ts / home.css / browse.css / 搜索 / 最热Top / 队列 | 搜索UI会话（666e07d + e6d542e 已交付） |
| D 外观与主题工坊 | themes.ts / assets/themes/ / SettingsView 外观分类 / UserCard.vue / UserProfileView.vue / user.css / lightbox.css | 主题工坊会话（用户卡/用户主页/灯箱已落地 044c0bb，待人工验收） |
| E 登录与桥接 | LoginView.vue / login.css / auth.ts / bridge.ts / connect.ts | 待开 |
| F 设置中心其余 | SettingsView 非外观段 / settings.css / notifications.css / notifications 页 / 通知 / 同步分类 | 已交付（webdav/companion 会话收尾中） |

## 公用文件协议（冲突热点，五条铁律）

1. **只追加不重排**：公用文件为 `ipc.ts` / `preload/index.ts` + `index.d.ts` / `App.vue` / `router/index.ts` / `client.ts` / `settings.ts` / `main.ts` / `assets/styles/tokens.css` / `base.css`。改动=追加自己的命名段（同一文件多人改动用 `/* @scope: <会话名> */` 段注释分隔），禁止重排/重命名/删除他人规则。
2. **广播**：动公用文件前，在「认领登记」表追加意图行（文件+意图+预计区间）。
3. **提交纪律**：一个原子功能完成立即 `git commit`（含 typecheck），工作区停留不超过一个功能周期。
4. **styles 分层（044c0bb 拆分后）**：单文件 styles.css 已删除；`assets/styles/` 按部位 11 文件（tokens/base/topbar/browse/home/topic/login/settings/notifications/user/lightbox），main.ts 按序引入。tokens.css 单轨主题组（data-theme）与 base.css 公用控件（act/card/field-row/switch/seg/stepper/ico/ic/overlay/tr-*）为底座不动；部位文件归各分区（见分区表），新页面**新建部位文件**而非塞进公用；主题工坊的主题包覆盖必须兼容 prefs 变量（应用顺序：prefs 基础 → 主题包覆盖）。
5. **冲突处置**：发现树被他人改动 → 重读文件适配，禁止用旧区间替换回写（本日 styles 误删事故教训，见 journal Session 13-14）。

## 认领登记

| 时间 | 会话 | 分区/文件 | 状态 |
|---|---|---|---|
| 10-16 15:30 | 主会话 | styles.css 时间轴段重写+正文媒体自适应 | 已提交 0cbdaca/776bde4/dde19e1 |
| 10-16 15:20 | 搜索UI会话 | 列表搜索 MVP | 已提交 666e07d |
| 10-16 15:10 | 内链跳转会话 | cooked 内链拦截 | 已提交 fa05630 |
| 在途 | 主题工坊会话 | themes.ts/UserCard/PostItem 挂卡/App.vue | 已提交 044c0bb（用户卡/用户主页/灯箱随批落地，待人工验收） |
| 在途 | 主题工坊会话 | batch2-attach 任务 | 已提交 044c0bb，待人工验收 |
| 10-16 15:4x | list-ui-redesign 会话 | **styles.css 整体重写** | 已完成：044c0bb 拆分为 assets/styles/ 按部位 11 文件并删除单文件 styles.css，其余会话可恢复 styles 改动 |
| 10-16 16:0x | 用户拍板 | styles.css 收尾权确认归 list-ui-redesign 会话（方案1）；完成后主会话做全局校对补漏 | 已兑现 044c0bb |
| 10-16 15:4x | 主会话 | 实测发现：列表新缩略图无尺寸约束（撑爆行）、部分新组件无样式——均为该会话未完成项，已反馈 | 随 044c0bb 拆分处理，待人工验收复核 |
| 10-16 16:2x | 搜索UI会话 | 端点核实（page 翻页上限10页/空页即尽/blurb 300字）+ IPC 四点布线契约入 backend spec + PRD 补核实结论 | 已提交 e6d542e |
| 10-16 17:0x | 主会话（doh-real） | 新文件 main/api/dohProxy.ts（分区A）；公用文件 ipc.ts（settings:setDoh 段追加 applyDohRuntime）、main/index.ts（ready 段追加接线）；SettingsView 仅 DoH 卡片文案 | 已提交 00302f5（待真机验收） |
| 10-16 17:4x | 阅读体感会话 | 分区 B topic.css cooked 段全量重设计（标题层级/引用楼/onebox/折叠/表格/mention/emoji，用户拍板折进 10-16-reading-feel），不碰公用 tokens/base | 在途 |
| 10-16 17:5x | 主会话（settings-ui-fix） | base.css 尾部 @scope 段（裸 button/input 兜底+card h2+card-badge.reco）；settings.css（nav 按钮/.accel/.diag-row.bad、删死类） | 已提交 f167017 |
| 10-16 18:0x | 主会话（topbar-fix，用户截图反馈） | 分区 B topbar.css：topbar-inner 去 1060 居中改全宽 + WCO 预留原生窗口钮区（App 顶栏属全应用壳，借 B 区文件，已同步内链跳转会话） | 已提交（见 git log） |
| 10-16 18:2x | 主会话（window-btns-remove，用户拍板） | main/index.ts 窗口选项段、main/win.ts 删 overlay 段、topbar.css 去回 WCO 块、preload 注释 | 已提交（见 git log） |
| 10-16 18:4x | 主会话（win-btns，用户拍板「加」） | 公用 App.vue 顶栏尾段追加 win-btns 组；ipc.ts/preload 两件/topbar.css 追加 | 已提交（见 git log） |
| 10-17 01:3x | 主会话（row-q-fix） | 分区 C home.css 尾部 @scope 追加 .row-q 补丁；base.css 尾部 .stepper button padding:0（settings-ui-fix 全局皮肤回归） | 已提交（见 git log） |
| 10-18 02:3x | 主会话（user-flow-ui，用户点名） | 分区 D 接管（UserCard 删/UserHoverCard 新建/UserProfileView/user.css）；分区 B/C 触点 PostItem/TopicView/HomeView/RailNav；公用 client/ipc/preload 追加 user:actions | 在途 |
| 10-19 01:3x | 主会话（net-settings，用户点名 FluxDO 化） | settings.ts 网络三字段全 setter 透传；dohProxy 手动上游+testUpstream；ipc/preload 四点；SettingsView 上游代理卡（分区 F 网络） | 提交（见 git log） |
| 10-19 09:4x | 主会话（ech-engine P1，用户拍板） | 新目录 ech-gateway/（Go sidecar，独立语言栈归主会话）；协议边界冻结（design.md） | 已提交（见 git log） |
| 10-19 10:3x | 主会话（ech-engine P2） | echGateway.ts 新建（分区A）；settings/dohProxy/SettingsView ech 档；scripts/+builder 接线 | 已提交（见 git log） |
| 10-19 12:3x | 主会话（kb-api，用户点名） | externalApi.ts 新建（分区A）；settings 三字段透传；SettingsView 新 AI 接口分类；docs/ai-api.md | 已提交（见 git log） |
| 10-19 11:3x | 主会话（ux-batch） | tokens/shell/base @scope 动效段；TopicView 回传接线；UserProfileView 进度卡；client/ipc/preload timings 四点；新 utils/readTiming.ts | 已提交（见 git log） |
| 10-17 02:3x | 主会话（feishu-im-frame，用户拍板顶栏删除） | 公用 App.vue（topbar 段重构为 rail 壳——用户拍板例外）、main.ts（引入新建 shell.css）；新建 components/RailNav.vue + styles/shell.css；分区 B TopicView.vue/topic.css（thread 折叠+删 viewMode）；分区 C HomeView.vue/home.css/BrowseView.vue（列表飞书化+白底通铺）；topbar.css 置 deprecated；tokens.css 尾部追加变量组 | 在途（.trellis/tasks/10-17-feishu-im-frame） |
| 10-17 05:0x | 主会话（feishu-im-frame 验收排障，越界说明见下） | **分区 D assets/themes/feishu.ts**：删 `.browse::before` 假 rail 块（56px 圆点条，新框架下顶列表+假栏真身）+删 reader-pane 灰底（违 R3 白底通铺），版本 0.1.0→0.1.1。D 区属主题工坊会话，因其皮肤在用户侧激活且与新框架结构性冲突，紧急适配；皮肤整体重制仍归 D 区后续 | 已提交（3756602 随 feishu-im-frame 批次） |
| 10-17 05:4x | 主会话（feishu-im-frame R12 动效，越界说明见下） | **分区 D lightbox.css**：尾部 @scope 追加开合动效（遮罩渐显+图片缩放入场，animation-only 不动既有规则）。R12 动效 tokens（--motion-*）+队列浮层/thread 展开/整宽页路由切换/rail 收起动画在 shell.css+topic.css+App.vue（Transition 包 RouterView）；整宽页右上安全区 112px | 已提交 |
| 10-18 0x:xx | 主会话（**ui-spec-calibration 全站样式校准**，用户拍板规范稿） | **跨 A-F 区全部 styles 文件 + 底座 tokens.css/base.css 结构性修改（用户拍板单轨化唯一破例）**：底座换规范 9+4 槽位、--im-* 颜色槽位删除、字号/圆角/阴影/z-index 归档、控件五态、浮层/反馈态壳。零功能逻辑改动；.queue-panel 等皮肤类名保证存活。任务 .trellis/tasks/10-18-ui-spec-calibration | 在途 |

## 待用户决策

- GitHub 仓库（owner/repo）→ 接通自动更新 AC5
- DoH 真实现立项（本地 DoH 代理方案）
| 10-19 0x:xx | 主会话（frontend-componentization P1+P2，用户拍板） | **跨 B/C/D 触达**：新建 layouts/AppShell.vue+PageShell.vue（App.vue 模板迁出）；components/FieldRow.vue+SegGroup.vue（SettingsView 替换）+QueuePanel.vue（RailNav 迁出）。纯结构重构零行为变化，类名全保活（.queue-panel 等）。任务 .trellis/tasks/10-19-frontend-componentization | 在途 |
| 10-20 0x:xx | 主会话（login-cred-autofill，用户拍板仅填充不自动提交） | 分区 E 接管（LoginView.vue 登记块/auth.ts login.enc 存取+注入填充）；公用 ipc.ts+preload 两件追加 auth:saveLoginCred/loginCredStatus/clearLoginCred 三通道（只追加） | 在途 |
| 10-20 1x:xx | 主会话（login-cred-autofill 会话顺带 UI 修复，用户截图反馈） | 分区 B topic.css：`.ldd-thread .post--depth3` 特异性提升（修头像贴轨）+ onebox/引用内图片限高；已提交 be3f585 | 已提交 |
| 10-20 2x:xx | 主会话（queue-park，roadmap M1 拍板） | RailNav/HomeView 入口 v-if 藏（stores/queue.ts 新增 QUEUE_ENABLED=false）；管线保留 | 已提交 |
| 10-20 3x:xx | 主会话（M1 自主验收+dist 链路验证） | CDP 自动验收：队列入藏 PASS/搜索连通 PASS(topics=50)/登录账密=已登录态不可自动验(移交)/depth3=未遇样例(移交)；npm run dist 全链 PASS(Go 网关→vite→NSIS 108MB setup) + win-unpacked 冒烟 PASS | 已提交(验证性,无代码变更) |
| 10-20 4x:xx | 主会话（M1 验收收线） | depth3 样式真机数字级 PASS（16px/22px/距轨16px，实测帖 2923820）；账密自动填充验证被 CF 挑战页拦截（登录窗停在盾前，非填充缺陷），移交用户真手验；探测全程 _t 备份/恢复，会话无损 | 已提交(验证性) |
| 10-20 5x:xx | 主会话（ech-degrade，发布门槛#1 后半句） | 分区 A dohProxy.ts（chainWithSelfHeal 自愈+echNote）+ ipc/preload/d.ts 追加 diag:echNote + SettingsView 上游卡显示；真机验证：降级原因可见 PASS、杀网关自愈重启日志 PASS、ech 隧道后 CF 盾层挂起=已知专项移交 | 已提交并归档 |
| 10-20 6x:xx | 主会话（login-cred 二轮修复，用户真机反馈未填充） | auth.ts：did-finish-load 每次加载重注入（一次性注入随导航销毁）+ 注入脚本防重入/清空重填；CDP 实测填充 PASS；任务归档 | 已提交并归档 |
| 10-20 7x:xx | 主会话（rail-collections，用户拍板收藏夹/队列进 rail） | RailNav fav-wrap 收藏夹浮层（点夹切 mode 回首页）+ QUEUE_ENABLED=true 队列回归；HomeView 摘除收藏夹 chip/逻辑；shell.css fav 样式；另：最多浏览周期档=上游语义近似（周期内创建帖按累计浏览，面板文案已标注），CDP 验证 rail 双入口+面板+切模式全 PASS | 已提交 |
| 10-20 8x:xx | 主会话（fav-rail-management，grill 三拍板 A/行内确认/无确认移出） | RailNav 面板升级管理中心（建/改/删夹行内确认+默认夹保护+删筛选夹自动回默认）；TopicView fav 菜单精简为勾选+新建；HomeView 收藏夹行内移出本夹；CDP 烟测建/改/删全 PASS | 已提交并归档 |
| 10-20 9x:xx | 主会话（ui-audit，/goal 全量审计） | AppShell.vue Transition 加 :duration=200（根治 out-in 竞态僵死：快速导航/resize 打断 leave 致路由视图永久卡离场态，三重压力复测通过）；ui-audit.py 扫描器（3 尺寸×8 页面 DOM 溢出/裁剪+截图）；audit 基线截图 24 张入库；观察项：通知 focus 残留疑似 probe 产物、用户页等级进度全满绿语义、启动右栏重载延迟（AC3 设计） | 已提交 |
| 10-21 0x:xx | 主会话（route-driven-list，用户拍板最合适架构+undo） | router 六列表路由新增；BrowseView route→store 单向驱动 watch；HomeView 全部 chip 改 router.push（剩 2 处同模式刷新守卫合法保留）；RailNav 收藏夹 push 路由；移出本夹 5s 撤销条（shell.css undo-bar）。CDP 验证：URL 直达四模式/收藏夹点最新回归（用户报 bug 根治）/history.back/撤销全链 全 PASS。公用文件 router/index.ts 追加路由段 | 已提交并归档 |
| 10-21 1x:xx | 主会话（lightbox-zoom-pan，用户需求） | TopicView 灯箱替换二档切换：lbScale/lbX/lbY + 滚轮锚定光标无级缩放（0.2~12x）+ Pointer 拖拽平移 + 双击复位；lightbox.css 去 transform 过渡 + grab/grabbing 光标；CDP 四连烟测 PASS | 已提交并归档 |
| 10-19 1x:xx | 主会话（favorite-folders 多收藏夹+云同步，用户拍板） | **分区 A syncdata.ts（SyncBundle v2 favorites）+ 分区 C topicList/HomeView（收藏夹筛选模式）+ B TopicView（收藏钮 ▾）+ 新 stores/favorites.ts**。站点 Discourse 书签调用不动；WebDAV 通道复用。任务 .trellis/tasks/10-19-favorite-folders | 在途 |
| 10-21 1x:xx | 主会话（golden-path 冷启动黄金路径，用户拍板原型） | **分区 A 主进程新增 netdetect 检测编排（复用 dohProxy/ech 只读）+ 渲染层 WelcomeView 8 屏状态机 + DiagPanel 诊断面板 + prefs onboardingDone/router 守卫**。ech 过盾机制只包 UI 不动内部。任务 .trellis/tasks/10-21-golden-path | 在途 |
