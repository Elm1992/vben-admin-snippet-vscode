import * as vscode from 'vscode';

const METHOD_INDEX_VIEW_ID = 'vbenAdminSnippet.methodIndexView';
const REFRESH_METHOD_INDEX_COMMAND_ID = 'vbenAdminSnippet.refreshMethodIndex';
const REVEAL_METHOD_INDEX_COMMAND_ID = 'vbenAdminSnippet.revealMethodIndexItem';

const CONFIG_SECTION = 'vbenAdminSnippet';
const CONFIG_ENABLE_METHOD_INDEX = 'enableMethodIndex';
const CONFIG_METHOD_INDEX_SORT = 'methodIndexSort';
const CONFIG_METHOD_INDEX_DEBOUNCE_MS = 'methodIndexDebounceMs';

const VBEN_METHOD_CALL_NAMES = [
  'useVbenForm',
  'useVbenModal',
  'useVbenDrawer',
  'useVbenVxeGrid',
];
const VBEN_IMPORT_GUARDED_METHOD_CALL_NAMES = ['alert', 'confirm', 'prompt'];
const VBEN_IMPORT_SOURCE_PREFIXES = ['@vben/common-ui'];

const VBEN_API_OBJECT_NAMES = ['modalApi', 'drawerApi', 'formApi', 'gridApi'];
const VBEN_METHOD_OPTION_OBJECT_KEYS = {
  useVbenForm: [
    'arrayToStringFields',
    'commonConfig',
    'fieldMappingTime',
    'resetButtonOptions',
    'schema',
    'submitButtonOptions',
  ],
  useVbenVxeGrid: ['gridOptions', 'gridEvents', 'formOptions'],
};

function escapeRegExp(text) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function isVbenImportSource(source) {
  return VBEN_IMPORT_SOURCE_PREFIXES.some(
    (prefix) => source === prefix || source.startsWith(`${prefix}/`),
  );
}

function parseNamedImportSpecifier(specifierText) {
  const cleanText = specifierText.trim();
  if (!cleanText) {
    return null;
  }

  const textWithoutType = cleanText.replace(/^type\s+/i, '').trim();
  if (!textWithoutType) {
    return null;
  }

  const match = /^([A-Z_$][\w$]*)(?:\s+as\s+([A-Z_$][\w$]*))?$/i.exec(
    textWithoutType,
  );
  if (!match) {
    return null;
  }

  const importedName = match[1];
  const localName = match[2] || importedName;
  return { importedName, localName };
}

function collectImportedVbenMethodAliasMap(text) {
  const aliasMap = new Map(
    VBEN_IMPORT_GUARDED_METHOD_CALL_NAMES.map((name) => [name, new Set()]),
  );
  const importPattern =
    /^\s*import\s+(?!type\b)(?:[A-Z_$][\w$]*\s*,\s*)?\{\s*([\s\S]*?)\s*\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm;

  let match = importPattern.exec(text);
  while (match) {
    const source = match[2] || '';
    if (!isVbenImportSource(source)) {
      match = importPattern.exec(text);
      continue;
    }

    const rawSpecifierText = (match[1] || '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');
    const specifiers = rawSpecifierText
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const specifier of specifiers) {
      const parsedSpecifier = parseNamedImportSpecifier(specifier);
      if (!parsedSpecifier) {
        continue;
      }
      const aliasSet = aliasMap.get(parsedSpecifier.importedName);
      if (!aliasSet) {
        continue;
      }
      aliasSet.add(parsedSpecifier.localName);
    }

    match = importPattern.exec(text);
  }

  return aliasMap;
}

function isMethodIndexEnabled() {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get(CONFIG_ENABLE_METHOD_INDEX, true);
}

function getMethodIndexSort() {
  const value = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get(CONFIG_METHOD_INDEX_SORT, 'line');
  return value === 'name' ? 'name' : 'line';
}

function getMethodIndexDebounceMs() {
  const value = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get(CONFIG_METHOD_INDEX_DEBOUNCE_MS, 250);
  if (!Number.isFinite(value)) {
    return 250;
  }
  return Math.min(1000, Math.max(50, Math.floor(Number(value))));
}

function maskCommentsAndStrings(text) {
  const chars = text.split('');
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  const maskAt = (index) => {
    if (index < 0 || index >= chars.length) {
      return;
    }
    if (chars[index] !== '\n' && chars[index] !== '\r') {
      chars[index] = ' ';
    }
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        escaped = false;
        continue;
      }
      maskAt(i);
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        maskAt(i);
        maskAt(i + 1);
        inBlockComment = false;
        i += 1;
        continue;
      }
      maskAt(i);
      continue;
    }

    if (inSingle) {
      maskAt(i);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      maskAt(i);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inTemplate) {
      maskAt(i);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      maskAt(i);
      maskAt(i + 1);
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      maskAt(i);
      maskAt(i + 1);
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      maskAt(i);
      inSingle = true;
      escaped = false;
      continue;
    }
    if (ch === '"') {
      maskAt(i);
      inDouble = true;
      escaped = false;
      continue;
    }
    if (ch === '`') {
      maskAt(i);
      inTemplate = true;
      escaped = false;
      continue;
    }
  }

  return chars.join('');
}

function createMethodEntry(document, offset, label, key, kind) {
  const position = document.positionAt(offset);
  const lineText = document.lineAt(position.line).text.trim();

  return {
    character: position.character + 1,
    key,
    kind,
    label,
    line: position.line + 1,
    offset,
    preview: lineText,
    uriString: document.uri.toString(),
  };
}

function createMethodEntryWithMeta(
  document,
  offset,
  label,
  key,
  kind,
  meta = {},
) {
  return {
    ...createMethodEntry(document, offset, label, key, kind),
    ...meta,
  };
}

function collectMethodCallEntries(
  maskedText,
  document,
  importedMethodAliasMap,
) {
  const entries = [];

  for (const methodName of VBEN_METHOD_CALL_NAMES) {
    const pattern = new RegExp(
      String.raw`\b${escapeRegExp(methodName)}\s*\(`,
      'g',
    );
    let match = pattern.exec(maskedText);
    while (match) {
      entries.push(
        createMethodEntry(
          document,
          match.index,
          methodName,
          methodName,
          'method',
        ),
      );
      match = pattern.exec(maskedText);
    }
  }

  for (const methodName of VBEN_IMPORT_GUARDED_METHOD_CALL_NAMES) {
    const aliasSet = importedMethodAliasMap.get(methodName);
    if (!aliasSet || aliasSet.size === 0) {
      continue;
    }
    for (const localName of aliasSet) {
      const pattern = new RegExp(
        String.raw`\b${escapeRegExp(localName)}\s*\(`,
        'g',
      );
      let match = pattern.exec(maskedText);
      while (match) {
        entries.push(
          createMethodEntry(
            document,
            match.index,
            localName,
            methodName,
            'method',
          ),
        );
        match = pattern.exec(maskedText);
      }
    }
  }

  return entries;
}

function collectApiMethodEntries(maskedText, document) {
  const entries = [];
  const objectNamesPattern = VBEN_API_OBJECT_NAMES.map((name) =>
    escapeRegExp(name),
  ).join('|');
  const pattern = new RegExp(
    String.raw`\b(${objectNamesPattern})\s*\.\s*([A-Z_$][\w$]*)\s*\(`,
    'g',
  );

  let match = pattern.exec(maskedText);
  while (match) {
    const objectName = match[1];
    const methodName = match[2];
    const label = `${objectName}.${methodName}`;
    entries.push(createMethodEntry(document, match.index, label, label, 'api'));
    match = pattern.exec(maskedText);
  }

  return entries;
}

function collectVariableDeclarationOffsets(maskedText) {
  const map = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Z_$][\w$]*)\b/gi;
  let match = pattern.exec(maskedText);

  while (match) {
    const variableName = match[1];
    const nameOffset = match.index + match[0].lastIndexOf(variableName);
    const offsets = map.get(variableName) || [];
    offsets.push(nameOffset);
    map.set(variableName, offsets);
    match = pattern.exec(maskedText);
  }

  return map;
}

function findNearestDeclarationOffset(map, variableName, usageOffset) {
  const offsets = map.get(variableName);
  if (!offsets || offsets.length === 0) {
    return -1;
  }

  let nearestBefore = -1;
  let nearestAfter = -1;
  for (const offset of offsets) {
    if (offset <= usageOffset) {
      nearestBefore = Math.max(nearestBefore, offset);
      continue;
    }
    if (nearestAfter === -1 || offset < nearestAfter) {
      nearestAfter = offset;
    }
  }

  if (nearestBefore !== -1) {
    return nearestBefore;
  }
  return nearestAfter;
}

function findPairEndIndex(text, startIndex, openChar, closeChar) {
  if (
    startIndex < 0 ||
    startIndex >= text.length ||
    text[startIndex] !== openChar
  ) {
    return -1;
  }

  let depth = 0;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === openChar) {
      depth += 1;
      continue;
    }
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function findFirstArgumentObjectRange(
  maskedText,
  openParenIndex,
  closeParenIndex,
) {
  for (let i = openParenIndex + 1; i < closeParenIndex; i++) {
    const ch = maskedText[i];
    if (/\s/.test(ch)) {
      continue;
    }
    if (ch !== '{') {
      return null;
    }
    const objectEnd = findPairEndIndex(maskedText, i, '{', '}');
    if (objectEnd === -1 || objectEnd > closeParenIndex) {
      return null;
    }
    return { end: objectEnd, start: i };
  }
  return null;
}

function collectTopLevelOptionVariableRefs(
  maskedText,
  objectStart,
  objectEnd,
  optionNameSet,
) {
  const refs = [];
  let i = objectStart + 1;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  const moveToNextTopLevelComma = () => {
    let localBraceDepth = 0;
    let localBracketDepth = 0;
    let localParenDepth = 0;

    while (i < objectEnd) {
      const ch = maskedText[i];
      if (ch === '{') {
        localBraceDepth += 1;
      } else if (ch === '}') {
        if (localBraceDepth > 0) {
          localBraceDepth -= 1;
        }
      } else if (ch === '[') {
        localBracketDepth += 1;
      } else if (ch === ']') {
        if (localBracketDepth > 0) {
          localBracketDepth -= 1;
        }
      } else if (ch === '(') {
        localParenDepth += 1;
      } else if (ch === ')') {
        if (localParenDepth > 0) {
          localParenDepth -= 1;
        }
      } else if (
        ch === ',' &&
        localBraceDepth === 0 &&
        localBracketDepth === 0 &&
        localParenDepth === 0
      ) {
        i += 1;
        return;
      }
      i += 1;
    }
  };

  while (i < objectEnd) {
    const ch = maskedText[i];
    if (ch === '{') {
      braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (braceDepth > 0) {
        braceDepth -= 1;
      }
      i += 1;
      continue;
    }
    if (ch === '[') {
      bracketDepth += 1;
      i += 1;
      continue;
    }
    if (ch === ']') {
      if (bracketDepth > 0) {
        bracketDepth -= 1;
      }
      i += 1;
      continue;
    }
    if (ch === '(') {
      parenDepth += 1;
      i += 1;
      continue;
    }
    if (ch === ')') {
      if (parenDepth > 0) {
        parenDepth -= 1;
      }
      i += 1;
      continue;
    }
    if (braceDepth !== 0 || bracketDepth !== 0 || parenDepth !== 0) {
      i += 1;
      continue;
    }

    if (/\s/.test(ch) || ch === ',') {
      i += 1;
      continue;
    }

    const keyMatch = /^[A-Z_$][\w$]*/i.exec(maskedText.slice(i));
    if (!keyMatch) {
      i += 1;
      continue;
    }

    const optionKey = keyMatch[0];
    const optionKeyOffset = i;
    i += optionKey.length;

    while (i < objectEnd && /\s/.test(maskedText[i])) {
      i += 1;
    }

    if (!optionNameSet.has(optionKey)) {
      if (maskedText[i] === ':') {
        i += 1;
        moveToNextTopLevelComma();
      }
      continue;
    }

    if (maskedText[i] !== ':') {
      refs.push({
        optionName: optionKey,
        usageOffset: optionKeyOffset,
        variableName: optionKey,
      });
      continue;
    }

    i += 1;
    while (i < objectEnd && /\s/.test(maskedText[i])) {
      i += 1;
    }

    const valueIdentifierMatch = /^[A-Z_$][\w$]*/i.exec(maskedText.slice(i));
    if (valueIdentifierMatch) {
      refs.push({
        optionName: optionKey,
        usageOffset: i,
        variableName: valueIdentifierMatch[0],
      });
    } else {
      refs.push({
        optionName: optionKey,
        usageOffset: optionKeyOffset,
        variableName: optionKey,
      });
    }

    moveToNextTopLevelComma();
  }

  return refs;
}

function collectMethodOptionObjectEntries(maskedText, document) {
  const entries = [];
  const declarationOffsetsMap = collectVariableDeclarationOffsets(maskedText);

  for (const [methodName, optionNames] of Object.entries(
    VBEN_METHOD_OPTION_OBJECT_KEYS,
  )) {
    const optionNameSet = new Set(optionNames);
    const pattern = new RegExp(
      String.raw`\b${escapeRegExp(methodName)}\s*\(`,
      'g',
    );
    let match = pattern.exec(maskedText);

    while (match) {
      const openParenIndex = match.index + match[0].lastIndexOf('(');
      const closeParenIndex = findPairEndIndex(
        maskedText,
        openParenIndex,
        '(',
        ')',
      );
      if (closeParenIndex === -1) {
        match = pattern.exec(maskedText);
        continue;
      }

      const objectRange = findFirstArgumentObjectRange(
        maskedText,
        openParenIndex,
        closeParenIndex,
      );
      if (!objectRange) {
        match = pattern.exec(maskedText);
        continue;
      }

      const refs = collectTopLevelOptionVariableRefs(
        maskedText,
        objectRange.start,
        objectRange.end,
        optionNameSet,
      );
      for (const ref of refs) {
        const declarationOffset = findNearestDeclarationOffset(
          declarationOffsetsMap,
          ref.variableName,
          ref.usageOffset,
        );
        const targetOffset =
          declarationOffset === -1 ? ref.usageOffset : declarationOffset;
        const key = `${methodName}.${ref.optionName}`;
        entries.push(
          createMethodEntryWithMeta(
            document,
            targetOffset,
            ref.variableName,
            key,
            'option',
            { parentMethodOffset: match.index },
          ),
        );
      }

      match = pattern.exec(maskedText);
    }
  }

  return entries;
}

function collectVbenMethodEntries(document) {
  const text = document.getText();
  if (!text) {
    return [];
  }

  const maskedText = maskCommentsAndStrings(text);
  const importedMethodAliasMap = collectImportedVbenMethodAliasMap(text);
  const entries = [
    ...collectMethodCallEntries(maskedText, document, importedMethodAliasMap),
    ...collectApiMethodEntries(maskedText, document),
    ...collectMethodOptionObjectEntries(maskedText, document),
  ];

  if (entries.length === 0) {
    return [];
  }

  if (getMethodIndexSort() === 'name') {
    entries.sort(
      (a, b) =>
        a.label.localeCompare(b.label, 'zh-Hans-CN') || a.offset - b.offset,
    );
    return entries;
  }

  entries.sort((a, b) => a.offset - b.offset);
  return entries;
}

class MethodIndexInfoItem extends vscode.TreeItem {
  constructor(label, description = '') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = 'vbenMethodIndexInfo';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

class MethodIndexGroupItem extends vscode.TreeItem {
  constructor(entry, childEntries) {
    super(entry.label, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `group:${entry.key}:${entry.offset}`;
    this.childEntries = childEntries;
    this.description = `Ln ${entry.line}`;
    this.contextValue = 'vbenMethodIndexGroup';
    this.iconPath = new vscode.ThemeIcon('symbol-method');
    this.tooltip = `${entry.label} (${entry.line}:${entry.character})\n${entry.preview}`;
    this.command = {
      arguments: [entry.uriString, entry.offset],
      command: REVEAL_METHOD_INDEX_COMMAND_ID,
      title: '定位到条目',
    };
  }
}

class MethodIndexEntryItem extends vscode.TreeItem {
  constructor(entry) {
    super(entry.label, vscode.TreeItemCollapsibleState.None);
    this.id = `entry:${entry.kind}:${entry.key}:${entry.offset}`;
    this.description = `Ln ${entry.line}`;
    this.contextValue = 'vbenMethodIndexEntry';
    this.iconPath = new vscode.ThemeIcon(
      entry.kind === 'api'
        ? 'symbol-function'
        : entry.kind === 'option'
          ? 'symbol-variable'
          : 'symbol-method',
    );
    this.tooltip = `${entry.label} (${entry.line}:${entry.character})\n${entry.preview}`;
    this.command = {
      arguments: [entry.uriString, entry.offset],
      command: REVEAL_METHOD_INDEX_COMMAND_ID,
      title: entry.kind === 'option' ? '定位到定义' : '定位到条目',
    };
  }
}

function createMethodIndexTreeItems(entries) {
  const items = [];
  const optionChildrenMap = new Map();
  const usedOptionKeys = new Set();

  for (const entry of entries) {
    if (
      entry.kind !== 'option' ||
      typeof entry.parentMethodOffset !== 'number'
    ) {
      continue;
    }
    const children = optionChildrenMap.get(entry.parentMethodOffset) || [];
    const duplicate = children.some(
      (child) => child.label === entry.label && child.offset === entry.offset,
    );
    if (!duplicate) {
      children.push(entry);
    }
    optionChildrenMap.set(entry.parentMethodOffset, children);
  }

  for (const entry of entries) {
    if (entry.kind === 'option') {
      const key = `${entry.parentMethodOffset}:${entry.label}:${entry.offset}`;
      if (typeof entry.parentMethodOffset === 'number') {
        continue;
      }
      if (usedOptionKeys.has(key)) {
        continue;
      }
      usedOptionKeys.add(key);
      items.push(new MethodIndexEntryItem(entry));
      continue;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        VBEN_METHOD_OPTION_OBJECT_KEYS,
        entry.label,
      )
    ) {
      const children = optionChildrenMap.get(entry.offset);
      if (children && children.length > 0) {
        const sortedChildren = [...children].sort((a, b) => {
          if (getMethodIndexSort() === 'name') {
            return (
              a.label.localeCompare(b.label, 'zh-Hans-CN') ||
              a.offset - b.offset
            );
          }
          return a.offset - b.offset;
        });
        items.push(new MethodIndexGroupItem(entry, sortedChildren));
        continue;
      }
    }

    items.push(new MethodIndexEntryItem(entry));
  }

  return items;
}

class VbenMethodIndexProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item) {
    return item;
  }

  getChildren(item) {
    if (item instanceof MethodIndexGroupItem) {
      return item.childEntries.map((entry) => new MethodIndexEntryItem(entry));
    }
    if (item) {
      return [];
    }

    if (!isMethodIndexEnabled()) {
      return [new MethodIndexInfoItem('方法索引已关闭', '在设置中启用')];
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [new MethodIndexInfoItem('未打开编辑器')];
    }

    const document = editor.document;
    if (document.languageId !== 'vue') {
      return [new MethodIndexInfoItem('当前文件不是 Vue 文件')];
    }

    const entries = collectVbenMethodEntries(document);
    const distinctMethodCount = new Set(entries.map((entry) => entry.key)).size;
    const summaryItem = new MethodIndexInfoItem(
      '当前文件',
      `${entries.length} 处 / ${distinctMethodCount} 类`,
    );
    summaryItem.iconPath = new vscode.ThemeIcon('list-tree');

    if (entries.length === 0) {
      return [summaryItem, new MethodIndexInfoItem('未发现 Vben 方法或对象')];
    }

    const treeItems = createMethodIndexTreeItems(entries);
    return [summaryItem, ...treeItems];
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
  }
}

async function revealMethodIndexEntry(uriString, offset) {
  if (typeof uriString !== 'string' || typeof offset !== 'number') {
    return;
  }

  try {
    const uri = vscode.Uri.parse(uriString);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, {
      preserveFocus: false,
      preview: false,
    });
    const position = document.positionAt(offset);
    const range = new vscode.Range(position, position);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch {
    vscode.window.showErrorMessage('定位 Vben 方法失败。');
  }
}

function registerMethodIndexView(context) {
  const provider = new VbenMethodIndexProvider();
  const view = vscode.window.createTreeView(METHOD_INDEX_VIEW_ID, {
    showCollapseAll: false,
    treeDataProvider: provider,
  });

  const revealCommand = vscode.commands.registerCommand(
    REVEAL_METHOD_INDEX_COMMAND_ID,
    revealMethodIndexEntry,
  );
  const refreshCommand = vscode.commands.registerCommand(
    REFRESH_METHOD_INDEX_COMMAND_ID,
    () => provider.refresh(),
  );

  let refreshTimer;
  const scheduleRefresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      provider.refresh();
    }, getMethodIndexDebounceMs());
  };

  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
    scheduleRefresh();
  });
  const documentChangedListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      if (
        event.document.uri.toString() !== activeEditor.document.uri.toString()
      ) {
        return;
      }
      scheduleRefresh();
    },
  );
  const documentSavedListener = vscode.workspace.onDidSaveTextDocument(
    (document) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      if (document.uri.toString() !== activeEditor.document.uri.toString()) {
        return;
      }
      scheduleRefresh();
    },
  );
  const configChangedListener = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (!event.affectsConfiguration(CONFIG_SECTION)) {
        return;
      }
      scheduleRefresh();
    },
  );

  const timerDisposable = new vscode.Disposable(() => {
    if (!refreshTimer) {
      return;
    }
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  });

  context.subscriptions.push(
    provider,
    view,
    revealCommand,
    refreshCommand,
    activeEditorListener,
    documentChangedListener,
    documentSavedListener,
    configChangedListener,
    timerDisposable,
  );

  scheduleRefresh();
}

export { registerMethodIndexView };
