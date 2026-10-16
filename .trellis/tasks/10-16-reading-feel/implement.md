# 执行计划：阅读体感

1. [ ] utils/prefs.ts：ReadingPrefs/默认值/localStorage 读写/applyPrefs（CSS 变量+data-theme）/system 模式 matchMedia 监听。
2. [ ] styles.css：`:root` 四个 reading 变量接线到正文区；`data-theme` 双组变量（亮/暗完整）；移除原 media query 暗色分叉；PostItem cooked 硬编码色替换。
3. [ ] App.vue：onMounted applyPrefs + media 监听注册。
4. [ ] SettingsView：外观分类（主题模式分段）+ 阅读分类（字号/行距/字体/宽度四控件 + 恢复默认）替换占位卡。
5. [ ] README/SPEC 补记（阅读偏好、单轨主题机制）。
6. [ ] typecheck（每步）+ smoke；prd 勾 AC4，AC1–AC3 留人工。

## 验证

- 手工：四项调整即时生效+重启保持；亮色全页面排查（登录/列表/阅读/设置/离线提示）；跟随系统模式切换系统主题实时变。
