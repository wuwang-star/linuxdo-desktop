# Implement — 用户身份流 UI

## 前置
- [x] 用户拍板方案 A + 授权后续按推荐项，完成度优先
- [ ] coordination.md 登记（分区 B/C/D 触点 + 公用文件 App.vue/preload/ipc.ts）

## Checklist（按序）
1. [ ] `utils/userCard.ts` 重写：状态机（hoverUser/cancelUser/hideNow）+ 60s 缓存 + inflight 去重
2. [ ] `components/UserHoverCard.vue` 新建（定位翻转/加载态/查看主页）；App.vue 换挂载；删 `components/UserCard.vue`
3. [ ] HomeView：列表行头像 mouseenter/leave/click → /u
4. [ ] PostItem：作者头像 + @用户名 同上；新增 reply_to 引用条（emit jump）
5. [ ] TopicView：cooked mouseover 委托（quote/mention）+ onCookedClick 拦 /u/ + jump 处理接 store.flashPost
6. [ ] stores/topic.ts：flashPn 状态
7. [ ] client.ts `fetchUserActions` + ipc `user:actions` + preload/index.d.ts 四点
8. [ ] UserProfileView 升级：banner/8统计/tab（主题|回复）
9. [ ] user.css 重写（uhc-* + profile 升级 + flash 样式入 topic.css）
10. [ ] typecheck + smoke + dev 目测要点

## 验证
- `npm run typecheck` / `npm run smoke`
- dev 手测：列表行头像 hover 出卡可移入；楼内头像 hover；引用楼头像/@mention hover；点击直达 /u；回复条跳父楼高亮；个人页回复 tab 出内容

## 风险
- TopicView capture 委托与灯箱/内链拦截的先后（mouseover 不冲突 click 路径）
- user_actions 端点匿名 403？——失败降级文案，不阻塞其余验收
