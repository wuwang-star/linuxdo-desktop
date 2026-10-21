/**
 * 阅读体感偏好（纯 renderer 本地状态）
 *
 * 排版/主题属 UI 状态：不经主进程、不进 safeStorage，直接以 CSS 变量 +
 * data-theme 属性应用到 documentElement，持久化在 localStorage（键 ldd-reading）。
 * 与桥接/DoH 的主进程 settings.json 是刻意分层（见任务 design.md 权衡）。
 */

export type FontFamilyPref = 'system' | 'serif' | 'sans' | 'mono'
export type WidthPref = 'full' | 960 | 1120 | 1280
export type ThemePref = 'system' | 'light' | 'dark'
/** 阅读页楼层视图：时间流 / 树形（楼中楼） */
export type ViewModePref = 'stream' | 'tree'
/** 列表样式（三态对应设计稿方案）：悬浮行 / 卡片流 / 紧凑密排 */
export type ListStylePref = 'float' | 'card' | 'compact'

export interface ReadingPrefs {
  /** 正文字号 px（14–20） */
  fontSize: number
  /** 正文行距（1.5/1.7/1.9） */
  lineHeight: number
  /** 正文字体族 */
  fontFamily: FontFamilyPref
  /** 阅读宽度（全宽 = 'full'，否则 px） */
  width: WidthPref
  /** 主题模式（system = 跟随系统实时切换） */
  theme: ThemePref
  /** 楼层视图模式（默认时间流 = 现状） */
  viewMode: ViewModePref
  /** 列表样式（默认悬浮行） */
  listStyle: ListStylePref
  /** 外框架左 rail 是否收起（feishu-im-frame：收起 56px 纯 icon） */
  railCollapsed: boolean
  /** 中栏列表宽度（px，240–520 拖拽可调） */
  listWidth?: number
  /** @scope: golden-path —— 冷启动 onboarding 已完成（老用户/已完成者跳过欢迎流；缺省 false 向后兼容） */
  onboardingDone: boolean
  /** 第一帖「一切就绪」badge 已展示（一次性，PRD R7） */
  readyBadgeShown: boolean
}

export const DEFAULT_PREFS: ReadingPrefs = {
  fontSize: 16,
  lineHeight: 1.7,
  fontFamily: 'system',
  width: 1120,
  theme: 'system',
  viewMode: 'stream',
  listStyle: 'float',
  railCollapsed: false,
  listWidth: 312,
  onboardingDone: false,
  readyBadgeShown: false
}

const STORAGE_KEY = 'ldd-reading'

/** 字体族预设 → CSS font-family 栈 */
const FONT_FAMILIES: Record<FontFamilyPref, string> = {
  system: "ui-sans-serif, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
  serif: "Georgia, 'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif",
  sans: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  mono: "Consolas, 'Courier New', monospace"
}

const FONT_SIZE_MIN = 14
const FONT_SIZE_MAX = 20
const LINE_HEIGHTS = [1.5, 1.7, 1.9]
const WIDTHS: WidthPref[] = [960, 1120, 1280]

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** 逐字段归一化：脏数据/越界值回退默认，不整体丢弃 */
export function normalizePrefs(raw: unknown): ReadingPrefs {
  const d = DEFAULT_PREFS
  if (typeof raw !== 'object' || raw === null) return { ...d }
  const r = raw as Record<string, unknown>

  const fontSize = typeof r.fontSize === 'number' && Number.isFinite(r.fontSize)
    ? clamp(Math.round(r.fontSize), FONT_SIZE_MIN, FONT_SIZE_MAX)
    : d.fontSize
  const lineHeight = LINE_HEIGHTS.includes(r.lineHeight as number)
    ? (r.lineHeight as number)
    : d.lineHeight
  const fontFamily = (['system', 'serif', 'sans', 'mono'] as const).includes(r.fontFamily as FontFamilyPref)
    ? (r.fontFamily as FontFamilyPref)
    : d.fontFamily
  const width =
    r.width === 'full' || WIDTHS.includes(r.width as WidthPref) ? (r.width as WidthPref) : d.width
  const theme = (['system', 'light', 'dark'] as const).includes(r.theme as ThemePref)
    ? (r.theme as ThemePref)
    : d.theme
  const viewMode = (['stream', 'tree'] as const).includes(r.viewMode as ViewModePref)
    ? (r.viewMode as ViewModePref)
    : d.viewMode
  const listStyle = (['float', 'card', 'compact'] as const).includes(r.listStyle as ListStylePref)
    ? (r.listStyle as ListStylePref)
    : d.listStyle
  const railCollapsed = r.railCollapsed === true
  const listWidth = typeof r.listWidth === 'number' && r.listWidth >= 240 && r.listWidth <= 520 ? Math.round(r.listWidth) : 312
  // 布尔归一：undefined（旧存储无字段）→ false；其余强转防脏数据
  const onboardingDone = r.onboardingDone === true
  const readyBadgeShown = r.readyBadgeShown === true

  return {
    fontSize,
    lineHeight,
    fontFamily,
    width,
    theme,
    viewMode,
    listStyle,
    railCollapsed,
    listWidth,
    onboardingDone,
    readyBadgeShown
  }
}

export function loadPrefs(): ReadingPrefs {
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(p: ReadingPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* 存储不可用时静默：本次会话内 CSS 变量仍生效 */
  }
}

// ---------- @scope: golden-path —— 冷启动 onboarding 一次性标记（PRD R1/R7） ----------

/** 标记 onboarding 完成（幂等）：欢迎流完成或守卫识别老用户时调用 */
export function markOnboardingDone(): void {
  const p = loadPrefs()
  if (!p.onboardingDone) {
    p.onboardingDone = true
    savePrefs(p)
  }
}

/** 标记就绪 badge 已展示（幂等）：展示过/被点击/到时后调用 */
export function markReadyBadgeShown(): void {
  const p = loadPrefs()
  if (!p.readyBadgeShown) {
    p.readyBadgeShown = true
    savePrefs(p)
  }
}

/** 主题偏好 → 实际 data-theme 属性值（system 经 matchMedia 实时映射） */
function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

/** 把偏好写为 documentElement 上的 CSS 变量与 data-theme 属性（全局即时生效） */
export function applyPrefs(p: ReadingPrefs): void {
  const root = document.documentElement
  root.style.setProperty('--reading-font-size', `${p.fontSize}px`)
  root.style.setProperty('--reading-line-height', String(p.lineHeight))
  root.style.setProperty('--reading-font-family', FONT_FAMILIES[p.fontFamily])
  root.style.setProperty('--reading-width', p.width === 'full' ? 'none' : `${p.width}px`)
  root.dataset.theme = resolveTheme(p.theme)
  root.dataset.listStyle = p.listStyle
}

let media: MediaQueryList | null = null

/**
 * 注册 system 主题的实时跟随（系统亮暗切换 → 重写 data-theme）。
 * 仅当当前偏好为 system 时才生效；返回解绑函数供 onBeforeUnmount 调用。
 */
export function watchSystemTheme(): () => void {
  media = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (): void => {
    if (loadPrefs().theme === 'system') applyPrefs(loadPrefs())
  }
  media.addEventListener('change', handler)
  return () => {
    media?.removeEventListener('change', handler)
    media = null
  }
}