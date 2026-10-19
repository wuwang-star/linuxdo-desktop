# linuxdo-desktop AI 数据接口（kb-api）

> 本文档面向本机 AI 助手。应用运行中且已在 设置→AI 接口 启用后，按本文直接调用。

## 基本约定

- Base URL: `http://127.0.0.1:<端口>`（端口见 设置→AI 接口，默认 17367）
- 鉴权: 每个请求带头 `X-KB-Token: <token>`（token 在 设置→AI 接口 查看）
- 所有响应为 JSON；错误形如 `{"error": "..."}`
- 底层复用应用的登录态 cookie 与网络链路（ECH 直连/上游代理），**无需再碰 linux.do**
- linux.do 排行说明：`top.json` 按周期（daily/weekly/monthly/quarterly/yearly/all）输出综合热度榜（点赞/回复/浏览加权+时间衰减，官方不公开系数）；`hot.json` 为近期热度流

## 端点

### GET /api/health
健康检查（也用于确认应用在跑）。→ `{"ok":true}`

### GET /api/top?period=weekly&page=0
总榜。period 可选 daily/weekly/monthly/quarterly/yearly/all；page 从 0 起。返回 Discourse TopicListResponse（`topic_list.topics[]` 含 id/title/like_count/posts_count/created_at 等）。

### GET /api/topic/:id?format=text
单帖全文。`format=text` 时正文 cooked HTML 已转可读纯文本（推荐喂模型）；缺省返回原始 HTML。返回 `{id,title,posts:[{post_number,username,created_at,like_count,content}]}`。

### GET /api/search?q=<关键词>&page=0
站内搜索（同应用列表搜索）。返回含 `posts[]`（blurb/username/topic_id）与 `topics[]`（title），需自行 join。

### GET /api/me
当前登录用户 + 统计（trust_level + user_summary：posts_read/topics_entered/days_visited/time_read 等）。未登录报错。

### GET /api/kb
列出知识库（userData/kb/*.md）→ `{files:[{file,title}]}`。

### POST /api/kb
写入一条知识（同 topicId 重复写=覆盖更新）。Body JSON：
```json
{
  "topicId": 123456,
  "title": "主题标题",
  "category": "分类",
  "tags": "tag1,tag2",
  "url": "https://linux.do/t/123456",
  "summary": "你的总结归纳正文（Markdown）"
}
```

## 推荐工作流（刷总榜 → 学习沉淀）

1. `GET /api/top?period=weekly` 拿本周榜（可多页）
2. 挑选目标主题，`GET /api/topic/:id?format=text` 逐篇阅读
3. 归纳分类（按你的知识体系），每篇 `POST /api/kb` 沉淀一条
4. `GET /api/kb` 检查沉淀；Markdown 在 `userData/kb/` 可直接被任何工具检索

## 安全边界

- 仅绑定 127.0.0.1，外部机器不可达
- token 为 6 位弱凭据（防本机其他程序误撞，不防恶意本机软件）
- 关闭开关 = 端口零监听
