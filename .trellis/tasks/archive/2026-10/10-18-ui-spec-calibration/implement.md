# implement — UI 设计规范全站校准

按 design.md 波次执行；零逻辑改动（不动 TS/Vue script 逻辑、不动 IPC，模板只允许动 class/样式相关属性）。

1. tokens.css 重构 → 2. 映射表机械替换 → 3. 字号/圆角/阴影/z-index 归档 → 4. 控件五态 → 5. 浮层/反馈态壳 → 6. 逐页目检清单。

## 验证

```bash
npm run typecheck && npm run build
grep -rn "var(--im-" src/renderer/src   # 必须 0 命中（AC1）
grep -rn "font-size: 1[01]px" src/renderer/src/assets/styles  # 必须 0 命中
```

## 回滚

单提交批次 revert。

## 登记

coordination.md 已登记主会话主导的全站样式校准（跨 A-F 区 styles）。
