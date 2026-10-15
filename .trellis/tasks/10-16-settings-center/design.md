# 技术设计：设置中心

## 结构

| 改动 | 位置 | 说明 |
|---|---|---|
| 路由 | `src/renderer/src/router/index.ts` | 新增 `/settings` → `SettingsView.vue`（懒加载） |
| 设置页 | 新增 `src/renderer/src/views/SettingsView.vue` | 左分类（网络/翻译/关于）+ 右内容面板；样式沿用 `.card`/`.act` 等既有 class，新增少量 styles.css 规则 |
| 迁移源 | `LoginView.vue` | 删除内嵌设置表单（translate + DoH 组），原逻辑整体搬移；保留「设置」入口（链接到 /settings） |
| 顶栏入口 | `App.vue` | 顶栏加「设置」入口（RouterLink 或按钮 push） |
| 版本号 | 最简路径 | `__APP_VERSION__` 由 vite define 注入 package.json version（electron.vite.config.ts renderer define），SettingsView 直接读取；不新增 IPC |
| 通知跳转清理 | `App.vue` | 已有 onNotificationOpen 订阅不受影响 |

## 迁移原则

- 搬运=代码移动+容器改造，**不改任何交互语义**：DoH 组的开关/radio/模板/测试解析/实验标注、翻译组的保存/回填/key 掩码（hasKey 布尔）原样保留。
- 表单状态留在组件本地（与现 LoginView 同模式），保存即调既有 IPC。
- 设置页不依赖登录态：`onMounted` 直接拉 getDohConfig/getTranslateConfig（这些 IPC 无鉴权要求，匿名可读配置界面）。

## 版本注入权衡

vite define 注入（构建期常量）优于新增 IPC：零运行时成本、打包/dev 一致。main 的 package.json version 读取放 electron.vite.config.ts（node 端可 require）。

## 回滚

单 commit（纯 renderer + 构建配置 define），revert 即回 LoginView 内嵌形态。

## 风险

- LoginView 迁移时误删登录逻辑 → 验证：登录/Connect 授权流回归 smoke + 人工开 dev 看 login 页。
- styles.css 类名复用冲突 → 新增规则用 `.settings-*` 前缀隔离。
