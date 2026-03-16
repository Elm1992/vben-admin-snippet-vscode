# Vben Admin Snippet

![Demo](./demo.gif)

> **重要：上下文智能补全必须在 vben 组件里按下 Enter（回车）才能触发。**

## 功能特性

- 在 Vue SFC 中输入 `vb-` 可触发片段：
  - `vb-alert`
  - `vb-confirm`
  - `vb-prompt`
  - `vb-modal`
  - `vb-drawer`
  - `vb-form`
  - `vb-vxe-table`
  - `vb-page`（完整 SFC 模板，仅在 `<script>` 之外可用）
- 在以下调用中提供上下文配置项补全：
  - `useVbenForm({})`
  - `useVbenModal({})`
  - `useVbenDrawer({})`
  - `useVbenVxeGrid({})`
  - `alert({})`
  - `confirm({})`
  - `prompt({})`
- 在 `const xxx: VxeGridProps = {}` 顶层对象中，支持属性补全与 `key: value` 片段插入（必须按 Enter / 回车触发上下文智能补全）。

- 提供 API 方法补全：
  - `modalApi.`
  - `drawerApi.`
  - `formApi.`
  - `gridApi.`

## 环境要求

- Node.js 20 及以上
- VS Code 1.90 及以上

## 许可证

[MIT](./LICENSE)
