# implement — 冷启动黄金路径

design 决策全部凝固在 prd + mockup（逐屏实现）。执行顺序：

1. **主进程检测编排**：新 `src/main/api/netdetect.ts`（或并入 dohProxy 域）——`runDetect(onStep)`：步1 DNS（diagResolve linux.do）、步2 ECH 探测（ech 既有能力）、步3 连通（fetch about.json 轻探）；IPC `net:detect` + 进度事件通道；结论枚举 `direct-ok / need-shield / fail`；整体 15s 超时。
2. **流程壳**：prefs `onboardingDone`；router 守卫；`views/WelcomeView.vue` 8 屏状态机（按 mockup data-s 屏名逐屏实现，样式进 shell.css @scope 段）。
3. **诊断面板**：`components/DiagPanel.vue` + 全局错误 toast 接线（client.ts 错误路径发通知 → renderer 捕获展示；复用既有通知/诊断通道，勿自造轮）。
4. **第一帖 badge**：主框架一次性「🎉 一切就绪」。
5. **文案过筛**（AC7）。

## 验证

```bash
npm run typecheck && npm run build
```
真机：AC1-7 逐条（删 prefs 模拟新用户 / 有 cookie 老用户 / 断网模拟 fallback / 403 触发诊断）。

## 回滚

单提交 revert；prefs 新字段向后兼容（缺省=false）。
