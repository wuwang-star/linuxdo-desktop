# 登录账密记忆与自动填充

## Goal

登录窗口打开时自动填充已记住的论坛账密（填充后由用户手动点登录），消除重复手输；凭据 safeStorage 加密落盘，明文不落任何文件。

## 背景与已确认事实

- 登录主路径＝`openCookieLogin()`（`src/main/api/auth.ts:295`）：内嵌 BrowserWindow（defaultSession 持久会话）加载 `https://linux.do/login`，1.2s 轮询 `_t` cookie，检测到即关窗并 flushStore。该窗口支持 linux.do 全部登录途径，CF 挑战在真实浏览器环境完成（auth.ts:292）。
- safeStorage 加密落盘模式已有三处先例：`auth.enc`（auth.ts:16-50）、`connect.enc`（connect.ts:30,63-80）、translate-key.enc（settings.ts:196,237-239）；加密不可用时退化为不落盘、仅内存。
- User API Key 站点已关闭自助（LoginView 方式三「已禁用」）；Connect 仅身份；Edge 扩展桥接是另一条自动同步路径，与本功能正交。
- linux.do＝Discourse，登录表单标准选择器 `#login-account-name` / `#login-account-password`（真机复核项，见风险）。
- 分区归属：E 区（LoginView.vue / login.css / auth.ts），coordination.md 无在途会话。

## Requirements

- R1 主进程账密存取：用户名+密码经 safeStorage 加密落盘（新文件 `login.enc`，独立于现有 enc 文件，模式照 auth.ts）；提供保存/读取/清除；加密不可用时退化为不落盘不填充。
- R2 自动填充：`openCookieLogin` 打开窗口且已存账密时，向页面注入填充逻辑——等表单出现后填入用户名/密码，**不点击登录按钮**（拍板：规避 Discourse 连续失败锁 10 分钟、2FA/盾场景不适用、密码变更可见报错）。
- R3 管理入口在 LoginView「方式一」卡片内（拍板）：记住开关（或保存动作）+ 已记住状态 + 显式清除按钮；退出登录不联动清除（拍板：cookie 登出不带走密码，清除仅走显式按钮）。
- R4 静默降级：填充失败（选择器变更/页面改版/无存储）不影响手动登录全流程。
- R5 2FA 不纳入（拍板）：不做 TOTP 记忆/自动计算。

## Acceptance Criteria

- [ ] AC1 已记住账密后点「打开登录窗口」，用户名/密码自动填入表单且未自动提交（真机验证）。
- [ ] AC2 凭据仅以 safeStorage 密文落盘（文件内容不可读）；无加密环境退化为内存态、重启即失。
- [ ] AC3 UI 清除后 `login.enc` 删除，再次打开登录窗口无填充。
- [ ] AC4 未保存账密/填充失败时，手动登录行为与现状完全一致。
- [ ] AC5 typecheck + build 通过；退出登录（清 cookie）后账密仍保留（不联动清除）。

## Out of Scope

- 读系统浏览器账密（App-Bound Encryption 对抗，不可行且不当，已与用户确认）。
- 2FA TOTP 记忆/自动计算（拍板不做）。
- Edge 扩展桥接、Connect、User API Key 流程改动。

## 风险与复核项

- Discourse 登录表单选择器为社区标准 ID，linux.do 定制化可能变更 → AC1 真机复核；若失效按 R4 静默降级，不阻塞交付。
- 填充注入时机：`did-finish-load` + 表单轮询（登录页为 fullscreen form 或 modal 两种形态），实现时以 MutationObserver/轮询兜底。

## 任务形态

Lightweight：PRD-only，本会话内联实现（无子代理派发）。
