# LinuxDo Desktop 首发 · 发布帖草稿（M3 素材，待 owner/repo 后填链接）

> 状态：草稿。发布前 checklist 见文末。真源：docs/roadmap.md。

## 标题候选

1. 「下载即用」的 linux.do 桌面客户端——内置 ECH 直连，免配置代理
2. LinuxDo Desktop v1.0：Windows 原生客户端，双栏阅读 / 楼中楼 / 离线 / 主题工坊

## 正文骨架

**一句话**：一个开箱即用的 linux.do Windows 桌面客户端——不用装 Clash、不用改 DNS，下载点开就能刷。

**为什么是它**（差异化，对齐社区痛点）：
- **免配置联网**：内置 ECH（Encrypted Client Hello）直连引擎，TLS 握手层加密 SNI，从根上绕开 SNI 阻断；DoH 加密解析防 DNS 污染。不用自备任何代理
- 网络异常有出口：设置中心内置网络诊断 + 手动上游代理 + ech/system/manual/off 四档模式，任何环境都有路可走
- **为长阅读做的**：双栏主从（列表+正文同屏）、楼中楼树形串、离线收藏帖子、正文排版主题
- **账号全管**：登录窗口三方式（Connect/OAuth/账密/2FA 全支持）+ 记住账密自动填充 + WebDAV 云同步收藏夹
- **主题工坊**：纯 CSS 皮肤包，内置飞书样例，社区可自制分发

**下载**（GitHub Releases，占位）：
- 安装版：`LinuxDo Desktop-1.0.0-setup.exe`（一键安装）
- 仓库：<owner/repo 待填>

**Windows SmartScreen 放行说明**（裸发无签名证书，截图引导）：
1. 双击安装包若弹出「Windows 已保护你的电脑」→ 点「更多信息」→「仍要运行」
2. 安装包与更新均来自本仓库 GitHub Releases，更新走应用内自动检更
3. 不放心可只下 `win-unpacked` 免安装版直接运行

**已知限制**（诚实栏，对齐 roadmap 发布主张）：
- 仅 Windows；macOS/Linux 打包在 v1.x
- ECH 过盾依赖网络环境，极端线路可能需要换手动代理档（应用内 30 秒可配）
- 首发不签名（证书成本），后续视社区规模复评

**反馈渠道**：本帖回帖 / 仓库 Issues。

## 发布前 checklist（M3 走查）

- [ ] owner/repo 就绪，publish 配置 + 首个 Release 上传产物
- [ ] electron-updater 真机验证（旧版 → 检更 → 升级）
- [ ] 新用户冷启动走查：全新 userData → 安装向导 → 登录 → 读帖全链
- [ ] ECH 多环境验收（≥3 种运营商线路）——发布门槛 #1，不通过不发
- [ ] 本文数据复核（功能清单与最终版一致，截图最新）
- [ ] 发布帖配图：从 docs/screenshots/ 挑 4-6 张 + 安装/放行引导截图（需重截带安装器的）

## 版本记录

- v1.0.0（计划 2026-12-01 前后）：首发，范围见 roadmap「v1.0 范围」
