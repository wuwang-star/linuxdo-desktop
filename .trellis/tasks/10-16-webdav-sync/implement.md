# 执行计划：WebDAV 同步

0. [x] 定位阅读进度存储（grep saveProgress），确定聚合/回写通道。（renderer localStorage `ldd:progress:<id>`，stores/topic.ts；聚合/回写走 main↔renderer 请求-应答 IPC）
1. [x] webdav.ts：配置存储（safeStorage 密码）+ 客户端（testConn/ensureDir/putBundle/getBundle，20s 超时）。（net.fetch 原生支持 PROPFIND/MKCOL，探针实测）
2. [x] syncdata/聚合：collect/applyRemote（进度+ldd-reading+settings 非凭据；prefs 与 progress 的 IPC 通道）。
3. [x] ipc + preload 两件：webdav:* 与 prefs/progress 通道。
4. [x] SettingsView「同步」分类：表单+三按钮+结果行+覆盖方向文案。
5. [x] README/SPEC 补记（bundle schema、坚果云应用密码提示、凭据边界）。
6. [x] typecheck（每步）+ smoke；prd 勾 AC4/AC5 静态项，AC1–AC3 留人工。（typecheck 0 错 + SMOKE_OK，2026-10-16）

## 验证

- 手工：坚果云或自建 WebDAV 实测 AC1–AC3；错误密码 401 提示。
