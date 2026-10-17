# implement — 飞书版 IM 外框架改版

按序执行，每步可独立验证；全程遵守 coordination.md 铁律（动公用文件前已登记）。

## 步骤

1. **tokens**：tokens.css 尾部追加 `/* @scope: feishu-im-frame */` 变量组（亮+暗两套），不动既有变量。
2. **shell.css**：新建 `assets/styles/shell.css`（rail/壳布局/win-btns/队列浮层/空态），main.ts 按序引入（base 之后、部位文件区）。样式从 `research/feishu-im-frame-mockup.html` tokens 化移植。
3. **RailNav.vue**：新建组件（结构/逻辑见 design §2）；prefs 加 `railCollapsed` 读写；App.vue 模板重构——删 topbar 段、挂 RailNav、win-btns 迁 shell 层 absolute、拖拽区标注；script 中通知/MessageBus/主题逻辑保留。
4. **HomeView 列表飞书化**：先读 `main/api/client.ts` DiscourseTopicLite 确认可用字段（last_poster_username/posters/usersById），按 design §4 改行结构与摘要行；home.css 对应段。
5. **BrowseView**：reader-pane 白底通铺+空态改造；双栏判定/路由同步不动。
6. **TopicView thread 折叠**：删 viewMode；实现聚类纯函数+折叠渲染+只看楼主+楼主角标+jump 自动展开；topic.css 追加折叠/页签/callout 段，清理旧树形段。
7. **topbar.css 处置**：文件头注明 deprecated，内容清空（确认无他文件引用后）。
8. **收尾检查**：grep `viewMode`/`topbar`/`queue-wrap` 残留引用；拖拽区 no-drag 反标检查。

## 验证

```bash
npm run typecheck
npm run build
```

人工验收（用户）：AC1-AC7 对应真机项，mockup 为视觉对照。

## 回滚点

单提交批次；`git revert <commit>` 整体回退回旧顶栏布局。

## Review gate

- 主会话内联 typecheck+build 冒烟（不派全量评审子代理——用户 2026-10-16 决策）。
- 提交前 `git diff` 核对：coordination.md 登记段、公用文件无他人段误删。
