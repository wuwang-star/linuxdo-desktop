# 技术设计：P2a 打包分发

## 总览

| 改动 | 位置 | 说明 |
|---|---|---|
| builder 配置 | 新增 `electron-builder.yml` | appId/productName/files(out/**)/asar 默认开/win.nsis/icon；publish 段 GitHub provider（repo 占位，等用户填） |
| 应用图标 | 新增 `build/icon.ico` + `build/icon.png`（≥256px） | 占位设计（圆底+「L」字样），托盘与安装包共用；icon 转换允许加 devDep（如 png-to-ico，不进产物） |
| 托盘 | `src/main/index.ts` | `Tray` + Menu；`win.on('close')` 拦截 → hide（除非退出 flag）；单实例已有，second-instance 时 restore+focus 逻辑已有可复用 |
| 原生通知 | `src/main/api/messagebus.ts` 或新 `notify.ts` | push 到达 → 主进程 `new Notification`；`click` → 聚焦主窗 + `webContents.send('notification:open', topicId/pn)` → renderer 路由跳转 `/t/<id>?pn=<n>`（TopicView 已支持 ?pn 直达楼层） |
| 自动更新 | `src/main/updater.ts`（新）+ `electron-updater` 依赖 | 仅 `app.isPackaged` 生效；启动后延迟 30s 检查；`update-downloaded` 弹原生通知提示重启安装；任何错误静默（logger 关闭） |

## 关键设计点

- **close ≠ quit**：加 `appIsQuitting` flag；托盘菜单「退出」置位后允许 close。macOS 行为本任务不处理（Win only）。
- **协议注册（安装态）**：NSIS per-user 安装下 `setAsDefaultProtocolClient` 用默认参数即可生效；实现时在打包版实测回调链路（AC2）。若失效，改在 NSIS 层写注册表（`nsis.include` 脚本），不改主进程代码。
- **通知 payload**：Discourse `/notification/<uid>` push 的 data 含 notification JSON（带 topic_id/post_number，以实测为准——MessageBus 频道名本身也待 P1 验收实测，本设计沿用同一校正点：字段缺失则通知只聚焦不跳转，不猜字段）。
- **updater 降级链**：未打包（dev）→ 完全不启用；`publish` 缺 repo 或网络失败 → 静默跳过；保证 AC5 的「未就绪不报错」。
- **构建镜像**：electron-builder 首次构建需下载 nsis/winCodeSign 二进制，README 记录 `ELECTRON_BUILDER_BINARIES_MIRROR`（npmmirror）备选，与现有 ELECTRON_MIRROR 并列。

## 权衡记录

- 图标占位而非等正式设计：分发阻塞于像素画的等待不值得；ico 可随时替换重打。
- electron-updater 而非手写版本检查：标准库路径，GitHub provider 零服务器；依赖新增 1 个（+构建时下载组件），换来 delta 更新与签名校验。
-NSIS oneClick 模式：双击即装，无选择目录页——自用阶段最简；需要便携版再说。

## 兼容与回滚

- dev 模式行为不变（托盘/更新在 dev 态降级：托盘可用、更新禁用）。
- R1–R5 各自独立 commit：打包配置、图标、托盘、通知、updater 可单独 revert。
- updater.ts 不实例化即回退「无更新」现状；托盘监听可整体摘除。

## 风险

- SmartScreen 未签名告警（记录，接受）。
- MessageBus push payload 字段未经实测 → 通知点击跳转可能降级为仅聚焦（已设计降级路径，不算阻塞）。
- electron-builder 在 Windows 首次构建的工具链下载可能失败 → 镜像方案写入 README，implement 时实测定稿写进 SPEC。
