import * as vscode from 'vscode';

import { registerCompletionProvider } from './core/completion-provider.js';
import { openCurrentContextDocs } from './core/docs-command.js';
import {
  isPureEnterChange,
  shouldTriggerSuggestOnEnter,
} from './core/script-context.js';

const OPEN_DOCS_COMMAND_ID = 'vbenAdminSnippet.openCurrentContextDocs';

function activate(context) {
  const selector = [
    { language: 'vue', scheme: 'file' },
    { language: 'vue', scheme: 'untitled' },
  ];

  const provider = registerCompletionProvider(selector);

  const openCurrentDocsCommand = vscode.commands.registerCommand(
    OPEN_DOCS_COMMAND_ID,
    openCurrentContextDocs,
  );

  const enterListener = vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    if (event.document.uri.toString() !== editor.document.uri.toString()) {
      return;
    }
    if (event.contentChanges.length === 0) {
      return;
    }
    if (!editor.selection.isEmpty) {
      return;
    }

    const hasEnterLikeChange = event.contentChanges.some((change) =>
      isPureEnterChange(change),
    );
    if (!hasEnterLikeChange) {
      return;
    }

    setTimeout(() => {
      const currentEditor = vscode.window.activeTextEditor;
      if (!currentEditor) {
        return;
      }
      if (!shouldTriggerSuggestOnEnter(currentEditor)) {
        return;
      }
      vscode.commands.executeCommand('editor.action.triggerSuggest');
    }, 10);
  });

  context.subscriptions.push(provider, enterListener, openCurrentDocsCommand);
}

function deactivate() {}

export { activate, deactivate };
