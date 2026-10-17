import type { ThemePackage } from '../../../../main/themes'

/**
 * 内置样例主题：飞书 IM 风（打样验收主题格式 v1 的表达力）。
 * feishu-im-frame 落地后应用自带真 rail/白底通铺，本皮肤收缩为纯 token 覆盖 + 局部质感
 * （0.1.1 移除旧顶栏时代的 .browse::before 假 rail 与 reader-pane 灰底——与真框架冲突）。
 */
export const feishuTheme: ThemePackage = {
  format: 1,
  id: 'feishu',
  name: '飞书 IM 风',
  author: 'LinuxDo Desktop',
  version: '0.1.1',
  css: `
:root {
  --bg: #f0f1f5;
  --panel: #ffffff;
  --text: #1f2329;
  --muted: #646a73;
  --accent: #3370ff;
  --accent-weak: #e1eaff;
  --border: #dee0e6;
  --bad: #f54a45;
  --radius: 10px;
  --radius-sm: 6px;
  --shadow: 0 4px 16px rgba(31, 35, 41, 0.08);
}
:root[data-theme='dark'] {
  --bg: #1a1b1f;
  --panel: #252629;
  --text: #e8e9ea;
  --muted: #9da2a9;
  --accent: #4a9eff;
  --accent-weak: #1f2c3d;
  --border: #33353a;
  --bad: #f56b66;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* 列表 → 会话列表：白底面板 + 圆角行卡片 + hover */
.list-pane { background: var(--panel); }
.topic-row { margin: 0 8px; padding: 10px; border-bottom: 0; border-radius: var(--radius-sm); }
.topic-row:hover { background: var(--bg); box-shadow: none; }
.avatar { border-radius: 50%; }
.row-q:hover { background: var(--bg); }

/* 工具条与浮层：飞书 popover 质感（chips/act 矩形化，面板柔影） */
.list-toolbar { background: var(--panel); }
.crumb .chip, .act, .row-q { border-radius: var(--radius-sm); }
.crumb .chip.active { background: var(--accent); }
.cat-panel, .queue-panel, .overlay .card { border-radius: var(--radius-sm); box-shadow: 0 6px 20px rgba(31, 35, 41, 0.14); }
.cat-item:hover, .queue-item:hover { background: var(--bg); }

.card { box-shadow: var(--shadow); }

/* 主按钮统一飞书蓝圆角（tokens 已覆盖 --brand，此处只收半径） */
button.primary, .card button:not(.primary) { border-radius: var(--radius-sm); }
`
}
