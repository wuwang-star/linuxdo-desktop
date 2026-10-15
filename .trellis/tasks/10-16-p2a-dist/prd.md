# P2a 打包分发：安装包+托盘+自动更新

## Goal

项目从「pnpm dev 才能跑」变成「双击安装、日常自用的桌面应用」：NSIS 安装包、应用图标、托盘常驻、系统原生通知、GitHub Releases 自动更新。

## Background（已确认事实）

- `dist` script 存在（`electron-vite build && electron-builder`）但 **electron-builder 零配置**：仓库无 builder.yml，package.json 无 build 字段。
- **零图标资源**：全仓库无 png/ico/icns/svg（find 已核实）。
- 原生 `Notification` 未使用：P1 的通知提示为 renderer 自绘 toast；P2 定稿中的「原生通知」尚未兑现。
- 无 git 远程（`git remote -v` 为空）；electron-updater 不在依赖里。
- 自定义协议 `linuxdo-desktop://` 已注册（src/main/index.ts:36），但 dev 态注册方式（process.defaultApp 分支）在打包态的实效性未验证。
- SPEC：目标平台 Win+mac；macOS 签名需 Apple 开发者账号（$99/年）——**本任务只做 Windows**，mac 构建后置另立任务。
- P2 定稿（.thinkrail roadmap）：「P2 数据与桌面：离线 Topic + WebDAV 同步 + 托盘/全局快捷键/原生通知 + 打包/自动更新 + macOS 构建签名」——本任务承接其中「托盘/原生通知/打包/自动更新」，其余（离线/WebDAV/快捷键/macOS）归 P2b 及后置。

## Requirements

- **R1 打包配置**：electron-builder 完整配置（appId/productName/asar/图标），`pnpm run dist` 产出 NSIS 安装包，版本号取自 package.json。
- **R2 应用图标**：生成可用基础图标（ico/png，托盘与安装包共用）；正式设计可后换。
- **R3 托盘常驻**：托盘图标 + 右键菜单（显示主窗/退出）；关闭主窗隐藏到托盘而非退出，托盘菜单退出才真正退出。
- **R4 原生通知**：MessageBus 推送到达时发系统级 Notification（标题+摘要），点击聚焦主窗并跳转对应主题楼层。
- **R5 自动更新（通道：GitHub Releases，用户可推翻）**：electron-updater + GitHub provider；启动延迟检查、发现新版提示下载安装；**无 repo/离线/失败时静默禁用不报错**。执行前需用户提供 GitHub 仓库（owner/repo）。

## Acceptance Criteria

- [ ] **AC1** `pnpm run dist` 产出 NSIS 安装包；双击安装成功，有应用名与自定义图标（非 Electron 默认）。
- [ ] **AC2** 安装版全链路可用：cookie 登录、浏览主题、收通知；`linuxdo-desktop://` 协议在安装版下有效（系统浏览器授权回调可达）。
- [ ] **AC3** 托盘图标显示；点 × 主窗隐藏、进程驻留托盘；托盘可恢复窗口、可退出（退出后进程消失）。
- [ ] **AC4** 新通知触发系统原生通知；点击通知聚焦应用并跳到对应主题。
- [ ] **AC5** （GitHub repo 就绪时）发 v0.1.0 → 改版本号重新 dist 发布 → 已装客户端提示更新并完成升级；repo 未就绪时应用正常启动、无更新相关报错。
- [ ] **AC6** `pnpm run typecheck` 0 错误；`pnpm run smoke` 输出 SMOKE_OK。

## Out of Scope

- macOS 构建/签名（需 Apple 账号决策，另立任务）
- 全局快捷键、离线 Topic、WebDAV 同步（P2b+）
- Windows 代码签名证书（无证书 SmartScreen 会告警，风险已记录，不阻塞自用）
- 开机自启、安装器自定义主题、多语言安装界面

## Open Questions

- 更新通道：对话框未答复，按推荐值 **GitHub Releases** 写入规划；批注本摘要时可改自建静态源（仅 R5 配置变化，其余工作不受影响）。落地前需用户建 repo 并告知 owner/repo。
