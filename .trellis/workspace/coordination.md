# 多会话协同公告板（所有 AI 会话开工前必读）

> 更新：2026-10-16 ｜ 维护：主会话（编排/分析项目）
> 用法：开工前读本文件 → 在「认领登记」追加一行（会话标识+责任区+时间）→ 公用文件只追加不重排 → 原子功能完成立即提交。

## 会话责任分区（2026-10-16 定稿）

| 分区 | 责任文件（独占） | 在途会话 |
|---|---|---|
| A 编排+主进程数据层 | client.ts / offline.ts / webdav.ts / syncdata.ts / settings.ts / ipc.ts 主进程段 / 任务编排 | 主会话（分析项目） |
| B 阅读与内容区 | TopicView.vue / PostItem.vue / stores/topic.ts / 内链跳转 / 树形 / 固定顶栏 | 内链跳转会话（fa05630 已交付） |
| C 发现与列表 | HomeView.vue / BrowseView.vue / stores/topicList.ts / stores/browse.ts / 搜索 / 最热Top / 队列 | 搜索UI会话（666e07d 已交付） |
| D 外观与主题工坊 | 主题段 styles / themes.ts / assets/themes/ / SettingsView 外观分类 | 主题工坊会话（在途：用户卡/挂卡） |
| E 登录与桥接 | LoginView.vue / auth.ts / bridge.ts / connect.ts | 待开 |
| F 设置中心其余 | SettingsView 非外观段 / 通知 / 同步分类 | 已交付（webdav/companion 会话收尾中） |

## 公用文件协议（冲突热点，五条铁律）

1. **只追加不重排**：`ipc.ts` / `preload/index.ts` + `index.d.ts` / `styles.css` / `App.vue` / `router/index.ts` / `client.ts` / `settings.ts` 为公用文件。改动=追加自己的命名段（styles.css 用 `/* @scope: <会话名> */` 段落注释），禁止重排/重命名/删除他人规则。
2. **广播**：动公用文件前，在「认领登记」表追加意图行（文件+意图+预计区间）。
3. **提交纪律**：一个原子功能完成立即 `git commit`（含 typecheck），工作区停留不超过一个功能周期。
4. **styles.css 分层**：tokens 与既有规则不动；各会话规则进自己的 `@scope` 段；主题工坊的主题包覆盖必须兼容 prefs 变量（应用顺序：prefs 基础 → 主题包覆盖）。
5. **冲突处置**：发现树被他人改动 → 重读文件适配，禁止用旧区间替换回写（本日 styles 误删事故教训，见 journal Session 13-14）。

## 认领登记

| 时间 | 会话 | 分区/文件 | 状态 |
|---|---|---|---|
| 10-16 15:30 | 主会话 | styles.css 时间轴段重写+正文媒体自适应 | 已提交 0cbdaca/776bde4/dde19e1 |
| 10-16 15:20 | 搜索UI会话 | 列表搜索 MVP | 已提交 666e07d |
| 10-16 15:10 | 内链跳转会话 | cooked 内链拦截 | 已提交 fa05630 |
| 在途 | 主题工坊会话 | themes.ts/UserCard/PostItem 挂卡/App.vue | 未提交（其会话收尾） |
| 在途 | 主题工坊会话 | batch2-attach 任务 | 未提交 |
| 10-16 15:4x | list-ui-redesign 会话 | **styles.css 整体重写中（196 行精简版，未完成）** | 其余会话暂停 styles 改动，等其完成后再统一补漏 |
| 10-16 16:0x | 用户拍板 | styles.css 收尾权确认归 list-ui-redesign 会话（方案1）；完成后主会话做全局校对补漏 |
| 10-16 15:4x | 主会话 | 实测发现：列表新缩略图无尺寸约束（撑爆行）、部分新组件无样式——均为该会话未完成项，已反馈 |

## 待用户决策

- GitHub 仓库（owner/repo）→ 接通自动更新 AC5
- DoH 真实现立项（本地 DoH 代理方案）
- 主题工坊并行会话的收尾归属
