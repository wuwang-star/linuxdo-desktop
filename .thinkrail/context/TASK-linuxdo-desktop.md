---
id: TASK-linuxdo-desktop
type: task-spec
title: LinuxDo 桌面客户端（参考 FluxDO 与 Awesome LinuxDo Reader）
status: draft
---

# 任务

做一个 linux.do 的桌面端客户端：
- 参考项目 1：FluxDO（https://github.com/Lingyan000/fluxdo）
- 参考项目 2：Awesome LinuxDo Reader / ALDR（https://github.com/sunbigfly/awesome-linuxdo-reader）
- 重点是 ALDR 那种大量自定义增强功能；先研究 Electron 还是 Tauri。

# 研究结论（已完成）

## FluxDO
- 技术栈：**Flutter**（非 Electron/Tauri）+ Riverpod + Dio；Rust DOH 代理（DNS 加密/ECH）。
- 形态：**完全自建 UI**，直接调 Discourse JSON API（浏览/发帖/回复/搜索/通知/书签/徽章/投票/Markdown 编辑器）。
- 平台：Android / iOS / Windows / macOS / Linux。协议 GPL-3.0（**代码不可直接复用进非 GPL 项目**）。
- 实时推送用 MessageBus。

## Awesome LinuxDo Reader（ALDR）
- 形态：**油猴脚本 / Chrome 扩展**（TypeScript，**MIT**，当前 1.6.7 Lite）。
- 架构关键：**不替代原站** —— 叠加在原站页面之上，登录态/权限/API 全部复用原站。
- 111 项功能，六大类：
  1. 连续阅读工作区（浮窗/全屏/左右嵌入，长帖按需渲染，多主题队列，已读进度）
  2. 完整讨论上下文（楼中楼、父回复、引用回跳、只看楼主、时间轴）
  3. 原站级互动（回复/划词引用/点赞/表情/Boost/收藏/通知，走原站 API）
  4. 共享工具工作区（通知私信、历史、收藏、Topic 下载、用户观察、岁月史书、不想看；多标签浮窗）
  5. 富内容与翻译（灯箱、批量下载、音视频/HLS、KaTeX、投票；双语/全译/OpenAI 兼容翻译）
  6. 数据与性能（离线 Topic、WebDAV 同步、设置导入导出、429 退避、长帖虚拟化）
- 提供**单文件 standalone 版**（`work/main-lite.standalone.user.js`，无 @require/@resource）——技术上可整体内嵌进桌面壳注入执行。
- MIT 协议允许复用（保留版权声明即可）。

## Electron vs Tauri（版本现状：Electron 44.7.2 / Tauri 2.12.x）

| 维度 | Electron | Tauri 2 |
|---|---|---|
| 内核 | 自带 Chromium + Node，全平台一致 | 系统 WebView：Win=WebView2(Chromium)、mac=WKWebView、Linux=WebKitGTK |
| 体积/内存 | 安装包 ~90-120MB，内存占用高 | 安装包 ~8-15MB，内存低 |
| 注入脚本 | preload + executeJavaScript，成熟 | initialization_script（document-start 注入），够用 |
| Cloudflare | 内核一致，行为最可预期 | Win/mac 良好；**Linux WebKitGTK 最弱**（CF 拦截与渲染兼容风险） |
| 多标签/多 webview | BrowserView/WebContentsView，最顺手 | 多窗口支持好；单窗口多 webview 2.x 可用但有平台差异 |
| 系统能力 | 内置托盘/快捷键/通知 + electron-updater | 官方插件齐全（tray/global-shortcut/notification/updater） |
| 开发栈 | 纯 TS/JS | 前端 TS + **构建需 Rust 工具链**（常规用法几乎不用写 Rust） |
| 数据库/重活 | Node 生态 | Rust 侧（或前端 sqlite 插件） |

**初步判断**（待用户输入后定稿）：
- 若走「原站壳 + 注入增强层」路线：两者都可行。Windows 优先 → Tauri+WebView2 体积/内存优势明显；若要**单窗口多标签原站浏览**或团队零 Rust → Electron 更顺。
- 若走「完全自建 UI + API」路线（FluxDO 路线）：前端框架（React/Vue）+ Electron/Tauri 均只是壳，选择影响更小；工作量主要在 UI 与 API 层。
- linux.do 在 Cloudflare 后面：完全自建 UI 路线需要处理 CF 挑战/登录（cookie 或 user-api-key），风险与工作量显著高于壳路线。

# 待决策问题（已向用户提问）

1. 应用形态：A 原站壳+注入增强层 / B 完全自建 UI+API / C 混合
2. 是否直接内嵌 ALDR standalone（MIT）作为增强层
3. 目标平台（Windows only / +macOS / 全平台）
4. 用户技术栈背景（TS only / 会 Rust / 都不熟）
5. MVP 优先功能
6. 分发方式（安装包+自动更新 / 便携版 / 暂不关心）

# 状态

- [x] 研究 FluxDO
- [x] 研究 ALDR
- [x] Electron/Tauri 初步对比
- [ ] 用户澄清（进行中）
- [ ] 方案定稿 + 推荐
- [ ] 用户批准设计
# 用户决策（2026-10-15 澄清轮）

| 问题 | 决策 |
|---|---|
| 应用形态 | **B：完全自建 UI + Discourse API（FluxDO 路线）**，明确不套壳 |
| 增强层复用 | **只参考设计，全部自研**（不内嵌 ALDR） |
| 目标平台 | **Windows + macOS**（不含 Linux） |
| 技术背景 | 前端和 Rust 都不熟（学习成本是重要因子） |
| MVP 重点 | 连续阅读工作区、楼中楼/讨论上下文、翻译/离线/同步、桌面壳能力 |

# 定稿设计（待批准）

## Electron vs Tauri 终审（在上述决策语境下）

自建 UI 路线中壳只渲染自家前端，CF 压力转移到 API 客户端；Linux 平台不在目标内，Tauri 最弱的 WebKitGTK 不受影响。剩余权衡：

- **Tauri 优势**：体积 ~10MB vs ~100MB；内存低；覆盖 Win/mac 目标平台。
- **Electron 优势**：
  1. **单一 TS 语言栈**——对前端和 Rust 都不熟的开发者，只需学一门；Tauri 需装 Rust 工具链，构建报错对新手不友好；
  2. **全平台同内核**（自带 Chromium），Win/mac 渲染与行为完全一致，排障面减半；
  3. **登录/CF 兜底更容易**：Electron 的 session 可与真实 Chromium cookie 打通——user-api-key 流程或 cookie 登录可开一个嵌入式登录窗口（真实浏览器环境过 CF），net 请求共享同一 cookie jar；Tauri 中 webview 会话与 Rust HTTP 客户端是两套世界；
  4. 新手教程/生态量级更大。
- **推荐：Electron**。体积与内存劣势对桌面阅读器可接受；开发成功率与排障成本优先。若后期极度在意体积，架构上壳层很薄，可迁移。

## 技术栈（推荐）

- 壳：Electron（TS，main + renderer）
- 前端：**Vue 3 + Vite + Pinia + TypeScript**（中文文档一流、上手曲线缓；备选 React）——待用户确认
- 数据层：Discourse JSON API 客户端（自研，集中处理 UA/限流退避/CF 诊断）
- 本地存储：better-sqlite3（离线 Topic、历史、缓存）+ 设置存储
- 登录：Discourse **user-api-key** 流程（nonce + RSA 加密回传，参考 Discourse 官方协议，不抄 FluxDO 代码）；兜底嵌入式登录窗口 cookie 会话
- 实时：MessageBus 轮询（通知）
- 翻译：用户自配 OpenAI 兼容端点，双语/全译渲染
- 同步：WebDAV 客户端（分类别同步书签/进度/设置）
- 分发：electron-builder（NSIS + dmg）+ electron-updater（GitHub Releases）

## 关键 API 面（自建客户端需覆盖）

latest/top/categories/c/<slug>.json、t/<id>.json（post_stream 分页）、search、notifications、bookmarks、posts.json（回复）、post_actions（点赞/举报）、MessageBus poll；linux.do 插件能力（Reactions/Boost/Voting）为站点私有端点，**实现前抓包确认，逐个记入 spec**。

## MVP 分期

- **P0 骨架可用**：脚手架 + 登录（user-api-key + cookie 兜底）+ 分类/最新列表 + 主题阅读（长帖懒加载、已读进度）+ 楼中楼/父回复/引用回跳/只看楼主/时间轴
- **P1 互动与阅读体验**：回复/编辑/点赞/收藏/通知（MessageBus）+ 连续阅读工作区打磨（多主题队列）+ 翻译（双语）
- **P2 数据与桌面**：离线 Topic + WebDAV 同步 + 托盘/全局快捷键/原生通知 + 打包/自动更新 + macOS 构建签名

## 风险与边界

1. linux.do 在 CF 后：API 客户端需浏览器级 UA、限流退避、诊断面板；登录窗口兜底真实浏览器环境。
2. FluxDO 为 GPL-3.0：**只参考行为与 API 知识，禁止复制其代码**；ALDR 为 MIT，同样选择自研，仅参考设计。
3. 私有插件端点会变动：集中在 API 客户端层适配，spec 中记录。
4. 单人 + 新技术栈：P0 范围严格收敛，先跑通全链路再横向铺功能。

## 待最终确认

- [ ] Electron vs Tauri 最终拍板（推荐 Electron）
- [ ] 前端框架（推荐 Vue 3）
- [ ] 整体设计批准

# 状态（终）

- [x] 研究 FluxDO / ALDR
- [x] Electron/Tauri 对比 → **Electron**（用户批准）
- [x] 前端框架 → **Vue 3 + Vite + Pinia**（用户批准）
- [x] 设计批准（2026-10-15）
- [x] Promote：specs/linuxdo-desktop/SPEC.md（spec_validate 通过）
- [x] Trellis 任务：10-15-linuxdo-desktop-p0（PRD + 上下文清单）
- [x] P0 实现：脚手架 / API 客户端（UA+退避+诊断）/ 登录（cookie 窗口+api-key）/ 列表 / 主题阅读（懒加载+进度）/ reply_to 跳转 / 只看楼主 / 时间轴
- [x] 验证：typecheck ✓ build ✓ smoke（SMOKE_OK）✓
- ⚠️ 环境发现：本机（数据中心 IP）匿名访问 linux.do JSON API 被 429 限流（Electron 网络栈实测；PowerShell 直接 403）。非代码缺陷；登录 cookie 会话/住宅 IP 预期正常。交互式 UI 验证留待 `npm run dev` 人工确认。
- [ ] P1/P2 按 PRD 分期继续（回复互动、翻译、离线、桌面壳能力等）
