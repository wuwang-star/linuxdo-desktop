# design — UI 设计规范全站校准

规范基准（唯一真源）：`research/ui-design-spec.html`（13 章活样本，用户拍板稿）。

## 1. tokens.css 重构（新底座）

底座 :root 亮色组改为规范值，暗色组按映射；新增 4 槽位：

```
--bg #f2f3f5/#17191d   --panel #ffffff/#1d2126   --canvas #fafbfc/#1a1d21
--text #1f2329/#e6e8ea --muted #8f959e/#8b9198   --border #e7e8ea/#2b3138
--accent #3370ff/#457aff  --accent-weak α.10/α.18  --bad #f54a45
新增：--quote-bg #f7f9fa/#22262c  --hover rgba(31,35,41,.05)/rgba(230,232,234,.07)
      --selected #e8effd/rgba(69,122,255,.22)  --rail-bg #f5f6f7/#17191d
```

结构性 token（更名自 im-，无主题态）：
```
--space-1..5: 8/16/24/32/48   --indent-step: 32px   --rail-gap: 16px
--motion-fast/base/slow: 120/180/240ms   --ease-out: cubic-bezier(.22,1,.36,1)
--font-xl 19px --font-lg 17px --font-body 15.5px --font-md 14px --font-base 13px --font-sm 12px --font-md-nested 13.5px
--radius-xs 4 --radius-sm 6 --radius-md 8 --radius-lg 10 --radius-pill 999
--shadow-1/2/3（亮暗两套）
z 层常量不必 token 化（七层值直接写，规范表即文档）
```

`--im-*` 全部删除。data-theme='dark' 同步。主题工坊兼容：皮肤覆盖的是底座变量名 → 单轨后覆盖面自动扩大（可覆盖 --canvas 等），机制不变。

## 2. 变量替换映射表（全文件机械替换，sed 级）

| 旧 | 新 |
|---|---|
| var(--im-tx) | var(--text) |
| var(--im-tx2) | var(--muted) |
| var(--im-acc) | var(--accent) |
| var(--im-accsoft) | var(--accent-weak) |
| var(--im-line) | var(--border) |
| var(--im-panel) | var(--panel) |
| var(--im-canvas) | var(--canvas) |
| var(--im-quote-bg) | var(--quote-bg) |
| var(--im-hov) | var(--hover) |
| var(--im-sel) | var(--selected) |
| var(--im-red) | var(--bad) |
| var(--im-rail-bg) | var(--rail-bg) |
| var(--im-space-N) | var(--space-N) |
| var(--im-indent-step) / (--im-rail-gap) | var(--indent-step) / var(--rail-gap) |

注意：底座原 `--border`（旧值 #dee0e6 系）被规范值取代；原 `--accent-weak` 旧值（绿系淡底）同换。home.css `.chip`/`.act` 等用底座 accent 的规则自动变蓝，无需改。

## 3. 字号替换档位表

| 旧散数 | 归档 |
|---|---|
| 10px, 11px | var(--font-sm) 12px |
| 12px, 12.5px | var(--font-sm) |
| 13px | var(--font-base) |
| 13.5px（列表标题/meta 除外→base） | 列表标题 var(--font-base)；树形三级 var(--font-md-nested) |
| 14px | var(--font-md) |
| 15px, 15.5px（cooked） | var(--font-body) |
| 16px（控件/正文级） | var(--font-md) 或 body 按语义 |
| 17px / 18px / 19px | var(--font-lg) / var(--font-lg) / var(--font-xl) |

行高：UI 1.5 默认；cooked 1.6 保留。逐处替换时按语义对号，不盲 sed 字号。

## 4. 波次

1. tokens.css 重构（底座新值 + 结构 token + 删 im- 颜色组）。
2. 机械替换映射表（styles 全文件）→ AC1 达成。
3. 字号/圆角/阴影/z-index 逐文件归档（grep 清单驱动）。
4. 控件五态校准（base.css 公用控件 + shell.css rail/搜索）。
5. 浮层四级/反馈态样式壳对齐（queue-panel/lightbox/empty/error 已有大部，补 dialog/toast 样式壳备用类）。
6. 逐页目检：home/topic/settings/notifications/user/login。

## 5. 风险

- 底座变色 = 全应用回归（预期内，AC6 真机验）。
- 主题工坊皮肤 feishu.ts v0.1.1 引用底座变量 → 自动跟随新值；其结构规则无冲突。
- 字号语义错配风险靠「按语义对号」规则 + 用户验收兜底。
