# 设计：窗口观感

- main/index.ts BrowserWindow 增 titleBarStyle/titleBarOverlay；overlay 初始色取常量（亮 #f6f7f9/暗 #16191d 与顶栏 token 对齐，height 与 .topbar 实际高度一致——实现时读取/对齐后写死常量并注释来源）。
- prefs 主题变化通知主进程：现有 prefs 是 renderer localStorage——新增 ipc `window:syncTheme(mode|resolved)`，renderer 在 watchSystemTheme/applyThemePref 时 invoke；主进程 `nativeTheme.themeSource`（'system'|'light'|'dark'）同步设置 + setTitleBarOverlay 对应色。nativeTheme.themeSource 本身会影响 prefers-color-scheme——与 prefs 单轨制配合：prefs=system 时 themeSource='system'，亮/暗时直接设 themeSource，renderer matchMedia 随之变，双保险且删 renderer 侧特判分支的脆弱性。
- .topbar 加 drag；.topbar 内 a/button/[data-nodrag] 加 no-drag。
- 风险：overlay 高度与顶栏不一致会露缝——实现时以 styles.css .topbar 高度为准反向写 overlay.height。
