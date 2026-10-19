# implement — 多收藏夹与云同步

design 决策并入 prd（数据模型/通道/边界均已在 R1-R6 定死）。执行顺序：

1. `stores/favorites.ts`（模型+localStorage+快照条目）。
2. TopicView 收藏钮 ▾ 菜单（勾选态+新建/重命名/删除）。
3. ListMode `{type:'favorites';folderId}` + topicList store 分支（无网络请求，本地过滤）+ HomeView 工具条「收藏夹 ▾」chip。
4. syncdata.ts v2：SyncBundle.favorites + collect/validate/apply 三处 + 设置页同步分类一行状态。
5. 离线/空态文案。

## 验证

```bash
npx vue-tsc --noEmit -p tsconfig.web.json --composite false   # renderer 门（注意：全局 npm run typecheck 因 kb-api 会话 externalApi.ts WIP 暂红，非本任务范围）
npm run build
```
手测：入夹→重开→上云→改→拉回。

## 回滚

单提交 revert；SyncBundle v2 读取兼容 v1，无迁移风险。
