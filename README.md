# Vben Admin Snippet

> **重要：默认会在 vben 组件配置上下文里按下 Enter（回车）时自动触发补全；可通过配置关闭。**

> **动态展示图（GIF）如下；看不了请访问：https://github.com/Elm1992/vben-admin-snippet-vscode/blob/main/demo.gif**

![Demo](./demo.gif)

## 功能特性

- 在 Vue SFC 中输入 `vb-` 可触发片段：
  - `vb-alert`
  - `vb-confirm`
  - `vb-prompt`
  - `vb-modal`
  - `vb-drawer`
  - `vb-form`
  - `vb-vxe-table`、
  - `vb-page`（完整 SFC 模板，仅在 `<script>` 之外可用）
- 在以下调用中提供上下文配置项补全：
  - `useVbenForm({})`
  - `useVbenModal({})`
  - `useVbenDrawer({})`
  - `useVbenVxeGrid({})`
  - `alert({、】})`
  - `confirm({})`
  - `prompt({})`

- 提供 API 方法补全：
  - `modalApi.`
  - `drawerApi.`
  - `formApi.`
  - `gridApi.`

## 配置项

- `vbenAdminSnippet.enableEnterTriggerSuggest`：是否开启“按 Enter 自动触发补全”，默认 `true`。

## 环境要求

- Node.js 20 及以上
- VS Code 1.90 及以上

## 许可证

[MIT](./LICENSE)
