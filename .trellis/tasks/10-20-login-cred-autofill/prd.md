# 登录账密记忆与自动填充

## Goal

登录窗口打开时自动填充已记住的论坛账密（填充后由用户手动点登录），消除重复手输；凭据 safeStorage 加密落盘。

## 状态：已交付 + AC1 真机 PASS（10-20 二轮修复后）

**二轮修复（用户真机反馈「并未填充」）**：原实现 loadURL 后一次性注入，注入脚本随导航销毁（about:blank→CF 挑战→登录页两次跳转），永远等不到表单。修复：挂 `did-finish-load` 每次加载完成重注入（快照 cred 常量）；注入脚本加 `window.__lddFillTimer` 防重入、Ember 清空后重填（两框皆空才重填，用户手输不覆盖）。

## 验收

- [x] AC1 填充生效且不自动提交——CDP 实测 PASS：删 _t 临时登出 → openLogin → t+6s 页面 complete + marker=true + 表单填入真实已存账密；会话恢复无损
- [x] AC2 凭据仅 safeStorage 密文落盘（login.enc）
- [x] AC3 clearLoginCred 删文件（测试脚本曾误删用户 login.enc，已提醒用户重存）
- [x] AC4 手动登录行为不变；AC5 typecheck/build 绿

## 遗留

- 无。后续报「没自动填」先确认：选择器变更（#login-account-name/password）→ 静默降级属设计。
