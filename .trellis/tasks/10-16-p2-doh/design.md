# 技术设计：DoH

## 总览

| 改动 | 位置 | 说明 |
|---|---|---|
| 配置扩展 | `src/main/api/settings.ts` | `StoredConfig` 增 `dohEnabled/dohMode/dohTemplate`（旧文件无字段=默认值，向后兼容）；新增 `loadDohEarly()` 与 `getDohConfig()/setDohConfig()` |
| 启动开关 | `src/main/index.ts` | `app.whenReady` **前**：`enabled` 时 `appendSwitch('enable-features','DnsOverHttps')` + `dns-over-https-mode` + `dns-over-https-templates` |
| IPC | `src/main/ipc.ts` | `settings:getDoh` / `settings:setDoh` / `diag:resolveDns`（→ `session.defaultSession.resolveDNS(host)` 返回地址数组）；preload/index.d.ts 同步 |
| 设置 UI | `LoginView.vue` 设置区 | DoH 分组：开关、模式 radio（secure/auto）、模板下拉（3 预设+自定义）、「测试解析」按钮与结果行、「下次启动生效」标注 |

## 关键设计点

- **early load 与 safeStorage 解耦**：`settings.ts` 的 `loadOnce()` 会读加密密钥文件，`safeStorage` 在 ready 前行为不保证。新增 `loadDohEarly()` 只读 JSON 部分供启动期使用，不触碰 safeStorage。
- **模板校验**：必须 `https://` 开头的合法 URL（`new URL` 解析通过），非法值静默回退默认模板——防怪值进命令行。
- **resolveDNS 与 DoH 的关系**：Chromium host resolver 即 DoH 客户端（secure 模式强制走模板），`resolveDNS` 走同一 resolver。此点未实测，**校正点**：测试按钮结果若与 DoH 状态无关，改用「对比法」佐证（模板填故意不可达值，观察解析差异），结论记 SPEC。
- **mode=auto 语义**：Chromium 对应 `dns-over-https-mode=auto`——优先模板解析、失败回退系统 DNS；secure 失败即全挂。UI 文案写清差别，默认 secure（可达性收益最大化），被墙环境引导切 auto。
- **预设模板说明**：1.1.1.1/dns.google 在部分网络同样被墙；阿里 DoH 国内可达性最好但对其而言 linux.do 解析无差别（DNS 结果一致）。预设全部给出，用户按环境自选。

## 权衡记录

- Chromium 原生开关 vs FluxDO 式独立 DoH 代理：原生开关 ≈ 10 行接线，覆盖本应用全部流量的 DNS 层；代理方案引入本地端口/生命周期/体积成本，无可证增量收益。选原生。
- 明文 JSON vs safeStorage：DoH 配置无秘密（模板 URL 非凭据），明文落盘与 translate 配置同权。

## 兼容与回滚

- 默认 enabled=true 是行为变更（DNS 解析路径变化）；出问题设置页一键关。保守回退：把默认改 false 即回到现状。
- 各改动独立 commit，updater/托盘（p2a）与本任务无文件交集（除 index.ts 少量行）。

## 风险

- secure 模式在「DoH 域也被墙」环境 = 完全不可用 → UI/README 提示切 auto 或关闭（产品降级路径已内置）。
- ECH 生效与否不可从应用层观测（Chromium 内部），SPEC 只声明「具备路径」不承诺效果。
