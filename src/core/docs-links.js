import * as vscode from 'vscode';

import {
  API_DOCS_URL_MAP,
  FUNCTION_DOCS_URL_MAP,
  SNIPPET_DOCS_URL_MAP,
} from '../vben-data.js';

function getSnippetDocsUrl(prefix) {
  return SNIPPET_DOCS_URL_MAP[prefix] || '';
}

function getFunctionDocsUrl(functionName) {
  return FUNCTION_DOCS_URL_MAP[functionName] || '';
}

function getApiDocsUrl(apiType) {
  return API_DOCS_URL_MAP[apiType] || '';
}

function createDocumentationMarkdown(content, docsUrl) {
  const markdown = new vscode.MarkdownString(content);
  if (docsUrl) {
    markdown.appendMarkdown(`\n\n[查看文档](${docsUrl})`);
  }
  markdown.isTrusted = true;
  return markdown;
}

export {
  createDocumentationMarkdown,
  getApiDocsUrl,
  getFunctionDocsUrl,
  getSnippetDocsUrl,
};
