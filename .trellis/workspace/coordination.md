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

## 待用户决策

- GitHub 仓库（owner/repo）→ 接通自动更新 AC5
- DoH 真实现立项（本地 DoH 代理方案）
