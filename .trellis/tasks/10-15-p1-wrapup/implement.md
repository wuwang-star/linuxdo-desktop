# 执行计划：P1 收尾

## 顺序清单

1. [ ] 清理构建残留：`git rm -r --cached src/renderer/out-verify` → 物理删除目录 → `.gitignore` 追加 `src/renderer/out-verify/`。
2. [ ] 归档旧任务：跑 `pnpm run smoke` 留 SMOKE_OK 证据；旧 p1 prd 验收段按实际交付改写（回复/点赞/收藏/通知列表/翻译=已交付；MessageBus/Reactions 延后，MessageBus 转入本任务）；`python ./.trellis/scripts/task.py archive` 归档旧 p0、p1。
3. [ ] 编辑后端：client.ts 追加 `fetchPostRaw`/`updatePost`（CSRF），ipc.ts 注册 `post:getRaw`/`post:update`，preload/index.d.ts 同步类型。
4. [ ] 编辑前端：PostItem 编辑按钮（`can_edit`）+ TopicView composer 编辑模式（预填 raw、保存就地更新）。
5. [ ] MessageBus 主进程：先写实测 probe 确认频道名/请求编码/响应形态 → 新建 main/api/messagebus.ts（长轮询+重连退避）→ ipc 注册 start/stop/status + `notification:push` 推送。
6. [ ] 通知实时接入：renderer 通知 store 订阅 `notification:push` 更新徽标/toast；实时不可用回退手动刷新。
7. [ ] 队列：stores/queue.ts（localStorage 持久化）→ HomeView/TopicView 入队按钮 → 上一贴/下一贴 → App 顶栏队列 chip 与下拉列表。
8. [ ] 收尾：SPEC.md 补记 MessageBus 实测结论与编辑端点；本任务 prd 勾验收；`trellis-check` 全量检查。

每步完成后跑 `pnpm run typecheck`。

## 验证命令

- `pnpm run typecheck`（每步）
- `pnpm run smoke`（步骤 1 后、收尾）
- 手工验收：dev 模式 cookie 登录 → 网页端回复 @自己 → 30s 内徽标/toast（AC1）；入队 3 个主题顺序读+重启验证（AC2）；编辑自己楼层、观察他人楼层无入口（AC3）。

## 风险文件与回滚点

- `src/main/api/client.ts`：只追加函数、不动既有 request 封装（低风险）。
- `src/main/api/messagebus.ts`：全新文件，删除即回退。
- 步骤 5 实测失败处理：按抓包结果修正解析器；长轮询整体不通则降级 15s 短轮询（AC1 仍满足），该降级决定记录进 SPEC。

## task.py start 前检查

- [ ] implement.jsonl / check.jsonl 含真实条目（非占位）
- [ ] prd/design/implement 三件套齐
- [ ] 用户已批准最终规划摘要
