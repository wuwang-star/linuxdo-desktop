# 技术设计：阅读体感

## 结构

| 组件 | 位置 | 说明 |
|---|---|---|
| 偏好模块 | 新增 `src/renderer/src/utils/prefs.ts` | `ReadingPrefs` 接口（fontSize/lineHeight/fontFamily/width/theme），默认值常量，localStorage `ldd-reading` 读写（try/catch），`applyPrefs()` 把值写为 `document.documentElement` 上的 CSS 变量与 `data-theme` 属性 |
| CSS 接线 | `styles.css` | `:root` 增 `--reading-font-size/--reading-line-height/--reading-font-family/--reading-width`；正文区（PostItem cooked、topic 标题、时间轴）改引这些变量；`data-theme="light|dark"` 两套变量组（现有暗色 media query 值迁移进 `data-theme='dark'` 与 `@media` 双轨：media 供跟随系统，attribute 供手动覆盖——实现取「跟随系统=JS 监听 media 变化同步 attribute」单轨制，删 media 分叉） |
| 设置中心 | `SettingsView.vue` | 外观分类：主题模式分段（跟随系统/亮/暗）；阅读分类：四个控件（字号 stepper、行距/宽度分段、字体族分段）+ 恢复默认；替换两张占位卡 |
| 启动 | `App.vue` onMounted | `applyPrefs(loadPrefs())` + theme media 监听 |

## 关键点

- **单轨主题**：`data-theme` 由 JS 决定（system→跟随 matchMedia 实时换属性值），CSS 只认 attribute，消灭 media query 与手动覆盖的双轨竞争。
- **亮色变量组**：从现有暗色组反推（底 #f6f7f9、面板 #fff、文本 #1a1d21、边 #e5e7eb、accent #1a7f64）；PostItem cooked 内嵌内容里的硬编码色（如有）逐个排查替换为变量——实现时以 smoke+目测为准。
- **字体族预设**：system（ui-sans-serif 栈）/ serif（Georgia,思源宋体,serif）/ sans（Segoe UI,PingFang SC,sans-serif）/ mono（Consolas,monospace）→ `--reading-font-family`； cooked 内 code 块仍用 `--font-mono` 不受影响。
- **宽度**：`.topic-scroller` 内容列 `max-width: var(--reading-width)`（全宽=none）居中；时间轴贴右侧不参与。
- **即时生效**：SettingsView 改 prefs → savePrefs+applyPrefs 同步调用；TopicView 无需监听（CSS 变量全局）。

## 权衡

- renderer localStorage 而非主进程 settings：纯 UI 状态、无安全敏感、省 IPC；与桥接/DoH（主进程）分源是刻意分层。
- 不做逐项动画过渡：CSS transition 加在颜色/宽度上即可，零 JS。

## 回滚

prefs.ts + SettingsView 两分类 + CSS 变量接线均可独立 revert；localStorage 键独立，无迁移。
