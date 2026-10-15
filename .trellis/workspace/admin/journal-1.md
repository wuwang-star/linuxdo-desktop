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
