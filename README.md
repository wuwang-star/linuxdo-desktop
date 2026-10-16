# linuxdo-desktop

[linux.do](https://linux.do/) 第三方桌面客户端。**Electron + Vue 3 + Pinia + TypeScript**，完全自建 UI 直接消费 Discourse JSON API（不套壳）。

架构决策见 `specs/linuxdo-desktop/SPEC.md`。

## 快速开始

包管理器统一用 **pnpm**（`pnpm-workspace.yaml` 已放行 Electron/esbuild 的构建脚本）。

```bash
pnpm install         # 若 Electron 二进制下载失败：$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; node node_modules/electron/install.js
pnpm run dev         # 开发模式（热重载）
pnpm run typecheck   # 类型检查（node + renderer）
pnpm run build       # 产物构建到 out/
pnpm run smoke       # 冒烟：启动→窗口→SMOKE_OK→自动退出
```

> 注意：pnpm ≥10 默认不执行依赖的 postinstall 脚本；若换环境后报 `Electron uninstall`，确认 `pnpm-workspace.yaml` 的 `allowBuilds` 含 `electron: true`，再补跑上面的镜像命令。不要混用 npm（会产生两套 lockfile）。

## 当前能力（P0）

- 主进程统一 Discourse 客户端：浏览器级 UA、429 指数退避（尊重 Retry-After）、请求诊断（登录页可见）
- 加密 DNS（DoH，实验）：设置基建 + 测试解析按钮已就绪；**当前 Electron 44 下开关不生效**（源码核实，见下），默认关闭
- 登录：嵌入式真实浏览器登录窗口（过 Cloudflare，cookie 与 API 共享默认 session）+ User API Key（safeStorage 加密存储）
- 伴生扩展桥接：Edge 里登录 linux.do 后 `_t` 登录态自动同步进应用（见下「扩展桥接」）
- 最新/分类主题列表，无限滚动
- 主题阅读：post_stream 全量 id + 分块懒加载（向上加载更早楼层、滚动锚点保持）、已读进度保存与恢复
- 讨论上下文：reply_to 父回复跳转（按需加载分块）、只看楼主、右侧楼层时间轴
- 离线阅读：主题页「离线保存」全量快照到本地，断网可完整阅读（首页「离线」列表进入/删除；在线打开失败时自动提示离线入口）
- 设置中心（顶栏「设置」）：外观（主题模式）/ 阅读（排版偏好）/ 网络（DoH）/ 翻译 / 关于 等分类，未登录可直达

## 阅读体感（排版与主题）

设置中心「外观」「阅读」两个分类提供个人偏好，改动即时生效（CSS 变量），存 localStorage（键 `ldd-reading`）：

- **主题模式**：跟随系统（matchMedia 实时切换）/ 亮 / 暗。亮暗两套完整变量组由 `data-theme` 属性单轨切换——JS 按偏好与系统状态写 `documentElement` 属性，CSS 只认 attribute，不再用 `prefers-color-scheme` media query 分叉（消灭双轨竞争）。
- **排版**：正文字号（14–20px）、行距、字体族（系统/衬线/无衬线/等宽）、阅读宽度（全宽/960/1120/1280px 居中）。作用于正文渲染区（楼层 cooked、主题标题、时间轴字体族），设置中心等控件区不受影响；代码块恒为等宽。

## 双栏浏览（宽屏主从布局）

视口 ≥1200px 时「最新」与主题页渲染为双栏主从（BrowseView）：左栏列表常驻（约 400px，滚动位置与「最新/离线/分类」筛选全程保留），右栏阅读；点击左栏主题右栏即时切换，URL `replace('/t/<id>')` 保持可分享可回跳。窄屏（<1200px）自动回退整页导航，拉宽恢复双栏且右栏保持当前主题。队列上一贴/下一贴、通知 `?pn=` 直达楼层、离线 `?offline=1` 均在双栏下工作；未选主题时右栏显示占位。实现要点：`stores/browse.ts` 持有选中态（`select` 只改状态递增 `selectSeq`，URL 由 BrowseView 统一 replace/push，避免 store ↔ router 循环依赖；外部路由跳转经 `syncFromRoute` 归一进 store），TopicView 参数化 `topicId/offline` props（route 兜底），换主题靠 `:key` 重建组件。


## 网络（DoH，实验，当前未生效）

应用内建 DoH 设置基建：设置中心（顶栏「设置」→ 网络）可开关/切模式（secure/auto）/选解析器模板（默认为用户指定自建端点 edge.1molchuan.top，另有 Cloudflare/Google/阿里/自定义），并提供 `resolveHost('linux.do')` 测试解析按钮。

**当前 Electron 44 下 DoH 实际不生效**：`dns-over-https-mode` / `dns-over-https-templates` 是 Chrome 浏览器层命令行开关，Electron 的网络服务不消费（源码核实 v44.0.0 `system_network_context_manager.cc` 硬编码 DoH off），DNS 实际走系统解析。默认关闭、不假装生效；设置与诊断按钮保留，待后续采用本地 DoH 代理或 host-resolver-rules 方案时复用（另立任务）。

## 扩展桥接（Edge 自动同步登录态）

系统浏览器 cookie 沙箱化，应用读不到；伴生 MV3 扩展（仓库 `extension/` 目录，零构建，Edge 开发人员模式加载解压缩即用）是合规桥：浏览器里 linux.do 的 `_t` cookie 一有变化，扩展自动 `POST http://127.0.0.1:17366/ingest` 到应用，走与手动粘贴相同的注入通道，登录态自动更新（登录页约 10s 内可见）。安装与配对步骤见 `extension/README.md`。

- **开关与配对**：登录页 → 方式二卡片 → 「Edge 扩展桥接」。默认关闭；开启即监听 `127.0.0.1:17366`，关闭即停。首次开启生成 6 位数字配对码（可在 UI 重新生成，旧码立即失效），扩展 popup 填一次即可。
- **安全边界**：接收口仅绑定回环 + 配对码校验（码错 401）；`_t` 属敏感会话凭据，扩展与应用两端都只在内存转发、绝不写盘/回显（扩展本地只存配对码与推送结果摘要）。
- **端口语义**：端口固定 17366（扩展 manifest 写死，无法动态配）；被占用时错误透出到登录页 UI，不影响应用其余功能。

## 离线阅读（快照语义）

主题页副标题行「离线保存」：主进程按 post_stream 全量 id 分块拉全所有楼层（每批 20，按钮内实时 n/N 进度），存为 `userData/offline/<id>.json` 快照并维护 `index.json`。首页「离线」chip 列出全部存档（标题/楼层数/保存时间），点开走 `?offline=1` 纯本地阅读，不发起任何网络请求。

- **存储选型**：JSON 文件而非 better-sqlite3——零原生依赖/零打包风险，查询场景只有 index 列表，JSON 足够；条目过千或需索引查询时再迁 sqlite（只改 `src/main/api/offline.ts` 读写层）。
- **快照语义**：保存时点快照，新回复不含（重存即更新）；离线打开时点赞/回复/收藏/编辑/翻译等网络操作隐藏，只看楼主/时间轴/已读进度照常可用。
- **边界**：不缓存图片/附件（离线阅读文本为 MVP 边界，离线时图片无法加载，显示浏览器默认占位）；分块中途失败即中止，绝不写半截文件。

## 打包与发版（Windows）

```bash
pnpm run dist        # 产物：dist/LinuxDo Desktop-<版本>-setup.exe（NSIS 双击即装，per-user）
                     # 另有 dist/win-unpacked/（免安装目录，可直接 smoke："./LinuxDo Desktop.exe" --smoke）
```

- 首次构建会下载 NSIS/winCodeSign 工具链；失败/超时设镜像后重试：
  `$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"`（与 ELECTRON_MIRROR 并列）。
- 图标：`build/icon.png`（512px，占位设计）由 `node build/gen-icon.mjs` 生成（纯 Node 标准库，零依赖）；正式设计定稿后直接替换该 png 重打，electron-builder 自动转 ico。
- **发版三步**：改 `package.json` 版本号 → `pnpm run dist` → 到 GitHub Release 上传 `*-setup.exe` 与 `.blockmap`（repo 待定，见下）。
- **自动更新**（electron-updater，GitHub Releases 通道）：仅打包态启用；`electron-builder.yml` 未配置 `publish` 时更新自动跳过（无 `app-update.yml` 即不初始化），一切错误静默。repo 就绪后填入 publish 段的 owner/repo 并重打安装包即接通；发版时上传新版产物，已装客户端启动 30s 后检查并提示重启安装。
- 无代码签名证书：SmartScreen 会告警（风险已接受，自用不阻塞）；macOS 构建与签名后置另立任务。

## 安全边界

- 登录凭据只存本机（safeStorage 加密），不参与任何同步/导出
- FluxDO（GPL-3.0）仅参考行为，未复用任何代码
