# 技术设计：双栏主从布局

## 路由与骨架

- 路由改造：`/` 与 `/t/:id` 都指向 `BrowseView.vue`（/t/:id 保留独立 import 以便窄屏？不——统一 BrowseView 内部响应式处理）。`/login`、`/settings` 维持整页。
- BrowseView 骨架：
  ```
  <div class="browse" :data-dual="dual">
    <aside class="list-pane" v-show="showList"><HomeView :pane="true" /></aside>
    <section class="reader-pane">
      <TopicView v-if="activeId" :topic-id="activeId" :offline="offlineFlag" :key="activeId+'-'+offlineFlag" />
      <div v-else class="empty">占位</div>
    </section>
  </div>
  ```
- `dual` = `matchMedia('(min-width:1200px)')` 响应式（listener 同步，AC3 拉宽恢复）。
- `showList`：dual 恒 true；窄屏时 route==='/'' 显示列表、/t/:id 显示 TopicView（router-view 语义由条件渲染模拟——BrowseView 内不再嵌 router-view）。

## 选择态

- 新增 `stores/browse.ts`：`selectedId: number|null`、`offlineFlag: boolean`、`select(id, offline?)`（set + `router.replace('/t/'+id)`，窄屏则 `push`）。
- HomeView 列表点击改为 `browse.select(t.id)`（pane 模式）或原 RouterLink（整页模式）——HomeView 增 `pane` prop 区分。
- activeId 来源：BrowseView 内 watch route（外部跳转如通知/队列）+ store（内部点击）归一：computed `activeId = browse.selectedId ?? (route.name==='topic' ? Number(route.params.id) : null)`；外部 route 变化时同步进 store。
- 队列 prev/next 现走 `router.push` → 落到 route watch 路径，双栏自然工作（AC2）。

## TopicView 参数化

- props：`topicId?: number`、`offline?: boolean`；`const topicId = computed(() => props.topicId ?? Number(route.params.id))`；其余逻辑不变。`:key` 强制换主题时重建组件（store.open 幂等，重建最省心）。
- 离线：store.open(id,{offline}) 已支持，BrowseView 传 flag 即可。

## 样式

- `.browse{display:flex}`；`.list-pane{width:400px;min-width:340px;overflow-y:auto;border-right:1px solid var(--border)}`；`.reader-pane{flex:1;overflow:hidden}`（内部 TopicView 自有 scroller）。
- 窄屏 data-dual=false：单栏全宽。配对码/向导等既有 overlay 不受影响。

## 回滚

新文件 BrowseView/browse store + HomeView/TopicView 少量参数化，整体 revert 即回整页导航。
