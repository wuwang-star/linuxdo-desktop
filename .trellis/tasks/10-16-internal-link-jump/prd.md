# PRD: 正文内链跳转重做

## Goal

cooked 正文内 /t/ 链接应用内打开（同主题跳楼层、异主题路由进右栏），其余链接走系统浏览器；主进程 will-navigate 兜底防窗口被导走。

## 背景

`.cooked` 正文为 v-html 渲染，目前**无任何链接点击拦截**：

- 站内链接（`https://linux.do/t/...`，含 quote 引用块的楼层跳转链接）点击后把整个应用窗口导航去原站，SPA 被冲掉——必须重做。
- 外链（Discourse 默认加 `target="_blank"`）已被主进程 `setWindowOpenHandler`（src/main/index.ts:100）接住走系统浏览器，行为正确，保持。

## Requirements

1. 正文（含 quote aside）内所有 `<a href>` 点击被拦截，不再发生整窗导航。
2. 站内 `/t/` 链接在应用内打开：
   - 同主题（topic_id 相同）→ 跳到目标楼层（复用 `store.jumpTo` + flash），无楼层号回顶部。
   - 异主题 → `router.push('/t/<id>?pn=<n>')`，双栏开右栏、窄屏整页，复用通知跳转同款语义。
3. 其余一切链接（外部 http/https、`/u/`、`/c/`、uploads、mailto 等）→ 系统浏览器打开（经现有 window-open handler，不加新 IPC）。
4. 主进程 `will-navigate` 兜底：非应用自身 URL 的一律 `preventDefault` + `shell.openExternal`，防任何漏拦路径把窗口导走。
5. 离线模式下同主题跳楼层照常（快照全量已加载）；异主题走在线打开，失败有既有离线回落提示。

## 约束

- 双栏/窄屏整页共用一套逻辑（挂在 TopicView 滚动容器，PostItem 不动）。
- 本站 host 判断用 renderer 局部常量 `https://linux.do`（main 的 BASE_URL 带 electron 依赖，不给 renderer 引）。
- 不新增依赖、不加 IPC。

## Acceptance Criteria

- [ ] AC1: 正文点站内主题链接（含楼层号），双栏右栏切到该主题并定位楼层；窄屏整页等效。
- [ ] AC2: 正文点同主题 quote 楼层链接，不重载，滚动到目标楼层并 flash。
- [ ] AC3: 正文点外部链接、用户/分类/上传链接，系统浏览器打开，应用窗口原地不动。
- [ ] AC4: 任何路径触发窗口级 `will-navigate` 到非应用 URL 时被拦下转系统浏览器。
- [ ] AC5: typecheck + build 冒烟通过。

## Notes

- 跳转复用现有 `pendingJump` / `?pn=` 消费链路，无新机制。
