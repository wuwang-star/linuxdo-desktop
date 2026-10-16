# 执行计划：离线 Topic

1. [x] offline.ts：saveTopic（全量分块循环+内存组装+原子写）/listTopics/getTopic/removeTopic；index 维护。
2. [x] ipc + preload 两件：offline:save/list/get/remove。
3. [x] topic store + TopicView：?offline=1 走离线；offline 模式隐藏互动按钮；保存按钮+进度文字；在线失败提示离线入口。
4. [x] HomeView：离线 chip + index 列表 + 行内删除。
5. [x] styles.css：offline-tip/徽标少量规则。
6. [x] README/SPEC 补记（JSON 存储选型与边界：不含图片、快照语义）。
7. [x] typecheck（每步）+ smoke 收尾；prd 勾 AC5，AC1–AC4 留人工。

## 验证

- 手工：保存长帖（>100 楼）→ 断代理 → 离线列表打开阅读 → 删除；在线失败回落提示。
