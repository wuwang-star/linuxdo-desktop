# 技术设计：P1 收尾

## 架构边界

沿用不变量：linux.do 网络只走主进程。

| 改动 | 位置 | 说明 |
|---|---|---|
| MessageBus 长轮询 | 新增 `src/main/api/messagebus.ts` | 独立生命周期（start/stop/重连退避），直接用 Electron `net`，**绕开 client.ts 的统一 request 封装**（429 退避/重试语义不适用于 30s 挂起的长轮询）；凭据仍来自 auth 的共享 cookie 会话 |
| 编辑 API | `src/main/api/client.ts` 追加 | `fetchPostRaw(id)`（GET /posts/{id}.json，取 raw）、`updatePost(id, raw)`（PUT /posts/{id}.json，form-encoded，走既有 request 封装与 CSRF 逻辑） |
| 队列 store | 新增 `src/renderer/src/stores/queue.ts` | 纯本地状态（Pinia + localStorage 键 `ldd-queue`），不发任何请求，不经 IPC |
| IPC | `src/main/ipc.ts` | 新增 `post:getRaw`、`post:update`、`messagebus:start/stop/status`；推送用 `webContents.send('notification:push', payload)` |

## MessageBus 细节

- poll URL：`https://linux.do/message-bus/<uuid>/poll`，uuid 每次启动随机生成。
- 请求体：表单编码，每订阅频道携带 last_seen_id（键名是否带 `message_bus_` 前缀以首包实测为准）。
- 实现第 0 步实测（probe）：登录态下发一次真实 poll，确认 `/notification/<user_id>` 频道名、请求编码、响应是完整 JSON 数组还是 chunked 流式，再定解析器。
- 响应兼容两种形态：完整 JSON 数组（一次 await body）与 chunked 流式（`data` 事件增量读，按 message_bus 分块分隔符切分）。实测结果支持哪种就只实现哪种。
- last_seen_id 存内存：进程重启从 0 重拉 backlog，通知 store 按 notification id 幂等去重即可；断线重连携带最后 seen id 续传。
- 生命周期：cookie 登录态就绪后 start；登出/未登录不启动；连续失败 N 次后进入回退模式（renderer 退回手动轮询，AC1 时限由 15s 短轮询兜底仍可满足）。

## 队列 UI

- 入队/移除：HomeView 行尾按钮；TopicView 副标题行按钮。
- 导航：队列非空时 TopicView 显示"上一贴/下一贴"，`router.push('/t/<相邻id>')`，顺序即入队顺序。
- 总览：App 顶栏队列 chip 显示待读数，点开下拉列表（跳转/移除/清空）。

## 编辑流

- PostItem 条件渲染"编辑"（`post.can_edit === true`，权限判断以 API 为准，前端不做第二套规则）。
- 点击 → `fetchPostRaw` 取原文 → 复用 TopicView composer（新增编辑模式，预填）→ 提交 `updatePost` → 就地更新 store 中该楼的 cooked 内容；失败保留原文显示错误。

## 兼容与回滚

- 无数据迁移；localStorage 新键，旧版本无感知。
- R1–R4 相互独立，各自单独 commit，可独立 revert。
- messagebus.ts 为全新文件，不 start 即完全回退现有行为；编辑/队列均为增量改动。

## 权衡记录

- 长轮询 vs 短轮询：roadmap 定稿 MessageBus；若实测站点对第三方客户端禁用长轮询，降级为 15s 短轮询（AC1 的 30s 时限仍满足），设计不变、仅换 transport。
- 队列持久化放 renderer localStorage 而非主进程设置文件：队列属 UI 状态、无敏感数据，省一条 IPC 与加密存储复杂度。
