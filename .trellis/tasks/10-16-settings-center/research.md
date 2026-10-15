# 参考调研：FluxDO / ALDR 设置结构（2026-10-16，zread 行为/设计级）

## FluxDO（Lingyan000/fluxdo，GPL——仅参考行为）
设置相关页面（lib/pages/）：
- appearance_page（外观）、preferences_page（偏好/阅读行为）
- network_settings_page：doh_settings_card、http_proxy_card、rate_limit_card、vpn_auto_toggle_card、cf_verify_card、rhttp_engine_card、advanced/debug 卡片
- notifications_page、data_management_page（数据管理）、app_logs_page（日志）、about_page（关于）
- 特点：按域分页面，网络设置内聚成组（DoH/代理/限流/CF 验证各自卡片）

## ALDR（sunbigfly/awesome-linuxdo-reader，MIT——可参考设计）
偏好域（~100 字段，18 项设置面板）：阅读器模式/图像/主题/字体/外观/布局/性能/网络/窗口/交互/快捷键/过滤器/跳转高亮/增强复制
组合设置导出：偏好+自定义站点+翻译+WebDAV 单文件导出，`omittedSecrets` 显式省略凭据（translation.apiKey/webDav.*），导入四存储原子提交带回滚。
可借鉴：归一化函数全函数化（非法值回退默认）、性能预设+自动检测 custom、导出信封带 schemaVersion。

## 本项目取舍（MVP 设置中心）
搬两类现有设置 + 关于页，其余分类等有实体设置项再开：
- 网络：DoH 全组（已实现，含实验标注）
- 翻译：translate 全组（已实现）
- 关于：应用名/版本/SPEC·README 指针
- 不做：外观/主题（无主题系统）、通知偏好/同步/导入导出（P2b+，分类留待有实体项时新增）
