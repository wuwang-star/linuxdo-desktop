# 技术设计：离线 Topic

## 结构

| 组件 | 位置 | 说明 |
|---|---|---|
| 离线存储 | 新增 `src/main/api/offline.ts` | dir=`userData/offline/`；`saveTopic(id)`：fetchTopic → 按 stream 顺序循环 fetchPostsByIds（每批 20，进度回调）→ 组装 `{id,title,created_at,posts_count,posts,savedAt}` → 写 `<id>.json`；`listTopics()` 读 index；`getTopic(id)`/`removeTopic(id)`；index.json `[ {id,title,posts_count,savedAt} ]` 与文件同步维护（写文件成功再改 index） |
| IPC | ipc.ts | `offline:save`（返回 {ok,count,error}）、`offline:list`、`offline:get`、`offline:remove`；preload 两件同步 |
| UI 保存 | TopicView.vue | 副标题行「离线保存」按钮（保存中显示进度 n/总数）|
| UI 阅读 | topic store open() | `?offline=1` 强制走 offline:get；在线 fetchTopic 抛错时查 index 有档 → 提示条「网络异常，已有离线存档」+ 按钮 |

| UI 列表 | HomeView.vue | 工具栏「离线」chip → mode `offline`：渲染 index 列表（标题/楼层数/savedAt 相对时间/删除按钮），行点击 `router.push('/t/'+id+'?offline=1')` |
| 样式 | styles.css | `.chip` 复用；离线提示条 `.offline-tip` |

## 关键点

- **全量拉取进度**：saveTopic 以 `(loaded/total)` 通过 ipcMain 事件或直接返回最终值；MVP 用按钮内文字「保存中 n/N」，不搞进度条事件（省 webContents 事件通道）。
- **写入原子性**：临时文件+rename（沿用 writeConfigFile 模式）；index 最后写（崩溃最坏=有文件无索引，列表缺条可接受，注释说明）。
- **快照语义**：posts 存 cooked HTML（与在线渲染同构，PostItem 直接复用）；离线打开时 like/bookmark/reply 操作隐藏（props 传 offline 模式）。
- **429/失败**：分块循环遇错即中止并报已拉取进度，不写半截文件（内存组装，最后一次性写）。

## 权衡

- JSON 文件 vs better-sqlite3：零原生依赖/零打包风险；查询场景只有 index 列表，JSON 足够。升级路径注释在 offline.ts 头部。
- 不缓存图片：体积与复杂度主要来源，MVP 明确边界（离线阅读图片位显示占位）。

## 回滚

offline.ts/相关 UI 独立，可整体 revert；存储目录用户可手删。
