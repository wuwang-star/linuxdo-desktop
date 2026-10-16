---
id: spec-linuxdo-desktop
type: architecture-design
status: active
title: LinuxDo 桌面客户端架构（Electron + Vue 3 自建 UI）
tags: [linuxdo, discourse, electron, vue3, desktop]
---

## 驱动

linux.do（Discourse）的第三方桌面客户端，Windows + macOS。参考 FluxDO（Flutter，GPL-3.0，仅参考行为不复用代码）与 Awesome LinuxDo Reader（MIT，仅参考设计）。MVP 重点：连续阅读工作区、楼中楼/讨论上下文、翻译/离线/同步、桌面壳能力。

## 决策

1. **完全自建 UI + Discourse JSON API**，不做原站套壳；不内嵌 ALDR，全部自研。
2. **Electron**（非 Tauri）：单一 TS 语言栈；Win/mac 同 Chromium 内核；嵌入式登录窗口可与 API 请求共享 cookie jar（CF 兜底）；生态适合新手。代价是体积/内存，可接受。
3. **Vue 3 + Vite + Pinia + TypeScript**；构建链 electron-vite；打包 electron-builder + electron-updater（GitHub Releases）。
4. **网络层在主进程**：所有 linux.do 请求经主进程统一出口（浏览器级 UA、限流退避、诊断），renderer 只经 IPC 消费，避免 renderer 侧 CORS/CF 问题。
5. **登录通道（2026-10-15 实测定稿）**：linux.do 管理员已禁用 Discourse user-api-key 自助申请（`/user_api_key/new` 返回"页面不存在或是不公开"），普通用户无从申请。主通道 = 嵌入式浏览器登录（真实浏览器环境过 CF，`_t` cookie + `flushStore` 落盘，重启保留）；测试通道 = 手动注入 `_t` cookie；user-api-key 完整流程（RSA+nonce+协议回调）保留在代码中以备站点开放或用于其他 Discourse 站点。另调研 linux.do Connect（OIDC）：scopes 仅 openid/profile/email（身份联邦），无论坛 API 权限，不适用于本客户端的会话需求。
6. FluxDO 代码 GPL-3.0：禁止复制；API 端点知识可自由使用。ALDR MIT：亦不复用代码，仅参考设计。

## 不变量

- linux.do 站点私有插件端点（Reactions/Boost/Voting）实现前必须抓包核实，并集中封装在 API 客户端层。
- API 客户端必须内置：浏览器级 UA、429 指数退避、错误诊断信息透出。
- 登录凭据（api key / cookie）只存本机（safeStorage 加密），永不进同步/导出。

## 范围之外

- Linux 平台、移动端（FluxDO 已覆盖移动场景）。
- 原站替代（不镜像 linux.do 内容服务）。
- P2 之后的 VoIP/音视频通话等站内不存在的功能。

## P1 收尾实测与端点记录（2026-10-15）

### MessageBus 实时通知

- 端点：`POST https://linux.do/message-bus/<uuid>/poll`（uuid 每次启动随机），表单体 key=频道名、value=last_seen_id。
- **频道名按 `/notification/<user_id>` 实现，请求编码与响应形态未经登录态实测，待手工验收确认**（本机无登录 cookie；站点公开端点匿名 429）。实现于 `src/main/api/messagebus.ts`：长轮询独立生命周期（不走 client.ts 统一封装，429 退避语义不适用于 30s 挂起请求），我方 65s 超时按空轮询处理；响应解析自适应兼容完整 JSON 数组与流式分块（`/频道\n消息id\njson\n`）两种形态；连续失败 3 次进入回退（renderer 退回 60s 手动轮询，本会话不自动复活，重新登录且切换账号时可重置）。
- last_seen_id 存内存：重启从 0 重拉 backlog；push 仅触发全量 `auth.refresh()`，幂等由服务端状态重算保证；断线重连携带最后 seen id。

### 帖子编辑端点

- 读原文：`GET /posts/{id}.json`（单楼接口含 `raw` 与 `can_edit`；列表/流接口不含 raw）。
- 提交编辑：`PUT /posts/{id}.json`，form-encoded，参数为 Rails 嵌套键 `post[raw]`（`post[edit_reason]` 可空），走既有 CSRF 逻辑。编辑入口仅 `can_edit === true` 时渲染，权限判断以 API 为准。

### 阅读队列

- 纯 renderer 本地状态（Pinia + localStorage 键 `ldd-queue`），不发请求不经 IPC，无敏感数据不入 safeStorage。

### DoH 加密 DNS（P2，2026-10-15；评审后改判「开关无效，暂不生效」）

- **评审结论（源码级核实）**：`dns-over-https-mode`/`dns-over-https-templates` 是 Chrome 浏览器层开关（chrome/common/chrome_switches），Electron 的网络服务不消费——`shell/browser/net/system_network_context_manager.cc` 的 `OnNetworkServiceCreated` 硬编码 `SecureDnsMode::kOff`（v44.0.0 核实）。`src/main/index.ts` 的命令行开关接线为空转（保留以备上游支持），**DNS 实际走系统解析**。
- 本任务交付：设置基建（`settings.ts`：默认 enabled=false、mode=secure、template=`https://edge.1molchuan.top/linuxdo`（用户指定自建端点，2026-10-16 起为默认，旧值 Cloudflare 仍为预设之一）；模板必须 `https://` 合法 URL，规范化为 href、含空白拒绝，非法静默回退默认；`dohEnabled` 布尔归一防脏数据；配置原子写盘——临时文件 + rename，防半截 JSON 毁掉同文件 translate 配置）+ `diag:resolveDns` 诊断按钮（`resolveHost('linux.do')`，Electron 44 已移除 resolveDNS，用替代 API）。UI 顶部明示「实验功能：暂未生效」。
- 真实现路径（另立任务）：本地 DoH 代理 + `host-resolver-rules` 映射，或上游 Electron 消费浏览器层开关后直接复用现有接线。届时 mode 语义：secure=仅加密解析（失败即断）；auto=加密优先、失败回退系统 DNS（DoH 域被墙环境切 auto）。

### P2a 打包分发（2026-10-16）

- **electron-builder 配置**（`electron-builder.yml`）：appId `com.linuxdo.desktop` / productName `LinuxDo Desktop`；`files: out/**`（electron-builder 自动追加 package.json 与生产依赖 node_modules）；asar 开；NSIS oneClick per-user；产物 `dist/LinuxDo Desktop-<ver>-setup.exe` + `win-unpacked/`。
- **依赖归位**：vue/pinia/vue-router 移入 devDependencies（electron-vite 已整体打进 renderer 资产，进 `dependencies` 只会白白进 asar）；运行时依赖仅 `electron-updater`。
- **图标**：`build/icon.png` 512px 占位（圆角靛蓝底+白 L+橙点），由 `build/gen-icon.mjs` 生成——纯 Node 标准库（zlib + 手写 CRC32，2×2 超采样），零依赖；替换 png 重打即可换正式图标。托盘/安装包共用；托盘图标 dev 取 `build/`、打包取 `resources/icon.png`（extraResources），Windows 下 resize 16px。
- **踩坑记录**：`publish: never` 在 electron-builder 26 不是合法值——会去找名为 "never" 的 publisher 模块报 `Cannot find module for publisher "never"`。不想上传就整体省略 publish 键（本地无 GH_TOKEN 时本来就不上传）。
- **自动更新降级链**（`src/main/updater.ts`）：dev 完全不启用；publish 未配置 → 打包产物无 `resources/app-update.yml`（已实测）→ existsSync 守卫直接不初始化；检查/下载失败 logger 关闭 + catch 全静默。启用方式：builder.yml 填 publish owner/repo 重打。行为：启动延迟 30s 单次检查，`update-downloaded` 弹原生通知，点击聚焦，重启即装。
- **托盘与关窗语义**：`appIsQuitting` flag + `before-quit` 置位；点 × → `preventDefault + hide()` 驻留托盘，托盘菜单「退出」才真退。`win.ts focusMainWindow()` 为托盘点击/通知点击/second-instance 三处共用恢复+聚焦。
- **原生通知**（`src/main/notify.ts`）：MessageBus push → 主进程 `Notification`；payload 字段防御式提取（`topic_id`/`post_number`/`data.topic_title`，与频道名同一校正点：未经登录态实测），缺 `topic_id` 降级为点击仅聚焦、不猜字段。点击 → `notification:open` IPC → renderer `router.push('/t/<id>?pn=<n>')`（TopicView ?pn 直达楼层）。
- **协议注册（安装态）**：`index.ts` 的 `process.defaultApp` 分支仅 dev 生效；打包态 `setAsDefaultProtocolClient` 默认参数（`"...\LinuxDo Desktop.exe" "%1"`），NSIS per-user 下预期有效，真机安装验证待人工。
- **风险接受**：Windows 无签名证书，SmartScreen 告警不阻塞自用；macOS 构建签名后置另立任务。发版流程见 README「打包与发版」。
- **待真机人工验收**：双击安装（应用名/图标/SmartScreen）、`linuxdo-desktop://` 回调、托盘交互（×隐藏/恢复/退出）、原生通知点击跳转、AC5 升级链路（repo 就绪后）。

### 伴生扩展桥接（P2，2026-10-16，方案 C 定稿）

- **背景**：系统浏览器 cookie 沙箱化，应用无法直读；linux.do Connect（OIDC）仅身份联邦无论坛会话权限。用户选定方案 C——伴生 MV3 扩展作合规桥：「Edge 登录一次，应用自动跟随」。Chrome 商店分发、`_t` 以外 cookie、扩展自动更新均 Out of Scope。
- **扩展**（仓库根 `extension/`，零构建零依赖）：manifest MV3，permissions `cookies`+`storage`，host_permissions `*://*.linux.do/*` 与 `http://127.0.0.1:17366/*`。`background.js` service worker：`cookies.onChanged`（domain 匹配 `(^|\.)linux\.do$` 且 name=_t、非 removed）→ 1.5s 防抖 → 带配对码 POST /ingest；MV3 SW 可休眠，事件自动唤醒，无常驻需求。popup：配对码输入（存 `chrome.storage.local`，只存码不存 cookie）+ 立即推送（runtime message 走同一函数）+ 结果摘要。
- **接收口**（`src/main/api/bridge.ts`）：`node:http` server 绑 `127.0.0.1:17366`（与 connect.ts 的 17365 回环先例并列，独立端口防冲突）。`POST /ingest`，请求体 `{"pairCode":"123456","tCookie":"..."}`；码错 401、缺字段 400、方法/路径错 404、体超 16KB 413；合法 → `setTCookieManually(tCookie)`（复用 auth.ts 手动粘贴通道，含 flushCookies + loginStatus 刷新）→ 200 `{"ok":true,"username":"..."}`；OPTIONS 预检 204；CORS 头仅为调试便利（扩展有 host_permissions 不受限）。应用启动 `initBridge()` 按持久化开关自动 start（默认关，不 start 零痕）。
- **配对码**：6 位数字（`crypto.randomInt`，保留前导零），首次启用时生成并持久化 translate-settings.json（`bridgeEnabled`/`bridgePairCode`，Boolean 归一，沿用原子写盘；既有 translate/DoH/notification setter 均已改为透传 bridge 字段防覆盖）；UI 可重新生成，旧码立即失效。
- **安全边界**：仅回环绑定 + 弱配对码（防本机其他程序误撞，不做 safeStorage 加密——弱凭据加密反增跨启动复杂度）；`_t` 属敏感会话凭据，扩展与应用两端只在内存转发，响应/日志/chrome.storage 一律不落不回显；端口固定 17366（扩展 manifest 写死），被占用时报错透出 UI 不阻塞应用。
- **IPC 三件**：`bridge:getStatus` / `bridge:setEnabled` / `bridge:regenPair`（返回统一 `BridgeStatus`：enabled/pairCode/listening/lastPushTime/lastPushOk/lastError）；UI 在登录页方式二卡片内（开关 + 等宽配对码 + 重新生成 + 最近推送），renderer 5s 轮询 status、检测到新推送即 `auth.refresh()`。
- **安装向导（R6，2026-10-16）**：`bridge:installWizard` IPC → `installWizard()`（bridge.ts）：路径 `app.isPackaged ? resourcesPath/extension : appPath/extension`（extraResources 把 `extension/` 打进 `resources/extension`）→ `clipboard.writeText` 复制 → spawn 直呼 msedge.exe 打开 `edge://extensions`。UI 浮层三步指引（开发人员模式 → 加载解压缩 + Ctrl+V 粘贴 → 完成），复用既有 5s 轮询，`lastPushOk===true` 自动切「✅ 安装成功」态。
- **R7 实测反馈迭代（2026-10-16 真机）**：① `cmd /c start msedge` 静默不跳转 → `locateMsEdge()` 定位直呼：%ProgramFiles(x86)%/%ProgramFiles% 常见路径 → `reg query …App Paths\msedge.exe /ve`（HKCU→HKLM，execSync 3s 超时，正则取 REG_SZ 值），全失败透出「未找到 Edge」；② 扩展握手：background.js 在 `runtime.onInstalled` + SW 每次启动（顶层）POST `/ingest-hello {pairCode}`（有码才发，无 cookie），bridge 码对记 `extConnectedAt`（仅内存，regenPair 时清零；码错 401），`BridgeStatus.extConnectedAt` 随 status 返回——向导步骤②实时「✅ 已检测到扩展」、桥接行「扩展已连接」、方式一系统浏览器按钮的就绪条件；步骤①开发人员模式无接口保持纯指引；③ 配对码一键复制（renderer `navigator.clipboard`，桥接行 + 向导浮层共用）；④ 方式一卡片「在系统浏览器登录（需扩展桥接）」：`bridge:openSystemLogin` IPC → `shell.openExternal('https://linux.do/login')`，桥接未开启或扩展未连接时置灰——与扩展桥接联动完成「系统浏览器登录 → onChanged 自动推 → 应用同步」的 AC1 链路。
- **踩坑：edge:// 命令行 URL 仅冷启动有效（真机实测，2026-10-16）**：Edge 已运行时，对 msedge.exe 带参二次拉起会经 Chromium ProcessSingleton 转发到既有进程，而转发通道对 `edge://` 内部页有安全加固（M57 起直接丢弃），表现为只弹新标签页不跳转。installWizard 据此分流：`tasklist /FI "IMAGENAME eq msedge.exe"`（无匹配非零退出，execSync 抛错即未运行）→ 未运行 `spawn(msedge, ['edge://extensions'])` 冷启动直进（`WizardResult.mode='direct'`）；已运行则剪贴板换成 `edge://extensions`、无参拉起聚焦新标签（`mode='paste'`），浮层步骤②改「地址栏粘贴 → 回车」兜底，两条路径共用 extConnectedAt 实时成功检测。
- **待人工验收**：AC1 全链路（真实 Edge + linux.do 登录态，加载扩展 → 自动同步 10s 内可见）；端口占用场景与打包态行为；向导在真实 Edge 的拉起与成功态切换。

### 离线 Topic 保存与离线阅读（P2b，2026-10-16）

- **存储选型**：JSON 文件（`userData/offline/<id>.json` + `index.json`），不引入 better-sqlite3——原生模块构建/打包风险大，查询场景只有 index 列表，JSON 足够；升级路径：条目过千或需索引查询时迁 sqlite，只改 `src/main/api/offline.ts` 读写层（升级路径注释在文件头部）。
- **saveTopic 流程**（offline.ts）：fetchTopic → 按 stream 顺序循环 fetchPostsByIds（每批 20，fetchTopic 已返回的首屏帖自动跳过）→ 内存组装 `{id,title,created_at,posts_count,posts,savedAt}` → 最后一次性 tmp+rename 原子写。分块中途失败即中止返回 `{ok:false,error}`，绝不写半截快照；index 最后写（崩溃最坏=有文件无索引条目，重存即恢复）。
- **进度通道**：`offline:save` handler 内经 `event.sender.send('offline:save:progress', {id,loaded,total})` 回传（复用单条 webContents 事件通道），renderer 按钮内文字「保存中 n/N」；设计稿权衡「不搞进度事件」与「按钮内 n/N」矛盾，取 n/N 实时显示（更贴 PRD 体验），未做进度条。
- **离线阅读**：topic store `open(id, {offline})`，route query `?offline=1` 触发 → `offline:get` 纯本地 IPC 渲染，posts 全量已加载（minLoadedIdx=0），jumpTo/已读进度/只看楼主/时间轴零网络可用；快照语义（保存时点，新回复不含），TopicView 显示「离线 · 保存于 X 前」徽标，offline 模式隐藏收藏按钮、回复入口、PostItem 操作栏（点赞/回复/编辑/翻译全需网络），PostItem 加 `offline` prop。
- **失败回落（AC3）**：在线 fetchTopic 抛错且 `offline:list` index 有档 → store.hasOffline → TopicView 错误区渲染 `.offline-tip`「网络异常，该主题有离线存档」+「阅读离线存档」按钮（直接 store.open offline 重开，不改路由）。
- **列表**：HomeView「离线」chip → ListMode 扩展 `{type:'offline'}`，topicList store loadMore 分支读本地 index 一次取完即 exhausted；行渲染标题/楼层数/savedAt 相对时间/行内删除（删除后重读 index），行点击 `/t/<id>?offline=1`。
- **边界**：不缓存图片/附件（离线图片显示浏览器默认占位）；无敏感凭据入快照（纯公开 cooked 内容），不入 safeStorage。

### 阅读体感：排版与主题偏好（P2，2026-10-16）

- **分层**：阅读偏好属纯 UI 状态，存 renderer localStorage（键 `ldd-reading`），不经主进程不进 safeStorage——与桥接/DoH（主进程 settings.json）分源是刻意分层（省 IPC、无敏感数据）。
- **单轨主题机制**：`data-theme` 属性是亮/暗唯一事实源。JS（`utils/prefs.ts` applyPrefs，App.vue setup 同步执行早于首帧防白闪）按偏好写入 documentElement；theme=system 时经 matchMedia 实时映射并注册 change 监听（导出 dispose 函数）。CSS 只认 `:root[data-theme='dark']` 属性组（亮色=:root 默认值），原 `@media (prefers-color-scheme: dark)` 分叉已删——消灭 media 与手动覆盖的双轨竞争。
- **排版变量**：`--reading-font-size/--reading-line-height/--reading-font-family/--reading-width` 挂在 `:root`，`.topic-scroller`（正文+标题继承）与 `.cooked`、`.timeline`（仅字体族）消费；内容列 `.topic-scroller > *` `max-width: var(--reading-width)`（full=none）居中。时间轴字号保持 11px 刻度不动（68px 窄列装不下 16-20px 正文字号），只跟随字体族。设置中心等控件区用固定 tokens 不受影响。
- **踩坑**：① radio 分段控件里值含数字（行距/宽度）时用 `:checked`+`@change` 而非 v-model（union 类型收窄+DOM value 字符串化的坑）；② MediaQueryList addEventListener 的 listener 传模块级可空变量触发 TS2769（收窄不进闭包），用局部 const 再注册。
- **待人工验收**：AC1–AC3（四项调整即时生效+重启保持；亮色全页面无暗色残留；跟随系统实时切换）。

### 双栏主从布局（P2，2026-10-16）

- **形态**：`/` 与 `/t/:id` 统一渲染 `BrowseView.vue`（路由表两行同组件，RouterView 复用实例不重挂）；`matchMedia('(min-width:1200px)')` + change listener 判双栏（AC3 拉宽恢复），窄屏按 route 条件渲染模拟 router-view 语义（`showList = dual || route.name==='home'`，`showReader = dual || route.name==='topic'`），BrowseView 内不再嵌 router-view。
- **归一策略**（store 不引 router，防 store↔router 循环依赖）：`stores/browse.ts` 持 `selectedId/offlineFlag/selectSeq`；列表点击 `select(id, offline)` 只改状态 + 递增 `selectSeq`（同 id 重复点击也要触发导航，纯值 watch 挂不上），BrowseView 监听 seq 统一写 URL——双栏 `replace`（可分享可回跳不留栈）、窄屏 `push`；外部跳转（通知 `?pn`、队列上下贴、离线 `?offline=1`、冷启动深链）由 route watcher 经 `syncFromRoute` 归一进 store（等值 no-op 防循环）。两向归一收敛后 `activeId` 即 `browse.selectedId`。
- **TopicView 参数化**：`topicId/offline` 可选 props + route 兜底（`props.topicId ?? Number(route.params.id)`）；`:key="selectedId+'-'+offlineFlag"` 换主题强制重建（store.open 幂等）；`?pn=` 仍读 route.query（BrowseView 场景下 route 就是 `/t/<id>?pn=<n>`）。
- **HomeView `pane` prop**：pane 模式在 RouterLink `@click` 里 `preventDefault` 后走 `browse.select`（RouterLink 保留——非 pane 整页模式零行为变化，Ctrl/中键新开标签也不受影响）。
- **样式要点**：`.reader-pane` 必须 `position:relative`——`.composer/.composer-open` 是 absolute，不锚定右栏就会盖住左栏；右栏 `overflow:hidden`（TopicView 自有 scroller）；`--reading-width` 限宽在窄右栏里由 max-width 自动收缩，无需特判。列表无限滚动 sentinel 的 IntersectionObserver（root=null）会被 overflow 容器裁剪，双栏左栏内滚照常工作。
- **待人工验收**：AC1（连续切换+列表状态保持）、AC2（队列/通知双栏直达）、AC3（缩放阈值往返）、AC4（离线列表→右栏离线阅读）。

### 评论树形展示（楼中楼视图，P2，2026-10-16）

- **树构建**（`stores/topic.ts` getter `treePosts`）：在 `visiblePosts`（只看楼主过滤后集合）之上重建，勿动过滤逻辑本身。children 表以 `post_number` 为键——`reply_to_post_number` 指向的是 post_number 不是 id（踩坑点）；根 = 无 reply 目标或父楼未加载（`byNumber.has` 判定，父楼随后懒加载补齐时 computed 自动重算归位）；同层按 post_number 升序 DFS 输出 `{post, depth}`，渲染深度 `Math.min(depth, 3)` 钳制（真实链深保留用于递归）。自引用防御：`reply_to === 自身 post_number` 归为根，否则 DFS 成环。
- **渲染**：缩进用平铺容器 `margin-left: depth*16px` + `.thread-line`（border-left 2px + padding-left 12px，仅 depth>0），不嵌套 DOM——cooked 宽度变量与 PostItem 复用零改动；PostItem 自带「↩ 回复 #N」徽标即 AC2 的父楼缺失标记；`scrollIntoView` 按 `post-<post_number>` id 查找，DOM 顺序≠楼层序无需特判。
- **偏好**：`viewMode: 'stream'|'tree'` 入 `ldd-reading`（prefs.ts 枚举归一仿 theme）；TopicView 用 `:checked`+`@change` 而非 v-model（union 类型 DOM 字符串化坑，同前），写回走 `savePrefs({...loadPrefs(), viewMode})` 读-改-写防覆盖其他字段。
- **待人工验收**：AC1（切换重启保留、链式缩进）、AC2（父楼补齐自动归位）、AC3（只看楼主+树形组合、时间流零行为变化）。

### 列表通道扩展：最热与 Top 榜（P2，2026-10-16）

- **抓包实测（2026-10-16 Edge）**：`/hot.json?no_definitions=true&page=0` 200，响应与 latest.json 同构（`topic_list.filter:"hot"`、`topics[]`/`users[]`、`more_topics_url:"/hot?page=1"`）；`top_tags` 为 hot 额外字段，不展示。`/top.json?period=...` 为 Discourse 核心端点（period: daily/weekly/monthly/quarterly/yearly/all；本应用 UI 仅开放 weekly/monthly/all，未单独实测，真机验证留人工）。
- **gamification 排行榜明确排除**：`/leaderboard.json` 实测 `{"errors":["找不到请求的 URL 或资源。"],"error_type":"not_found"}`，非原站功能——用户所见排行榜来自第三方增强工具 LDStatus Pro 的自有服务，本客户端不实现。
- **实现**：client.ts `fetchHot(page)`/`fetchTop(period, page)` 复用 `TopicListResponse` 解析；分页与 latest 同法用 page 参数递增（more_topics_url 抓包证实即 `/hot?page=1` 形态，无需解析该字段，store 去重由既有 seen 兜底）；ListMode 增 `{type:'hot'}` 与 `{type:'top',period:'weekly'|'monthly'|'all'}`，switchMode 重置逻辑共用；HomeView chips 最新/最热/Top/离线（Top 激活时旁现周/月/全部子段 `.chip.sub`，切换即 switchMode 重置列表；分类下拉 fallback 文案改「分类」防与最新 chip 歧义）；IPC `discourse:hot`/`discourse:top` 两件同步 ipc.ts + preload。双栏左栏/窄屏整页走同一 store，零额外改动（R3）。
