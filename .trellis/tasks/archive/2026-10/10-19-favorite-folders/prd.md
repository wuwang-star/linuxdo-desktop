# 多收藏夹与云同步

## Goal

本地多收藏夹（应用层组织，独立于 Discourse 原生单书签）+ 云同步走既有 WebDAV 通道（SyncBundle v2 加 favorites 字段）+ 中栏「收藏夹」筛选模式。

## Requirements

- R1 数据模型：`stores/favorites.ts`（Pinia + localStorage `ldd-favorites` 持久化）——`folders: { id: string; name: string; createdAt: number; topicIds: number[] }[]`；内置「默认收藏夹」不可删；同帖可入多夹。
- R2 收藏入口：TopicView 头部既有「收藏」钮旁加 ▾（点开收藏夹菜单：各夹勾选态 + 新建夹输入）；站点 Discourse 书签调用保持现状不动（两套并行：站点书签归站点，本地夹归应用）。
- R3 列表筛选：ListMode 新增 `{ type: 'favorites'; folderId: string }`；数据=本地 store 过滤（topicIds 命中的本地缓存条目：标题/时间/计数取自 favorites 存储时快照——入夹时保存 {id,title,views,like_count,posts_count,created_at,avatar_template 的 OP} 快照，离线可见）；工具条加「收藏夹 ▾」chip（列出各夹+计数）。
- R4 云同步：syncdata.ts SyncBundle schemaVersion 1→2，加 `favorites` 字段（整体 folders 数组）；validateBundle 兼容 v1（无 favorites 视为空）与 v2；collectBundle 从 renderer 采集、apply 回写 localStorage；同步 UI（设置页同步分类）沿用既有流程，加一行「收藏夹」状态。
- R5 夹管理：菜单内重命名/删除（删除=确认对话框文案；删除夹不删站点书签）；重命名走行内输入。
- R6 空态/离线：收藏夹模式离线可用（本地数据）；空夹=空态占位文案。

## Acceptance Criteria

- [ ] AC1 主题页收藏钮 ▾ 可入多夹/多选，重开应用夹内容还在（localStorage）。
- [ ] AC2 工具条「收藏夹」chip 可切换各夹视图，行数据来自快照，离线可看。
- [ ] AC3 WebDAV 同步一轮后 favorites 上云；另一台/重装拉回一致（v1 bundle 拉回不炸）。
- [ ] AC4 重命名/删除/新建夹可用；删夹有确认。
- [ ] AC5 `npm run typecheck`（kb-api WIP 修好后）+ `npm run build` 通过。

## Out of Scope

- 与 Discourse 原生书签的双向同步（站点 API 无夹层概念）
- 收藏夹分享/导出为列表页
- P3 rail 常驻入口

## Constraints

- syncdata.ts/webdav.ts 分区 A（主会话域）；本任务 dispatch 实现代理跨 A+渲染层，注意 kb-api 会话 WIP（SettingsView/externalApi.ts）勿触碰。
- SyncBundle v2 必须向后兼容 v1 读取。
