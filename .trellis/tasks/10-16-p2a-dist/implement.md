# 执行计划：P2a 打包分发

## 顺序清单

1. [ ] 图标：生成占位 icon（`build/icon.png` 512px + `build/icon.ico`），允许为转换加 devDep（不进运行时依赖）。
2. [ ] `electron-builder.yml`（appId/productName/files/asar/nsis/icon；publish 段写占位注释）→ `pnpm run dist` 出安装包 → 本机安装验证 AC1（应用名/图标/可启动）。
3. [ ] 协议注册安装态验证：安装版发起 Connect/登录授权 → 系统浏览器回调可达；失效则 NSIS include 写注册表修复。
4. [ ] 托盘：Tray+菜单（显示/退出）、关窗隐藏驻留、`appIsQuitting` flag；验证 AC3。
5. [ ] 原生通知：push → Notification → 点击聚焦+跳转（payload 字段实测，缺字段降级仅聚焦）；验证 AC4。
6. [ ] 自动更新：加 electron-updater 依赖 + `src/main/updater.ts`（dev 不启用/错误静默/下载完成通知）。**前置：用户给 GitHub owner/repo** → 填 builder.yml publish；repo 未就绪则只做依赖+降级路径，AC5 挂起。
7. [ ] README 补记打包/镜像/发版流程；SPEC 更新（Win 签名风险接受、macOS 后置、发版流程指针）。
8. [ ] 全量验证：typecheck + smoke + dist 重跑；安装版冒烟（登录→通知→托盘退出）。

每步后跑 `pnpm run typecheck`；步骤 2 起每步产物在 dev 态回归冒烟。

## 验证命令

- `pnpm run typecheck` / `pnpm run smoke`（常规）
- `pnpm run dist`（步骤 2、6、8）
- 安装版手工验证：AC1–AC5 逐条（需真实登录态与第二个通知源）

## 风险文件与回滚点

- `src/main/index.ts`：托盘与 close 拦截改动集中此处，回滚 revert 单 commit。
- `electron-builder.yml`：新文件，删除即回退到无打包态。
- 步骤 6 无 repo 时不得阻塞后续：占位 publish 注释掉，updater 走降级。

## task.py start 前检查

- [ ] implement.jsonl / check.jsonl 含真实条目
- [ ] prd/design/implement 齐备
- [ ] 用户批准最终规划摘要（含更新通道默认值）
