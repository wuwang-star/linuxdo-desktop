# AI 数据接口与本地知识库（kb-api）

## Goal

把应用的「登录态出口」外暴露为本机 HTTP JSON API，供本机 AI（ZCode/Claude 等）拉总榜/读帖/搜索/查进度，配合 Markdown 知识库目录约定实现「AI 刷榜 → 总结归纳分类 → 沉淀学习」工作流。

用户 2026-10-19 点名：外暴露功能、AI 刷总榜、理解排序规则、统一本地知识库、总结归纳分类。

## Background

- 核心价值＝**借用登录态**：本机 AI 直连 linux.do 永远 403（CF login_required/challenge，实测），应用主进程带 cookie 走 ECH 链路。
- 排序规则：top.json 按周期综合得分（点赞/回复/浏览加权+时间衰减，系数不公开，可由 AI 拿数据反推归纳）；hot.json 近期热度流（与 latest 同构）。
- 先例：伴生扩展桥接已用「回环绑定 + 6 位弱配对码」模式（SPEC），本接口沿用。
- 知识库选型：**Markdown 文件夹约定**（userData/kb/）——AI 原生读写、可 grep、零依赖；应用只提供数据 API + KB 读写端点，不做 UI（后续可加查看页）。

## Requirements

- R1 externalApi.ts：回环 HTTP JSON 服务（默认 17367，可配），X-KB-Token 鉴权（6 位数字，沿用 genPairCode），未启用时零监听
- R2 端点：GET /api/health · /api/top?period=weekly&page=0 · /api/topic/:id（含 cooked→纯文本，?format=text） · /api/search?q= · /api/me（登录态+统计） · GET/POST /api/kb（知识库 markdown 读写）
- R3 设置页新「AI 接口」分类：开关/端口/token 展示；保存即时生效（同 bridge 模式）
- R4 docs/ai-api.md：面向 AI 的接口文档（含排序规则解释、学习工作流建议、curl 示例）
- R5 安全：仅 127.0.0.1 绑定；token 弱凭据定位同 bridge（防误撞不防本机恶意）；无 token 时 401

## Acceptance Criteria

- [ ] AC1 应用运行+已登录时，带 token curl /api/top 返回榜单 JSON；无 token 401；未启用时端口无监听
- [ ] AC2 /api/topic/:id?format=text 返回可读纯文本正文
- [ ] AC3 POST /api/kb 落盘 markdown（frontmatter+正文），GET /api/kb 列表可见
- [ ] AC4 设置页可开关/改端口/看 token，保存即时生效
- [ ] AC5 docs/ai-api.md 完整可供 AI 直接按文档调用
- [ ] AC6 typecheck + smoke 通过

## Out of Scope

- MCP 协议服务（后续可选）
- 知识库查看 UI 页
- 排序规则的权威文档化（系数不公开，由 AI 数据归纳）
