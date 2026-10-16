# Journal - admin (Part 1)

> AI development session journal
> Started: 2026-10-15

---



## Session 1: P0：Electron+Vue3 脚手架与核心阅读落地
<!-- trellis-session: v=2 fp=4a0d3951bae8fcc2 -->

**Date**: 2026-10-15
**Task**: P0：Electron+Vue3 脚手架与核心阅读落地
**Branch**: `master`

### Summary

brainstorm 定稿（Electron+Vue3，自建 UI 走 Discourse API）→ promote 到 specs/linuxdo-desktop/SPEC.md → 实现 P0：主进程 API 客户端（UA/退避/诊断）、嵌入式 cookie 登录+api-key、latest/分类列表、主题阅读（懒加载/已读进度）、reply_to 跳转/只看楼主/时间轴。typecheck/build/smoke 全过；本机数据中心 IP 匿名 API 被 429（环境限制，非代码缺陷）。

### Git Commits

| Hash | Message |
|------|---------|
| `070d3a8` | feat: LinuxDo 桌面客户端 P0 —— Electron+Vue3 脚手架、Discourse API 客户端、登录、主题列表与阅读、楼中楼上下文 |

### Testing

- [OK] npm run typecheck；npm run build；npm run smoke（SMOKE_OK）；--api-probe（429 环境限流）

### Status

[OK] **Completed**

### Next Steps

- npm run dev 人工验证 UI；P1：回复/点赞/收藏/通知、翻译


## Session 2: P0 数据链路全通：cookie 登录 + API 30 主题
<!-- trellis-session: v=2 fp=081b87ebf808b008 -->

**Date**: 2026-10-15
**Task**: P0 数据链路全通：cookie 登录 + API 30 主题
**Branch**: `master`

### Summary

用户经嵌入式登录窗口成功获取 _t cookie；--api-probe 复测 latest.json 返回 30 主题，确认 Electron 网络栈+默认 session cookie+退避客户端整条数据链路可用，此前的匿名 429 限流随登录态解除。P0 验收项全部闭环（UI 交互项由用户 dev 模式人工确认中）。

### Git Commits

(No commits - planning session)

### Testing

- [OK] --api-probe → API_PROBE_OK topics=30

### Status

[OK] **Completed**

### Next Steps

- P1：回复/点赞/收藏写操作、MessageBus 通知、翻译（双语）


## Session 3: P1：互动/通知/翻译落地 + 两个关键根因修复
<!-- trellis-session: v=2 fp=489ed006c992c167 -->

**Date**: 2026-10-15
**Task**: P1：互动/通知/翻译落地 + 两个关键根因修复
**Branch**: `master`

### Summary

CSRF 基建（403 自动刷新重试）+ 回复/点赞/收藏写操作（form-encoded + X-CSRF-Token）；通知（60s 轮询未读徽标+通知页+原生 toast+pn 直达楼层）；翻译（OpenAI 兼容配置 safeStorage 加密 + 楼内双语显示 + localStorage 缓存）。根因 1：rollup 对同模块混用静态/动态 import 的 CJS 输出会生成不完整命名空间（静默丢失新增导出）→ 全部改静态导入。根因 2：Electron net.fetch 主进程无 origin，默认 credentials 不带 cookie → 显式 credentials:'include'。探测发现 dev 实例占用 userData 时第二实例读不到最新 cookie（Chromium 单实例锁），登录态功能需在用户 dev 内人工验证。

### Git Commits

| Hash | Message |
|------|---------|
| `6ba8196` | feat(P1): 互动写操作、通知与翻译 —— CSRF 基建+回复/点赞/收藏、通知列表+未读铃铛+原生 toast、OpenAI 兼容双语翻译；修复 net.fetch 需显式 credentials:include 才携带 cookie；消除模块混用静态/动态导入导致的 rollup 命名空间不完整问题 |

### Testing

- [OK] typecheck 0 错；build 0 错；--api-probe latest.json 30 主题；probeP1 已进包（COOKIES/SESSION/CSRF/NOTIF 分步输出）

### Status

[OK] **Completed**

### Next Steps

- 用户 dev 内验证：右上角用户名、铃铛通知、回复/点赞/收藏、翻译配置；P2：楼中楼嵌套、离线、托盘


## Session 4: 登录三通道 + 登录态留存
<!-- trellis-session: v=2 fp=07ddfeb81fdb378e -->

**Date**: 2026-10-15
**Task**: 登录三通道 + 登录态留存
**Branch**: `master`

### Summary

User API Key 官方流程完整实现（内嵌授权窗口拦截 linuxdo-desktop:// 回调，解密校验 nonce 后 safeStorage 落存，请求自动带 User-Api-Key 头，重启免登录）；浏览器登录成功后 cookies.flushStore 强化落盘；手动 _t cookie 注入（一年有效期+落盘）。UAK_PAGE 403 系探测进程非浏览器环境被 CF 拦，真实授权窗口为完整 Chromium 不受影响，需用户在 dev 内点「一键申请授权」实测。

### Git Commits

| Hash | Message |
|------|---------|
| `4bf5a4a` | feat(P1): 登录三通道与登录态留存 —— ①User API Key 官方授权流程（RSA 密钥对+nonce 校验+OAEP 多填充兼容解密，safeStorage 长期保存，User-Api-Key 头）②内嵌浏览器登录（成功后 flushStore 落盘）③手动粘贴 _t cookie（测试秒切）；认证头区分 user/admin 两类 Key |

### Testing

- [OK] typecheck 0 错；build 0 错

### Status

[OK] **Completed**

### Next Steps

- 用户 dev 实测方式一授权与重启留存；P2 继续


## Session 5: 授权页支持系统浏览器复用登录态
<!-- trellis-session: v=2 fp=f2d298f076e76f1f -->

**Date**: 2026-10-15
**Task**: 授权页支持系统浏览器复用登录态
**Branch**: `master`

### Summary

「一键申请授权」默认改为 shell.openExternal 打开系统默认浏览器——授权页直接携带用户浏览器里的 linux.do 登录态，点一下授权即可；回传经 linuxdo-desktop:// 自定义协议（app.setAsDefaultProtocolClient，dev 模式写入 electron.exe+入口路径），OS 拉起的第二实例由 requestSingleInstanceLock + second-instance 事件转发给持有 RSA 私钥的运行实例解密落存；macOS 走 open-url。内嵌窗口授权保留为备选（无浏览器环境时）。

### Git Commits

| Hash | Message |
|------|---------|
| `99dec0e` | feat: 授权页支持系统浏览器打开 —— 复用浏览器 linux.do 登录态；linuxdo-desktop:// 协议注册 + 单实例锁转发回调（second-instance/open-url），内嵌窗口授权保留为备选 |

### Testing

- [OK] typecheck 0 错；build 0 错

### Status

[OK] **Completed**

### Next Steps

- 用户 dev 实测：重启 dev → 设置页 → 系统浏览器授权 → 浏览器点授权 → 应用自动收到回调显示成功 → 重启免登录


## Session 6: 登录通道实测定稿 + Connect 调研
<!-- trellis-session: v=2 fp=aab043d1a56e9b70 -->

**Date**: 2026-10-15
**Task**: 登录通道实测定稿 + Connect 调研
**Branch**: `master`

### Summary

用户实测 /user_api_key/new 返回「页面不存在或是不公开」→ linux.do 禁用 user-api-key 自助申请，无申请途径。UI 调整：浏览器窗口登录升为主通道，_t 注入为测试通道，user-api-key 降级标注未开放并支持取消等待（cancelPendingUserApiKey）。Connect OIDC 调研（.well-known 200）：scopes 仅 openid/profile/email，身份联邦用，无论坛 API 权限，不适用。结论记入 SPEC 决策 5。

### Git Commits

| Hash | Message |
|------|---------|
| `db54743` | fix: 登录方式按实测定稿 —— user-api-key 被 linux.do 禁用（UI 降级+可取消等待），浏览器窗口登录升为主通道；调研 Connect OIDC（仅身份 scope 无论坛 API 权限）并记入 SPEC |

### Testing

- [OK] typecheck 0 错；build 0 错

### Status

[OK] **Completed**

### Next Steps

- 用户重启 dev 验证：浏览器窗口登录 → 重启免登录（cookie 留存）；继续 P1 剩余人工验证（通知/回复/点赞/翻译）


## Session 7: Connect 身份登录接入（OAuth2+PKCE）
<!-- trellis-session: v=2 fp=4d045759809999af -->

**Date**: 2026-10-15
**Task**: Connect 身份登录接入（OAuth2+PKCE）
**Branch**: `master`

### Summary

用户在 connect.linux.do/dash/sso 自建 OAuth 应用。实现：PKCE S256 + state 授权码流程（系统浏览器打开 /oauth2/authorize），双回调模式（协议 linuxdo-desktop://connect 复用单实例锁转发；本地回环 127.0.0.1:17365/callback 内置 http 服务+成功提示页），token 交换与 /api/user 身份拉取，ClientSecret/accessToken/refreshToken safeStorage 加密。回调路由按 payload/code 分流。明确边界：Connect 仅身份（openid/profile/email），无论坛 API 权限，论坛会话仍走 cookie 登录。

### Git Commits

| Hash | Message |
|------|---------|
| `99dec0e` | feat: 授权页支持系统浏览器打开 —— 复用浏览器 linux.do 登录态；linuxdo-desktop:// 协议注册 + 单实例锁转发回调（second-instance/open-url），内嵌窗口授权保留为备选 |

### Testing

- [OK] typecheck 0 错；build 0 错

### Status

[OK] **Completed**

### Next Steps

- 用户填 ClientId/Secret 选回调模式实测 Connect 授权；继续 P1 人工验证与 P2


## Session 8: P1 收尾（实时通知/多主题队列/帖子编辑）

**Date**: 2026-10-16
**Task**: .trellis/tasks/10-15-p1-wrapup
**Branch**: `master`

### Summary

brainstorm 定稿：范围=P1 收尾（用户选），队列交互=手动入队+顺序读。trellis-implement 执行 8 步清单：MessageBus 长轮询（main/api/messagebus.ts，自适应流式/数组解析、65s 超时、指数退避 3 败熔断回退轮询；频道名 /notification/&lt;uid&gt; 与分块编码未经登录态实测，SPEC 已标注待验收）；多主题队列（stores/queue.ts，localStorage 键 ldd-queue）；帖子编辑（can_edit 门控 + GET raw 预填 + PUT post[raw] 合并更新）；清理 out-verify 残留、归档旧 p0/p1 任务。双子智能体并行质检（trellis-check 全量 + 独立安全评审）：无 P0；修复 P1 composer 编辑/回复互切残留脏文本、P2 poll controller 换代竞态、队列 setItem 未保护、编辑后整替丢 can_edit/actions_summary、SPEC 两处措辞失准。TAIL_MARKER_888（上一任务遗留死代码）单独清理。

### Git Commits

| Hash | Message |
|------|---------|
| `bda50fd` | chore: 清理 src/renderer/out-verify 构建残留（.gitignore+删除）；归档旧 P0/P1 任务（typecheck/smoke 通过留证），新建 p1-wrapup 任务工件（prd/design/implement+jsonl） |
| `4853ae1` | feat: P1 收尾 —— MessageBus 长轮询实时通知、多主题队列、帖子编辑 + 评审修复 + SPEC 补记 |
| `ece2fad` | chore: 删除遗留死代码 TAIL_MARKER_888（全仓零引用） |

### Testing

- [OK] typecheck 0 错（实现每步 + 修复后复跑）；smoke SMOKE_OK ×2
- [待人工] AC1 实时通知 30s 内达（需登录态）；AC2 队列顺序导航+重启保留；AC3 编辑流与非本人楼层无入口

### Status

[进行中] 代码全部交付，AC1–AC3 待用户登录态人工验收

### Next Steps

- 用户 `pnpm run dev` cookie 登录实测 AC1/AC2/AC3；通过后 `task.py archive 10-15-p1-wrapup`
- MessageBus 若实测频道名/分块格式不符，只改 messagebus.ts 解析器（extractChunks）；长轮询整体不通则降级 15s 短轮询（AC1 仍满足），决定记入 SPEC


## Session 9: DoH（实验降级）+ Trellis 轻量化 + P2a 打包分发

**Date**: 2026-10-16
**Task**: .trellis/tasks/10-16-p2-doh、.trellis/tasks/10-16-p2a-dist
**Branch**: `master`

### Summary

用户连发多条方向指令：doh 优先开发；质量/安全双评审先不做（太慢）→ 改 workflow.md 2.2 与 trellis-check SKILL 为「默认内联 typecheck+smoke，全量评审用户明确要求才做」（两份 skill 副本同步）；功能/UI/设置都要参考 FluxDO+ALDR（已存记忆，任务 PRD 落地）。DoH：trellis-implement 六步交付后，独立评审揪出 P0——dns-over-https-mode/templates 是 Chrome 浏览器层开关，Electron 44 网络服务硬编码 SecureDnsMode::kOff 不消费（源码级核实），整个功能空转。如实降级：默认关闭、UI 标「实验·暂未生效」、README/SPEC 记源码依据与真实现路径（本地 DoH 代理 / host-resolver-rules，另立任务）；顺修 P2×4（模板 URL 规范化、布尔归一、原子写盘、非法模板保存反馈）。P2a：安装包 106MB 产出、win-unpacked SMOKE_OK、托盘/原生通知/updater 降级链落地；偏差 publish:never 无效改省略 publish 键。设置中心任务（10-16-settings-center）按用户要求排队，PRD 写明参考两系统。流程变化后不再派评审子智能体，收尾仅内联 typecheck+smoke。

### Git Commits

| Hash | Message |
|------|---------|
| `53a5e60` | feat: DoH 加密 DNS 设置基建（实验）——开关接线/持久化/UI/resolveHost 诊断按钮；Electron 44 不消费该开关如实降级 |
| `84b8683` | chore: Trellis 流程轻量化——2.2 默认内联检查，全量评审 opt-in |
| `1ef8105` | feat: P2a 打包分发——NSIS 安装包/托盘/原生通知/updater 降级链，产物 106MB SMOKE_OK |

### Testing

- [OK] typecheck 0 错（每个任务收尾复跑）；smoke SMOKE_OK；dist 产物 win-unpacked smoke 通过
- [待人工] DoH AC1–3（当前功能未生效，等真实现任务）；P1 的 AC1–3（登录态验收）；P2a AC1–5 真机项（双击安装/协议回调/托盘/通知点击/升级链路）

### Status

[进行中] DoH 以「实验·未生效」状态收尾；P2a 代码交付待真机验收；三任务（p1-wrapup/p2-doh/p2a-dist）in_progress，settings-center 排队

### Next Steps

- 用户真机验收：装 dist 安装包 → 登录 → 通知/队列/编辑（P1）+ 托盘/协议回调（P2a）
- 给 GitHub repo（owner/repo）→ 填 builder.yml publish 接通 AC5 升级链路
- 登录「系统浏览器读登录态」方案 A/B/C 待用户选（B=_t 半自动回填推荐）
- 排队：settings-center（先调研 FluxDO/ALDR 设置结构）；DoH 真实现另立任务


## Session 10: 设置中心（七分类+设计 tokens）+ DoH 默认端点

**Date**: 2026-10-16
**Task**: .trellis/tasks/10-16-settings-center
**Branch**: `master`

### Summary

目标推进到排队任务：zread 调研 FluxDO（lib/pages 设置分页面：appearance/preferences/network(doh/proxy/ratelimit)/notifications/data_management/app_logs/about）与 ALDR（偏好域 ~100 字段：模式/图像/主题/字体/外观/布局/性能/网络/交互/快捷键/过滤器+组合导出省凭据），research.md 存档。首轮三分类交付后用户两次加码：「参考项目设置页有各种分类」→ 扩七分类（外观/阅读占位说明卡+通知真实开关+日志=诊断卡迁入）；「DoH 设置太简陋，框架定了设计呢」→ styles.css 建 CSS tokens（色彩/间距/圆角/字阶+brand 兼容别名）+ 组件化表单（field-row/switch/segmented/banner），设置中心为设计基准页，DoH 组卡片行重做。通知开关补上 p2a 原生通知无开关的缺口（settings 持久化+notify.ts 即时生效）。用户指定 DoH 默认模板 edge.1molchuan.top/linuxdo（自建端点，预设首位+非法回退同步，旧用户存值优先）。全流程按轻量化规则：无评审子智能体，收尾仅内联 typecheck+smoke。

### Git Commits

| Hash | Message |
|------|---------|
| `4face00` | feat: 设置中心七分类+通知开关+设计 tokens+DoH 默认端点 edge.1molchuan.top |

### Testing

- [OK] typecheck 0 错（实现每步+收尾复跑）；smoke SMOKE_OK；版本常量 0.1.0 注入 chunk 已核实
- [待人工] AC2 通知开关关→push 不弹；AC3 日志五列；AC4 七分类切换+占位卡；AC6 tokens 视觉/dark 对比度

### Status

[进行中] 代码交付，AC2–AC4/AC6 待 dev 真机人工验收

### Next Steps

- 用户 dev 验收设置中心与视觉；此前积压：P1 AC1–3、P2a 真机安装/托盘/协议回调、GitHub repo（AC5）、登录方案 A/B/C、DoH 真实现立项
- 后续页面（登录/列表/阅读）吃 tokens 的设计统一任务待排


## Session 11: Connect 实测调试 + 伴生扩展桥接（方案 C）

**Date**: 2026-10-16
**Task**: .trellis/tasks/10-16-companion-ext
**Branch**: `master`

### Summary

用户 Connect 后台建好 OAuth 应用（回调=本地回环 17365），实测回环已触发但登录未落地。根因定位：connect.ts 的 token 交换/身份拉取用 Node 全局 fetch（undici），不走系统代理——浏览器（Clash）能开授权页而主进程直连 connect.linux.do 超时。修复：改 Electron net.fetch（系统代理）+20s 超时（7df7a90）。用户中途点进方式三 user_api_key 死通道造成「页面不存在」干扰判断（该通道本就标 ⚠️ 未开放）。用户确认要方案 C：伴生 MV3 扩展桥接——extension/ 零构建扩展读 linux.do _t 经 cookies.onChanged 自动 POST 应用回环口 17366/ingest（配对码防护、仅绑 127.0.0.1、凭据不回显），走既有 setTCookieManually 落登录态；settings 增 bridgeEnabled/bridgePairCode；LoginView 方式二卡片加桥接行。另：设置中心已交付（七分类+设计 tokens+通知开关+DoH 默认端点 edge.1molchuan.top，4face00），并在打包应用实机自验七分类/关于页 v0.1.0/联动画法全过。登录页多入口易点串的 UX 债已记待收编。

### Git Commits

| Hash | Message |
|------|---------|
| `a9f4851` | feat: 伴生 Edge 扩展桥接（方案 C）——扩展+回环口 17366+配对码+桥接行 UI |
| `7df7a90` | fix: Connect token 交换改 net.fetch 走系统代理（根因修复） |

### Testing

- [OK] typecheck 0 错（每任务收尾复跑）；smoke SMOKE_OK
- [待人工] Connect 全链路（net.fetch 修复后复验）；扩展桥接 AC1（Edge 加载 extension/ → 填配对码 → 登录自动同步）；设置中心 AC2（通知开关对真实 push）

### Status

[进行中] companion-ext 代码交付待人工 AC1；Connect 修复待复验；p1-wrapup/p2-doh/p2a-dist/settings-center 待验收归档

### Next Steps

- 用户 Edge 加载 extension/（edge://extensions 开发人员模式）→ 应用开桥接填配对码 → Edge 登录 linux.do 验证自动同步
- Connect 授权重试（net.fetch 修复后）；成功记 SPEC 实测结论
- 积压决策不变：GitHub repo（AC5）、DoH 真实现立项；登录页多入口 UX 收编任务待排


## Session 12: 离线 Topic（P2b-1）+ 阅读体感 + 扩展桥接实测迭代

**Date**: 2026-10-16
**Task**: .trellis/tasks/10-16-offline-topic、10-16-reading-feel、10-16-companion-ext（R7）
**Branch**: `master`

### Summary

P2b 立项为父任务挂三子（offline-topic/webdav-sync/global-shortcuts）。离线 Topic 交付：offline.ts JSON 存储（userData/offline 分文件+index、原子写、分块全量拉取失败不落半截），TopicView 保存+进度、离线模式隐藏互动、在线失败回落离线存档，HomeView 离线列表+删除（9b13d80）；选型注明不用 sqlite 的原因。阅读体感交付：prefs.ts（localStorage ldd-reading）驱动 CSS 变量——字号/行距/字体族/阅读宽度即时生效，主题模式三选（跟随系统/亮/暗）单轨制（media query 迁 data-theme 属性组，JS 监听系统切换），设置中心外观/阅读占位卡换真实控件+恢复默认（8d05f5d）、双栏浏览主从（23b3f40：BrowseView 统一 / 与 /t/:id，≥1200px 左列表右阅读，selectSeq+route watcher 归一，窄屏回退）、评论树形楼中楼（bc50e17：时间流/树形双视图，children 表+DFS 深度钳 3，父楼未加载成根带标记懒加载归位，只看楼主在过滤集重建树）
。扩展桥接 R7 实测迭代：配对码一键复制；Edge 拉起重写（msedge.exe 定位直呼，cmd start 静默失败踩坑）；扩展握手 /ingest-hello（向导步骤②实时「已检测到扩展」）；方式一加「在系统浏览器登录（需扩展桥接）」（ae446cb）；Edge 已运行时 edge:// 命令行 URL 被 ProcessSingleton 丢弃（只弹新标签）→ 按 tasklist 分流：运行中=剪贴板+地址栏粘贴，冷启动=命令行直进（8f1ac5c）。

### Git Commits

| Hash | Message |
|------|---------|
| `9b13d80` | feat: 离线 Topic 保存与离线阅读（P2b-1） |
| `ae446cb` | feat: 桥接 R7 实测迭代（复制码/握手/系统浏览器登录） |
| `8f1ac5c` | fix: 安装向导按 Edge 运行态分流（ProcessSingleton 丢弃 edge:// URL） |
| `8d05f5d` | feat: 阅读体感（排版四项+主题模式三选+设置中心真实控件） |

### Testing

- [OK] typecheck 0 错（每任务收尾复跑）；smoke SMOKE_OK
- [待人工] 离线 AC1–AC4（保存/断网阅读/回落/删除）；阅读体感 AC1–AC3（即时生效/亮色排查/目测）；扩展 AC1 全链路；Connect 复验（net.fetch 后）

### Status

[进行中] offline-topic/reading-feel/companion-ext/login-ux 代码交付待人工验收；webdav-sync/global-shortcuts 排队

### Next Steps

- 用户真机：桥接全链路（Edge 登录自动同步）+ 阅读体感目测 + Connect 复验 + P1/P2a 验收
- 排队：webdav-sync（依赖 offline 数据层）、global-shortcuts
- 积压决策：GitHub repo（AC5）、DoH 真实现立项
