# Design — 用户身份流 UI（悬浮卡/个人页/回复关系）

## 已拍板决策（用户授权按推荐项执行，2026-10-18）

- **D1 交互总纲＝方案 A**：hover 预览卡（400ms 延迟出现）+ 点击头像直达 `/u/:username`；**现有 modal 弹卡删除**。四类触点统一：列表行头像、楼内作者头像、@用户名、正文引用楼头像、cooked 内 @mention。
- **D2 个人页**：banner 头卡（card_background 有则用，无则 accent 渐变兜底）+ 8 项统计 + 「主题/回复」两 tab；回复流走 `/user_actions.json?filter=5`（新端点，匿名/字段形态待真机核验，失败降级空态文案）。
- **D3 回复关系**：PostItem 有 `reply_to_post_number` 时渲染「回复 #pn」引用条，点击 jumpTo 父楼 + 目标楼高亮 1.6s（store 新增 flash 状态）；树形串折叠已有，不重做。

## 架构

```
utils/userCard.ts（状态机单例）        components/UserHoverCard.vue（挂 App.vue 根，全局唯一）
  hoverUser(name, rect) ─400ms→ 显示     定位：fixed 于锚点矩形，下右上左翻转 + 视口钳制，宽 300
  cancelUser() ─150ms 宽限→ 隐藏         内容：头像48/名+TL/STAFF/title/@名/bio 两行钳/3统计/最近1贴/查看主页→
  hideNow()：滚动(capture)/路由/Esc       数据：Map 缓存 60s TTL + inflight 去重（user+summary 并取）
```

- **UserCard.vue（modal）删除**：App.vue 卸载挂载、utils/userCard.ts 重写、HomeView `showUser`/PostItem `openUserCard` 改 hover+router.push。
- **cooked 委托**（TopicView）：mouseover/mouseout capture 匹配 `aside.quote .title`（用户名取其内 a[href*="/u/"]）与 `a.mention`；`onCookedClick` 在 parseSiteTopicLink 前拦 `/u/` 路径（绝对/相对）→ router.push（hover 卡即时隐藏）。
- **IPC 四点**（user_actions）：client.ts `fetchUserActions(username, filter=5)` → ipc `user:actions` → preload → index.d.ts。响应 `{user_actions?: Array<{topic_id,title,excerpt,post_number,created_at}>}`，异常/空归一 []。
- **flash 高亮**：stores/topic.ts 加 `flashPn` + `flashPost(pn)`（1.6s 自清）；PostItem 根元素 :class flash。

## 兼容与边界

- 触屏/无 hover：桌面应用为主，mouseenter 系不触发即退化为点击直达主页（天然降级）。
- user_actions 形态风险：字段缺失按可选消费；请求失败 tab 内 error 文案不炸页面。
- 分区 D（UserCard/UserProfileView/user.css 原属主题工坊会话）经用户点名本任务接管，公告板登记。
- 回滚：revert 单提交；modal 删除随本提交，回滚即整体还原。

## 已知天花板（ponytail）

- user_actions 拉一页 30 条不翻页；hover 卡不做 badge 徽章墙；card_background 可能是站点相对模板路径，非图片 URL 时兜底渐变。
