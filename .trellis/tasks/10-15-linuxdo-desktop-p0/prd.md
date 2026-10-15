# PRD：LinuxDo 桌面客户端 P0

## 背景

见 `specs/linuxdo-desktop/SPEC.md`（架构决策）与 `.thinkrail/context/TASK-linuxdo-desktop.md`（brainstorm 定稿）。
用户已批准：Electron + Vue 3 + Pinia + TS；完全自建 UI 走 Discourse API；Windows + macOS；不套壳、全部自研。

## P0 范围

1. **脚手架**：electron-vite + Vue 3 + Pinia + vue-router + TypeScript，dev/build/typecheck 可用。
2. **网络层（主进程）**：Discourse 客户端统一出口——浏览器级 UA、429 指数退避（最多 3 次、尊重 Retry-After）、诊断日志（最近 100 条）；与登录窗口共享默认 session（cookie 打通）。
3. **登录**：嵌入式登录窗口（linux.do/login，真实浏览器环境过 CF，检测 `_t` cookie 判定成功）+ 手动 User API Key（safeStorage 加密存储，请求带 Api-Key/Api-Username header）。
4. **主题列表**：latest 无限滚动分页；分类列表 + 分类主题。
5. **主题阅读**：post_stream.stream 全量 id + 分块懒加载（向上加载更早楼层，保持滚动锚点）；已读进度按 topic 本地保存与恢复。
6. **讨论上下文（基础）**：reply_to_post_number 父回复引用与跳转；只看楼主过滤；右侧时间轴（楼层导航）。

## 验收标准

- `npm run typecheck` 与 `npm run build` 零错误。
- `npm run smoke`：打包产物启动 → 窗口创建 → 正常退出（exit 0），stdout 含 `SMOKE_OK`。
- 未登录状态：latest 列表可浏览（公开内容）；点击主题可阅读、向上翻页加载更早楼层。
- 已登录（cookie 或 api-key）：session/current 显示用户名。
- 只看楼主开关生效；reply_to 引用可点击跳转到对应楼层（必要时触发分块加载）。
- 重进同一主题恢复到上次阅读的楼层。

## 范围外（P0 不做）

回复/点赞/收藏写操作、MessageBus 通知、翻译、离线 Topic、WebDAV、托盘/全局快捷键、自动更新、user-api-key RSA 完整流程（P0 提供手动 key，流程留 P1）。
