# 执行计划：阅读体感

1. [ ] utils/prefs.ts：ReadingPrefs/默认值/localStorage 读写/applyPrefs（CSS 变量+data-theme）/system 模式 matchMedia 监听。
2. [ ] styles.css：`:root` 四个 reading 变量接线到正文区；`data-theme` 双组变量（亮/暗完整）；移除原 media query 暗色分叉；PostItem cooked 硬编码色替换。
3. [ ] App.vue：onMounted applyPrefs + media 监听注册。
4. [ ] SettingsView：外观分类（主题模式分段）+ 阅读分类（字号/行距/字体/宽度四控件 + 恢复默认）替换占位卡。
5. [ ] README/SPEC 补记（阅读偏好、单轨主题机制）。
6. [ ] typecheck（每步）+ smoke；prd 勾 AC4，AC1–AC3 留人工。
7. [x] cooked Discourse 结构排版全量重设计（2026-10-16 用户指令「正文排版 UI 重新设计」，折进本任务 R3）：标题层级梯度/hr 收窄/链接下划线偏移+mention 药丸/表格块级横滚+斑马纹/code-pre 提亮（--panel 底+描边）/aside.quote 引用楼卡片化/onebox 链接卡片/details 折叠/poll 最小卡片/img.emoji 行内尺寸，纯 topic.css 分区 B，不碰公用。（待人工验收）

## 验证

- 手工：四项调整即时生效+重启保持；亮色全页面排查（登录/列表/阅读/设置/离线提示）；跟随系统模式切换系统主题实时变。
