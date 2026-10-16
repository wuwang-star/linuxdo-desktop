# 技术设计：WebDAV 同步

## 结构

| 组件 | 位置 | 说明 |
|---|---|---|
| WebDAV 客户端 | 新增 `src/main/api/webdav.ts` | net.fetch + Basic Auth（btoa user:pass）；`testConn()`（PROPFIND Depth:0，404→{ok,needMkCol:true}）、`ensureDir()`（MKCOL，需逐级建父目录时简化：直接 MKCOL 完整路径，失败则逐段）、`putBundle(json)`、`getBundle()` |
| 配置存储 | settings.ts 模式复制 | `webdav.json`（server/username/remoteDir 明文）+ `webdav.enc`（password safeStorage）；getWebdavConfig/setWebdavConfig（password 留空=不改） |
| 同步数据聚合 | 新增 `src/main/api/syncdata.ts` 或并入 webdav.ts | `collect()`：读阅读进度（定位现有存储后聚合成 map——实现第 0 步先找到 saveProgress 落点）+ 经 IPC 向 renderer 取 ldd-reading prefs（`prefs:getAll`/`prefs:applyAll` 两个新 IPC，renderer 端接 prefs.ts）+ settings 非凭据段；`applyRemote(bundle)` 反向写入 |
| IPC | ipc.ts + preload | `webdav:getConfig/setConfig/testConn/push/pull`、`prefs:getAll/applyAll` |
| UI | SettingsView 新「同步」分类 | 五字段表单 + 测试连接/推送/拉取三按钮 + 结果行；推送/拉取确认文案明示覆盖方向 |

## 关键点

- **进度聚合**：实现第 0 步 grep saveProgress 定位存储（可能 localStorage 或主进程文件）；若 localStorage 则聚合走 prefs 同款 IPC（`progress:getAll/applyAll`）。
- bundle schemaVersion=1；拉取时校验 version 与字段存在性，非法拒绝并提示。
- net.fetch 均带 AbortSignal.timeout(20s)；PROPFIND 401 判定凭据错误文案。
- 密码错误典型表现：PROPFIND 401；服务器差异（坚果云需应用密码）写入 README 提示。

## 权衡

- 手动单向 vs 自动同步：自动需冲突策略与定时器，MVP 明确手动（UI 文案写清方向），后续按需加。
- 最小动词集自研 vs webdav 依赖：自研 ~120 行且走代理栈；依赖引入体积与代理盲区风险（undici 直连问题前科）。

## 回滚

webdav/syncdata/prefs IPC 增量独立，UI 分类独立；整体 revert 无残留。
