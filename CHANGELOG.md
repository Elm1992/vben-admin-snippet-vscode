# 更新日志

本文件记录项目的重要变更。

## 0.0.4 - 2026-03-20

- 新增命令：`Vben Admin Snippet：同步上游 Commit（安全模式）`
  - 仅支持 `vbenjs/vue-vben-admin` 的 commit SHA 或 commit URL
  - 仅当本地文件与上游父提交一致时才同步，避免覆盖二开改动
  - 支持 merge commit：默认按第 1 个父提交对比
  - 当前支持 `added / modified / removed` 文本文件同步
  - 对 `renamed`、二进制或过大补丁文件自动跳过并记录原因

## 0.0.3 - 2026-03-19

- 增强 Vben Method Index：
  - `useVbenVxeGrid` / `useVbenForm` 支持展示对象参数子项
  - 点击子项支持优先跳转到变量定义位置

## 0.0.2 - 2026-03-19

- 增加插件自动提示开关设置。

## 0.0.1 - 2026-03-16

- 首个独立发布版本。
- 新增 Vue Vben 代码片段与上下文感知补全。
- 新增命令：`Vben Admin Snippet：打开当前上下文文档`。
