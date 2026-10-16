import type { ThemePackage } from '../../../../main/themes'

/**
 * 内置样例主题：飞书 IM 风（打样验收主题格式 v1 的表达力）。
 * 行为参照社区 userscript《Linux DO · 飞书 IM 外观》(czm15053)，追求神似非像素级复刻：
 * token 覆盖（:root / :root[data-theme='dark']）+ 结构性 CSS（会话化列表、圆形头像、左缘装饰 rail）。
 * rail 与原脚本一致为纯装饰（假图标），无交互组件。
 */
export const feishuTheme: ThemePackage = {
  format: 1,
  id: 'feishu',
  name: '飞书 IM 风',
  author: 'LinuxDo Desktop',
  version: '0.1.0',
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

/* 左缘装饰 icon rail（纯装饰，对照原脚本「假 icon 条」；窄屏单栏时隐藏） */
.browse::before {
  content: '';
  flex: none;
  width: 56px;
  align-self: stretch;
  border-right: 1px solid var(--border);
  background:
    radial-gradient(circle at 28px 42px, var(--accent) 12px, transparent 13px),
    radial-gradient(circle at 28px 104px, var(--muted) 9px, transparent 10px),
    radial-gradient(circle at 28px 152px, var(--muted) 9px, transparent 10px),
    radial-gradient(circle at 28px 200px, var(--muted) 9px, transparent 10px);
  background-repeat: no-repeat;
  opacity: 0.9;
}
.browse[data-dual='false']::before { display: none; }

/* 列表 → 会话列表：白底面板 + 圆角行卡片 + hover */
.list-pane { background: var(--panel); }
.topic-row { margin: 0 8px; padding: 10px; border-bottom: 0; border-radius: var(--radius-sm); }
.topic-row:hover { background: var(--bg); }
.avatar { border-radius: 50%; }

/* 会话区：浅灰底衬托白卡 */
.reader-pane { background: var(--bg); }
.card { box-shadow: var(--shadow); }

/* 主按钮统一飞书蓝圆角（tokens 已覆盖 --brand，此处只收半径） */
button.primary, .card button:not(.primary) { border-radius: var(--radius-sm); }
`
}
