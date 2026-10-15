# linuxdo-desktop

[linux.do](https://linux.do/) 第三方桌面客户端。**Electron + Vue 3 + Pinia + TypeScript**，完全自建 UI 直接消费 Discourse JSON API（不套壳）。

架构决策见 `specs/linuxdo-desktop/SPEC.md`。

## 快速开始

包管理器统一用 **pnpm**（`pnpm-workspace.yaml` 已放行 Electron/esbuild 的构建脚本）。

```bash
pnpm install         # 若 Electron 二进制下载失败：$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; node node_modules/electron/install.js
pnpm run dev         # 开发模式（热重载）
pnpm run typecheck   # 类型检查（node + renderer）
pnpm run build       # 产物构建到 out/
pnpm run smoke       # 冒烟：启动→窗口→SMOKE_OK→自动退出
```

> 注意：pnpm ≥10 默认不执行依赖的 postinstall 脚本；若换环境后报 `Electron uninstall`，确认 `pnpm-workspace.yaml` 的 `allowBuilds` 含 `electron: true`，再补跑上面的镜像命令。不要混用 npm（会产生两套 lockfile）。

## 当前能力（P0）

- 主进程统一 Discourse 客户端：浏览器级 UA、429 指数退避（尊重 Retry-After）、请求诊断（登录页可见）
- 登录：嵌入式真实浏览器登录窗口（过 Cloudflare，cookie 与 API 共享默认 session）+ User API Key（safeStorage 加密存储）
- 最新/分类主题列表，无限滚动
- 主题阅读：post_stream 全量 id + 分块懒加载（向上加载更早楼层、滚动锚点保持）、已读进度保存与恢复
- 讨论上下文：reply_to 父回复跳转（按需加载分块）、只看楼主、右侧楼层时间轴

## 安全边界

- 登录凭据只存本机（safeStorage 加密），不参与任何同步/导出
- FluxDO（GPL-3.0）仅参考行为，未复用任何代码
