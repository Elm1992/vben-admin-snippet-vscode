import * as vscode from 'vscode';

import {
  COMPONENT_OPTION_META,
  COMPONENT_OPTION_VALUE_SNIPPETS,
} from '../vben-data.js';
import {
  createDocumentationMarkdown,
  getApiDocsUrl,
  getFunctionDocsUrl,
  getSnippetDocsUrl,
} from './docs-links.js';
import {
  buildImportInsertionEdits,
  stripLeadingImports,
} from './import-edits.js';

const COMPONENT_DISPLAY_MAP = {
  alert: 'Vben 提示框',
  confirm: 'Vben 确认框',
  prompt: 'Vben 输入框',
  VxeGridProps: 'VxeGrid 配置',
  useVbenDrawer: 'Vben 抽屉',
  useVbenForm: 'Vben 表单',
  useVbenModal: 'Vben 弹窗',
  useVbenVxeGrid: 'Vben Vxe 表格',
};

function getComponentDisplayName(functionName) {
  return COMPONENT_DISPLAY_MAP[functionName] || functionName;
}

function getOptionDescription(functionName, optionName) {
  return (
    COMPONENT_OPTION_META[functionName]?.[optionName] ||
    `${optionName} 配置项`
  );
}

function getOptionValueSnippet(functionName, optionName) {
  const directSnippet =
    COMPONENT_OPTION_VALUE_SNIPPETS[functionName]?.[optionName];
  if (directSnippet) {
    return directSnippet;
  }

  if (optionName.startsWith('on')) {
    return '() => {\n    $1\n  }';
  }
  if (
    optionName.startsWith('is') ||
    optionName.startsWith('show') ||
    optionName.endsWith('Loading') ||
    optionName.endsWith('Disabled') ||
    optionName === 'compact' ||
    optionName === 'modal'
  ) {
    return '${1:false}';
  }
  if (
    optionName.endsWith('Class') ||
    optionName === 'class' ||
    optionName.endsWith('Text') ||
    optionName.endsWith('Title') ||
    optionName === 'title'
  ) {
    return "'${1:}'";
  }
  if (
    optionName.endsWith('Options') ||
    optionName.endsWith('Config') ||
    optionName === 'gridOptions' ||
    optionName === 'gridEvents' ||
    optionName === 'formOptions'
  ) {
    return '{\n    $1\n  }';
  }
  if (optionName === 'schema' || optionName.endsWith('Fields')) {
    return '${1:[]}';
  }

  return '$1';
}

function createSnippetCompletionItem(snippet, range, document, position) {
  const body = stripLeadingImports(snippet.body);
  const additionalTextEdits = buildImportInsertionEdits(
    snippet,
    document,
    position,
  );
  const item = new vscode.CompletionItem(
    snippet.prefix,
    vscode.CompletionItemKind.Snippet,
  );
  item.detail = snippet.detail;
  item.documentation = createDocumentationMarkdown(
    snippet.description,
    getSnippetDocsUrl(snippet.prefix),
  );
  item.insertText = new vscode.SnippetString(body);
  item.range = range;
  item.filterText = snippet.prefix;
  item.sortText = `0_${snippet.prefix}`;
  if (additionalTextEdits.length > 0) {
    item.additionalTextEdits = additionalTextEdits;
  }

  return item;
}

function createOptionCompletionItem(functionName, name, range) {
  const description = getOptionDescription(functionName, name);
  const valueSnippet = getOptionValueSnippet(functionName, name);
  const docsUrl = getFunctionDocsUrl(functionName);
  const item = new vscode.CompletionItem(
    name,
    vscode.CompletionItemKind.Property,
  );
  item.detail = `${getComponentDisplayName(functionName)} 配置项`;
  item.documentation = createDocumentationMarkdown(
    `**${name}**\n\n${description}`,
    docsUrl,
  );
  item.insertText = new vscode.SnippetString(`${name}: ${valueSnippet},$0`);
  item.range = range;
  item.sortText = `0_${name}`;
  item.filterText = name;
  item.preselect = true;

  return item;
}

function createEnumValueCompletionItem(functionName, optionName, value, range) {
  const valueText = typeof value === 'string' ? `'${value}'` : String(value);
  const docsUrl = getFunctionDocsUrl(functionName);
  const item = new vscode.CompletionItem(
    valueText,
    vscode.CompletionItemKind.EnumMember,
  );
  item.detail = 'Vben 枚举值';
  item.documentation = createDocumentationMarkdown(
    `**${optionName}** 可选值`,
    docsUrl,
  );
  item.insertText = new vscode.SnippetString(valueText);
  item.range = range;
  item.sortText = `0_${String(value)}`;
  item.filterText = String(value);

  return item;
}

function createApiMethodCompletionItem(apiType, name, range) {
  const docsUrl = getApiDocsUrl(apiType);
  const item = new vscode.CompletionItem(
    name,
    vscode.CompletionItemKind.Method,
  );
  item.detail = 'Vben API 方法';
  item.documentation = createDocumentationMarkdown(`**${name}**`, docsUrl);
  item.insertText = new vscode.SnippetString(`${name}($0)`);
  item.range = range;
  item.sortText = `0_${name}`;
  item.filterText = name;

  return item;
}

export {
  createApiMethodCompletionItem,
  createEnumValueCompletionItem,
  createOptionCompletionItem,
  createSnippetCompletionItem,
};
