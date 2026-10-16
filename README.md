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
- 加密 DNS（DoH）：本地代理解析真实现（设置中心「网络」开启，保存即时生效）；默认关闭
- 登录：嵌入式真实浏览器登录窗口（过 Cloudflare，cookie 与 API 共享默认 session）+ User API Key（safeStorage 加密存储）
- 伴生扩展桥接：Edge 里登录 linux.do 后 `_t` 登录态自动同步进应用（见下「扩展桥接」）
- 最新/最热/Top/分类主题列表，无限滚动（Top 榜支持周/月/全部周期切换；hot 通道 2026-10-16 抓包核实与 latest 同构、`more_topics_url:"/hot?page=1"` 分页）
- 列表页搜索（`search.json`）：搜索框嵌列表区展示结果（不新建路由），支持 `@用户` / `#分类` / `order:latest` 操作符（服务端解析）；翻页上限 10 页（上游限制，空页即止）
- 站内导航：正文 `/t/` 内链一律应用内打开（同贴跳楼层、异贴双栏右栏加载），其余链接交系统浏览器；正文图片点击灯箱放大
- 用户卡片与主页：点击头像/用户名弹出用户卡片，可进入用户主页（UserProfileView 独立路由）
- 阅读队列：主题页手动入队，按入队顺序上/下一贴（页内按钮或全局键 Alt+Shift+N）
- 主题皮肤工坊：外观分类可切换皮肤，纯 CSS 主题包格式 v1（token 覆盖单一路径），内置「飞书」样例皮肤
- 站内 gamification 排行榜已排除：`/leaderboard.json` 实测 not_found，非原站功能（用户所见排行榜来自第三方工具 LDStatus Pro 自有服务）
- 主题阅读：post_stream 全量 id + 分块懒加载（向上加载更早楼层、滚动锚点保持）、已读进度保存与恢复
- 讨论上下文：reply_to 父回复跳转（按需加载分块）、只看楼主、右侧楼层时间轴
- 离线阅读：主题页「离线保存」全量快照到本地，断网可完整阅读（首页「离线」列表进入/删除；在线打开失败时自动提示离线入口）
- 设置中心（顶栏「设置」）：外观（主题模式）/ 阅读（排版偏好）/ 网络（DoH）/ 翻译 / 同步（WebDAV）/ 快捷键 / 关于 等分类，未登录可直达

## 阅读体感（排版与主题）

设置中心「外观」「阅读」两个分类提供个人偏好，改动即时生效（CSS 变量），存 localStorage（键 `ldd-reading`）：

- **主题模式**：跟随系统（matchMedia 实时切换）/ 亮 / 暗。亮暗两套完整变量组由 `data-theme` 属性单轨切换——JS 按偏好与系统状态写 `documentElement` 属性，CSS 只认 attribute，不再用 `prefers-color-scheme` media query 分叉（消灭双轨竞争）。
- **排版**：正文字号（14–20px）、行距、字体族（系统/衬线/无衬线/等宽）、阅读宽度（全宽/960/1120/1280px 居中）。作用于正文渲染区（楼层 cooked、主题标题、时间轴字体族），设置中心等控件区不受影响；代码块恒为等宽。
- **视图模式**：阅读页副标题行「时间流 / 树形」分段切换（存 `ldd-reading` 键 `viewMode`，默认时间流）。树形按 `reply_to_post_number` 把回复聚合到父楼下逐层缩进（每层 16px + 左引导线，深度上限 3 层）；父楼未加载的回复作为根显示（自带「↩ 回复 #N」徽标），向上加载补齐后自动归位；只看楼主在过滤后的集合上重建树。
- **皮肤工坊**：主题模式之上可叠加皮肤包（设置中心「外观」切换）。包格式 v1 为纯 CSS 单路径——token 覆盖由主题包自己的 `:root{}` / `:root[data-theme='dark']{}` 承载，应用顺序 prefs 基础变量 → 主题包覆盖；内置「飞书」样例（`assets/themes/feishu.ts`），见 `utils/themes.ts`。

## 双栏浏览（宽屏主从布局）

视口 ≥1200px 时「最新」与主题页渲染为双栏主从（BrowseView）：左栏列表常驻（约 400px，滚动位置与「最新/离线/分类」筛选全程保留），右栏阅读；点击左栏主题右栏即时切换，URL `replace('/t/<id>')` 保持可分享可回跳。窄屏（<1200px）自动回退整页导航，拉宽恢复双栏且右栏保持当前主题。队列上一贴/下一贴、通知 `?pn=` 直达楼层、离线 `?offline=1` 均在双栏下工作；未选主题时右栏显示占位。实现要点：`stores/browse.ts` 持有选中态（`select` 只改状态递增 `selectSeq`，URL 由 BrowseView 统一 replace/push，避免 store ↔ router 循环依赖；外部路由跳转经 `syncFromRoute` 归一进 store），TopicView 参数化 `topicId/offline` props（route 兜底），换主题靠 `:key` 重建组件。


## 网络（DoH）

应用内建 DoH 加密解析：设置中心（顶栏「设置」→ 网络）可开关/切模式（secure/auto）/选解析器模板（默认为用户指定自建端点 edge.1molchuan.top，另有 Cloudflare/Google/阿里/自定义），并提供「测试解析 linux.do」按钮（按运行态显示 DoH/系统解析来源）。

**实现方式**：主进程本地 HTTP CONNECT 代理（127.0.0.1 随机端口）+ `session.setProxy` 接管，目标域名经 DoH 上游解析后直连，保存即时生效。模式语义：secure=仅加密解析（失败即断）；auto=加密优先、失败回退系统 DNS。默认关闭。

注意：开启期间应用流量改走本地代理直连，**不再使用系统代理（Clash 等）**；关闭即还原。Chromium 浏览器层的 `dns-over-https-*` 命令行开关在 Electron 44 下不生效（源码核实，见 SPEC），保留接线仅为备上游支持。

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

## WebDAV 手动同步（阅读数据）

设置中心「同步」分类：填 WebDAV 服务器地址 / 用户名 / 密码 / 远端目录（默认 `/linuxdo-desktop/`）。「测试连接」验证凭据与目录（目录不存在属预期，推送时自动 MKCOL 创建，含多级逐段兜底）；「推送到云端」/「从云端拉取」手动单向同步**阅读进度、阅读偏好与非凭据设置**（DoH/通知/翻译端点）。无自动合并：**推送=本地覆盖云端，拉取=云端覆盖本地**，按钮旁固定标注方向，冲突时自行选择方向。

- **坚果云**：需使用「账户信息 → 安全选项 → 添加应用密码」生成的应用密码，网页登录密码会认证失败（401）。
- **凭据边界**：同步 bundle（远端固定文件 `linuxdo-sync.json`）只含进度/偏好/非凭据设置，绝不含 WebDAV 密码、翻译 Key、登录 cookie（`_t`）等任何 secret；WebDAV 密码 safeStorage 加密只存本机（`webdav.enc`），界面/日志/bundle 一律不回显。
- **实现**：`net.fetch`（走系统代理）自研最小动词集 PROPFIND/MKCOL/PUT/GET + Basic Auth（20s 超时），零第三方依赖；进度存 renderer localStorage（`ldd:progress:<id>`），经 IPC 在 main↔renderer 间聚合/回写。

## 全局快捷键

应用最小化、隐藏到托盘或失焦时仍可触发的系统级组合键（设置中心「快捷键」分类管理，切换即时生效，无需重启）：

- **Alt+Shift+L 呼出主窗**（默认开启）：从最小化 / 托盘 / 失焦状态恢复并聚焦主窗口。
- **Alt+Shift+N 队列下一贴**（默认关闭）：按入队顺序切到阅读队列的下一个主题——需正在阅读队列中的主题，无下一贴不动作；默认关闭是因为全局组合键可能与系统 / 其他应用冲突。

组合键被其他应用占用时，对应开关下方显示注册失败提示，且不影响另一项。固定组合，暂不支持自定义录制。

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
