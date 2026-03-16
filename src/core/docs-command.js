import * as vscode from 'vscode';

import { DOCS_URL, FUNCTION_DOCS_URL_MAP } from '../vben-data.js';
import {
  getApiDocsUrl,
  getFunctionDocsUrl,
  getSnippetDocsUrl,
} from './docs-links.js';
import {
  canSuggestOptionKeys,
  collectApiVariableMap,
  getComponentOptionsContext,
  getCurrentOptionValueContext,
  getDotAccessContext,
  getNearestFunctionCallName,
  getVbPrefixContext,
  isInsideVueScript,
} from './script-context.js';

function getCurrentDocsUrl(document, position) {
  const prefixContext = getVbPrefixContext(document, position);
  if (prefixContext) {
    const exactUrl = getSnippetDocsUrl(prefixContext.typedPrefix);
    if (exactUrl) {
      return exactUrl;
    }
  }

  if (!isInsideVueScript(document, position)) {
    const lineText = document.lineAt(position.line).text;
    if (/<\s*Page\b/.test(lineText)) {
      return DOCS_URL.page;
    }
    return '';
  }

  const optionValueContext = getCurrentOptionValueContext(document, position);
  if (optionValueContext) {
    return getFunctionDocsUrl(optionValueContext.functionName);
  }

  const componentOptionsContext = getComponentOptionsContext(
    document,
    position,
  );
  if (componentOptionsContext && canSuggestOptionKeys(document, position)) {
    return getFunctionDocsUrl(componentOptionsContext.functionName);
  }

  const dotContext = getDotAccessContext(document, position);
  if (dotContext) {
    const variableMap = collectApiVariableMap(document);
    const apiType = variableMap.get(dotContext.objectName);
    return getApiDocsUrl(apiType);
  }

  const functionName = getNearestFunctionCallName(
    document,
    position,
    Object.keys(FUNCTION_DOCS_URL_MAP),
  );
  if (functionName) {
    return getFunctionDocsUrl(functionName);
  }

  return '';
}

async function openCurrentContextDocs() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const docsUrl = getCurrentDocsUrl(editor.document, editor.selection.active);
  if (!docsUrl) {
    vscode.window.showInformationMessage(
      '未识别到 Vben 组件上下文，请把光标放到 vb- 前缀、useVbenXxx、alert/confirm/prompt 或 API 调用附近。',
    );
    return;
  }

  try {
    await vscode.env.openExternal(vscode.Uri.parse(docsUrl));
  } catch {
    vscode.window.showErrorMessage(`打开文档失败: ${docsUrl}`);
  }
}

export { openCurrentContextDocs };
