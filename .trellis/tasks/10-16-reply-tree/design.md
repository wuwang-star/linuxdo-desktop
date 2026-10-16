# 技术设计：评论树形

## 结构

| 组件 | 位置 | 说明 |
|---|---|---|
| 树构建 | `stores/topic.ts` | getter `treePosts`：由 visiblePosts 建 `Map<post_number, post[]>`（children 表）→ 输出带 `depth` 的渲染数组（DFS：根按楼层号序，children 按楼层号序，depth>3 钳制）|
| 视图切换 | `prefs.ts` 增 `viewMode: 'stream'|'tree'` | TopicView 副标题行 seg 切换（复用 .seg 组件）|
| 渲染 | `TopicView.vue` | stream 分支=现有 v-for；tree 分支=v-for `treePosts` 外包 `.reply-tree` 容器，`:style="{marginLeft: depth*16+'px'}"` + `.thread-line`（border-left）|
| prefs | utils/prefs.ts | 增字段 + 归一化（枚举校验）|

## 关键点

- 根判定：`!p.reply_to_post_number || !loadedNumbers.has(p.reply_to_post_number)`；父楼 subsequently 加载后 computed 自动重算归位（AC2）。
- 只看楼主：visiblePosts 已是过滤结果，树在过滤集上重建——OP 的回复链中非 OP 中间楼会成根（语义正确：过滤视图的树）。
- 树形下 pendingJump/jumpTo 按楼层号 `scrollIntoView` 不变（DOM 仍含全部楼层）。
- 缩进用 margin 而非嵌套 DOM（ cooked 宽度变量与 PostItem 复用零改动）。

## 回滚

viewMode 默认 stream = 现状；treePosts getter 与分支渲染可独立 revert。
