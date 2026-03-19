# Vben Admin Snippet

> **重要：默认会在 vben 组件配置上下文里按下 Enter（回车）时自动触发补全；可通过配置关闭。**

> **动态展示图（GIF）如下；看不了请访问：https://github.com/Elm1992/vben-admin-snippet-vscode/blob/main/demo.gif**

![Demo](./demo.gif)

![Demo](./demo.png)

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

| 配置项                                       | 类型      | 默认值   | 说明                                                                          |
| -------------------------------------------- | --------- | -------- | ----------------------------------------------------------------------------- |
| `vbenAdminSnippet.enableEnterTriggerSuggest` | `boolean` | `true`   | 是否在 Vue SFC `<script>` 的 Vben 组件配置上下文中按 Enter 自动触发补全建议。 |
| `vbenAdminSnippet.enableMethodIndex`         | `boolean` | `true`   | 是否启用侧边栏 `Vben Method Index` 视图。                                     |
| `vbenAdminSnippet.methodIndexSort`           | `string`  | `"line"` | 方法索引排序方式：`line` 按出现顺序，`name` 按名称排序。                      |
| `vbenAdminSnippet.methodIndexDebounceMs`     | `number`  | `250`    | 方法索引刷新防抖时间（毫秒），取值范围 `50` 到 `1000`。                       |

`settings.json` 示例：

```json
{
  "vbenAdminSnippet.enableEnterTriggerSuggest": true,
  "vbenAdminSnippet.enableMethodIndex": true,
  "vbenAdminSnippet.methodIndexSort": "line",
  "vbenAdminSnippet.methodIndexDebounceMs": 250
}
```

## 环境要求

- Node.js 20 及以上
- VS Code 1.90 及以上

## 许可证

[MIT](./LICENSE)
