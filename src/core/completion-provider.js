import * as vscode from 'vscode';

import {
  API_METHODS,
  VBEN_PAGE_TEMPLATE_SNIPPETS,
  VBEN_SCRIPT_SNIPPETS,
} from '../vben-data.js';
import {
  createApiMethodCompletionItem,
  createEnumValueCompletionItem,
  createOptionCompletionItem,
  createSnippetCompletionItem,
} from './completion-items.js';
import {
  canSuggestOptionKeys,
  collectApiVariableMap,
  getCurrentComponentOptionCandidates,
  getCurrentOptionValueContext,
  getDotAccessContext,
  getIdentifierPrefixContext,
  getVbPrefixContext,
  isInsideVueScript,
} from './script-context.js';

function provideCompletionItems(document, position) {
  const inScript = isInsideVueScript(document, position);
  const prefixContext = getVbPrefixContext(document, position);

  // vb- 前缀命中时优先返回片段，避免进入后续较重的上下文扫描。
  if (prefixContext) {
    const snippets = inScript
      ? VBEN_SCRIPT_SNIPPETS
      : VBEN_PAGE_TEMPLATE_SNIPPETS;
    return snippets
      .filter((snippet) => snippet.prefix.startsWith(prefixContext.typedPrefix))
      .map((snippet) =>
        createSnippetCompletionItem(
          snippet,
          prefixContext.range,
          document,
          position,
        ),
      );
  }

  if (!inScript) {
    return [];
  }

  const optionValueContext = getCurrentOptionValueContext(document, position);
  if (optionValueContext) {
    return optionValueContext.enumValues
      .filter((value) =>
        String(value).toLowerCase().startsWith(optionValueContext.valuePrefix),
      )
      .map((value) =>
        createEnumValueCompletionItem(
          optionValueContext.functionName,
          optionValueContext.optionName,
          value,
          optionValueContext.range,
        ),
      );
  }

  const dotContext = getDotAccessContext(document, position);
  if (dotContext) {
    const variableMap = collectApiVariableMap(document);
    const apiType = variableMap.get(dotContext.objectName);
    const methods = API_METHODS[apiType];
    if (!methods || methods.length === 0) {
      return [];
    }

    return methods
      .filter((method) =>
        method.toLowerCase().startsWith(dotContext.methodPrefix.toLowerCase()),
      )
      .map((method) =>
        createApiMethodCompletionItem(apiType, method, dotContext.range),
      );
  }

  const componentCandidates = getCurrentComponentOptionCandidates(
    document,
    position,
  );
  if (
    componentCandidates &&
    componentCandidates.options.length > 0 &&
    canSuggestOptionKeys(document, position)
  ) {
    const identifierPrefix = getIdentifierPrefixContext(document, position);
    return componentCandidates.options
      .filter((name) =>
        name
          .toLowerCase()
          .startsWith(identifierPrefix.typedPrefix.toLowerCase()),
      )
      .map((name) =>
        createOptionCompletionItem(
          componentCandidates.functionName,
          name,
          identifierPrefix.range,
        ),
      );
  }
  return [];
}

function registerCompletionProvider(selector) {
  return vscode.languages.registerCompletionItemProvider(
    selector,
    { provideCompletionItems },
    '-',
    '.',
  );
}

export { registerCompletionProvider };
