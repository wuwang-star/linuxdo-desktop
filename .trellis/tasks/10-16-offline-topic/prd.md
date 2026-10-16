# 离线 Topic 保存与离线阅读

## Goal

把主题全量内容存到本地，无网络（或直连不稳）时可完整阅读——解决本机实测「直连 linux.do 超时 21s」场景下的阅读连续性。P2b 父任务第一子项，为 WebDAV 同步备好数据层。

## Background（已确认事实）

- 现有 client.ts 已具备全量拉取能力：fetchTopic（stream 全量 id）+ fetchPostsByIds（分块）；离线保存=按序循环拉全所有分块。
- 存储选型：JSON 文件存储（userData/offline/<id>.json + index.json），**不引入 better-sqlite3**（原生模块构建/打包风险，当前量级不需要；升级路径：条目过千或需索引查询时再上 sqlite）。
- 实测本机直连 linux.do 超时（diag: latest.json 21097ms status 0），离线价值实证。
- 图片为远端 URL，本任务不缓存图片资源（文本离线阅读为 MVP 边界）。

## Requirements

- **R1 离线保存**：TopicView「离线保存」按钮 → 主进程全量拉取该主题（循环分块直至 stream 覆盖）→ 写 `offline/<id>.json`（topic 元信息+全量 posts+savedAt）并更新 index。
- **R2 离线阅读**：离线列表点开即读（不发起网络请求）；在线打开失败且本地有存档时提示「已有离线存档，点击阅读」。
- **R3 列表与删除**：HomeView 工具栏「离线」筛选 chip → index 列表（标题/楼层数/保存时间），行内可进入与删除。
- **R4 快照语义**：离线内容为保存时点快照（新回复不含），显示「保存于 X 前 · N 楼」。

## Acceptance Criteria

- [ ] **AC1** 登录态或游客对任一主题点离线保存 → userData/offline 出现 JSON，index 更新，长帖（>100 楼）楼层数完整。（待人工验收）
- [ ] **AC2** 断网（或代理关断）后从离线列表打开该主题，全文可读、只看楼主/时间轴/已读进度可用。（待人工验收）
- [ ] **AC3** 在线打开失败时有存档则给出离线阅读入口。（待人工验收）
- [ ] **AC4** 删除后文件与 index 同步移除。（待人工验收）
- [x] **AC5** `pnpm run typecheck` 0 错；`pnpm run smoke` SMOKE_OK。（2026-10-16 实测通过）

## Out of Scope

- 图片/附件离线缓存
- 增量更新已存主题（快照语义）
- WebDAV 同步（兄弟任务 10-16-webdav-sync）

## Open Questions

（无）
