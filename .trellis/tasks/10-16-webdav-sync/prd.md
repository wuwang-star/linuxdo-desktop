# WebDAV 同步

## Goal

用户自备 WebDAV（坚果云/InfiniCloud/自建等），把本地阅读数据手动推送/拉取到云端：阅读进度、阅读体感偏好、非凭据设置。P2b 父任务第二子项（依赖 offline-topic 已建的数据层认知，但其本身只同步轻量 JSON）。

## Background（已确认事实）

- 阅读进度现状：TopicView saveProgress 按 topic 本地保存（实现者需先定位存储位置并聚合成 map 供同步）。
- 凭据边界：WebDAV 密码 safeStorage 加密；同步 bundle **绝不包含** translate key/connect secret/_t（ALDR omittedSecrets 模式）。
- WebDAV 客户端不引第三方包：用 net.fetch（走系统代理）实现最小动词集 PROPFIND/MKCOL/PUT/GET + Basic Auth。
- 阅读体感偏好存 renderer localStorage（ldd-reading）——同步需 main↔renderer 搬运（经 IPC 取/写）。

## Requirements

- **R1 配置**：设置中心新「同步」分类：服务器 URL、用户名、密码（safeStorage）、远端目录（默认 `/linuxdo-desktop/`）、测试连接按钮。
- **R2 同步 bundle**：单 JSON（schemaVersion/exportedAt/readingProgress{topicId:楼层}/readingPrefs/settings 非凭据段），推送=PUT bundle 到远端目录，拉取=GET 覆盖本地。
- **R3 手动操作**：推送/拉取两按钮 + 各自结果反馈；**无自动合并**（推送覆盖远端、拉取覆盖本地，UI 明示方向）；冲突场景用户自选方向。
- **R4 测试连接**：PROPFIND 远端目录，404 时提示「目录不存在，推送时将自动创建（MKCOL）」。

## Acceptance Criteria

- [ ] **AC1** 测试连接：正确凭据→成功提示；错误凭据→401 明示；目录不存在→提示将自动创建。（留人工实测）
- [ ] **AC2** 推送后远端目录出现 bundle JSON；修改本地进度/偏好 → 再次推送 → 远端更新。（留人工实测）
- [ ] **AC3** 拉取：远端 bundle 的进度与偏好覆盖本地并即时生效（排版变化可见）。（留人工实测）
- [x] **AC4** 密码 safeStorage 加密落盘，bundle/日志/界面不回显。（静态核实：webdav.enc safeStorage；getWebdavConfig 只出 hasPassword；bundle settings 段仅非凭据字段）
- [x] **AC5** typecheck 0 错 + smoke SMOKE_OK。（2026-10-16 实测通过）

## Out of Scope

- 自动/定时同步、冲突合并
- 离线 Topic 正文同步（体积大，后续评估）
- _t cookie 同步（安全边界）

## Open Questions

（无——手动单向 MVP，冲突策略明确）
