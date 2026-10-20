# ECH 降级链加固

## Goal

发布门槛 #1 后半句落地：「ECH 失败时有明确的诊断与降级出口」。

## Requirements

- R1 ech 档网关启动失败时，降级原因（含原因文本+降级目标地址）写入模块级 echNote，经 `diag:echNote` 通道暴露，SettingsView 上游卡 ech 模式下显示。
- R2 网关运行期死亡自愈：chainWithSelfHeal 包装 ech 档链式连接，ECONNREFUSED 等失败时自动重启网关一次并换新端口重试；自愈动作有常驻日志。

## Acceptance Criteria

- [x] AC1 降级可见：二进制缺失场景下 echNote =「ECH 网关不可用（ECH 网关二进制缺失…），已降级手动上游 127.0.0.1:7890」——CDP IPC 实测 PASS
- [x] AC2 自愈：运行中 taskkill 网关后下一请求触发重启，主进程日志实锤「链路失败(ECONNREFUSED)→自愈完成(新端口 60603)」，网关进程重生——PASS
- [x] AC3 typecheck + build 通过
- [ ] AC4 （移交 M2 专项）ech 隧道自愈后经 CF 盾的端到端成功率——属 ECH 门神多环境验收，非本任务

## Out of Scope

- CF 盾层穿透率优化（M2 ECH 专项）
- 网关反复崩溃的熔断/退避（观察到再立项）
