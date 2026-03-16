import * as vscode from 'vscode';

function parseImportSpecifierName(specifier) {
  const clean = specifier.trim();
  if (!clean) {
    return '';
  }
  const parts = clean.split(/\s+as\s+/i);
  return (parts[0] || '').trim();
}

function getCurrentScriptOffsets(document, position) {
  const fullText = document.getText();
  if (document.languageId !== 'vue') {
    return { end: fullText.length, start: 0 };
  }

  const cursorOffset = document.offsetAt(position);
  const beforeCursor = fullText.slice(0, cursorOffset);
  const scriptOpenStart = beforeCursor.lastIndexOf('<script');
  if (scriptOpenStart === -1) {
    return { end: fullText.length, start: 0 };
  }

  const openTagEnd = fullText.indexOf('>', scriptOpenStart);
  if (openTagEnd === -1) {
    return { end: fullText.length, start: 0 };
  }

  const scriptStart = openTagEnd + 1;
  const scriptCloseStart = fullText.indexOf('</script>', scriptStart);
  const scriptEnd =
    scriptCloseStart === -1 ? fullText.length : scriptCloseStart;

  return {
    end: scriptEnd,
    start: scriptStart,
  };
}

function parseNamedImportEntries(scriptText) {
  const importRegex =
    /import\s+(type\s+)?\{\s*([^}]*)\s*\}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  const entries = [];

  let match = importRegex.exec(scriptText);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    const rawSpecifiers = (match[2] || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const specifierMap = new Map();
    const orderedImportedNames = [];

    for (const rawSpecifier of rawSpecifiers) {
      const importedName = parseImportSpecifierName(rawSpecifier);
      if (!importedName || specifierMap.has(importedName)) {
        continue;
      }
      specifierMap.set(importedName, rawSpecifier);
      orderedImportedNames.push(importedName);
    }

    entries.push({
      end,
      importIsType: !!match[1],
      orderedImportedNames,
      source: match[3],
      specifierMap,
      start,
      updated: false,
    });
    match = importRegex.exec(scriptText);
  }

  return entries;
}

function buildMergedImportLine(importEntry) {
  const specifiers = importEntry.orderedImportedNames.map(
    (name) => importEntry.specifierMap.get(name) || name,
  );
  return `import${importEntry.importIsType ? ' type' : ''} { ${specifiers.join(', ')} } from '${importEntry.source}';`;
}

function buildImportInsertionEdits(snippet, document, position) {
  const imports = snippet.imports || [];
  if (!document || !position || imports.length === 0) {
    return [];
  }

  const fullText = document.getText();
  const scriptOffsets = getCurrentScriptOffsets(document, position);
  const scriptText = fullText.slice(scriptOffsets.start, scriptOffsets.end);
  const importEntries = parseNamedImportEntries(scriptText);
  const entryMap = new Map();

  for (const entry of importEntries) {
    const key = `${entry.importIsType ? 'type' : 'value'}|${entry.source}`;
    if (!entryMap.has(key)) {
      entryMap.set(key, entry);
    }
  }

  const pendingImports = new Map();

  for (const importMeta of imports) {
    const isType = !!importMeta.type;
    const key = `${isType ? 'type' : 'value'}|${importMeta.source}`;
    const existedEntry = entryMap.get(key);

    if (existedEntry) {
      for (const requiredName of importMeta.names || []) {
        if (existedEntry.specifierMap.has(requiredName)) {
          continue;
        }
        existedEntry.specifierMap.set(requiredName, requiredName);
        existedEntry.orderedImportedNames.push(requiredName);
        existedEntry.updated = true;
      }
      continue;
    }

    const pending = pendingImports.get(key) || {
      importIsType: isType,
      names: new Set(),
      source: importMeta.source,
    };
    for (const requiredName of importMeta.names || []) {
      pending.names.add(requiredName);
    }
    pendingImports.set(key, pending);
  }

  const additionalTextEdits = [];
  for (const entry of entryMap.values()) {
    if (!entry.updated) {
      continue;
    }
    const newImportLine = buildMergedImportLine(entry);
    const start = document.positionAt(scriptOffsets.start + entry.start);
    const end = document.positionAt(scriptOffsets.start + entry.end);
    additionalTextEdits.push(
      vscode.TextEdit.replace(new vscode.Range(start, end), newImportLine),
    );
  }

  if (pendingImports.size > 0) {
    const newImportLines = [...pendingImports.values()]
      .map((pending) => {
        const names = [...pending.names];
        return `import${pending.importIsType ? ' type' : ''} { ${names.join(', ')} } from '${pending.source}';`;
      })
      .join('\n');

    let insertOffset = scriptOffsets.start;
    if (importEntries.length > 0) {
      const lastImportEnd = importEntries.reduce(
        (maxEnd, entry) => Math.max(maxEnd, entry.end),
        0,
      );
      insertOffset = scriptOffsets.start + lastImportEnd;
    } else {
      const leadingWhitespaceLength = (scriptText.match(/^\s*/) || [''])[0]
        .length;
      insertOffset = scriptOffsets.start + leadingWhitespaceLength;
    }

    const trailingText = fullText.slice(insertOffset, scriptOffsets.end);
    const trailingHasContent = trailingText.trim().length > 0;
    const trailingStartsWithSingleNewline = /^\r?\n(?!\r?\n)/.test(
      trailingText,
    );
    const trailingStartsWithBlankLine = /^\r?\n\r?\n/.test(trailingText);

    const prefix = importEntries.length > 0 ? '\n' : '';
    let suffix = '\n';
    if (trailingHasContent) {
      if (trailingStartsWithBlankLine) {
        suffix = '';
      } else if (trailingStartsWithSingleNewline) {
        suffix = '\n';
      } else {
        suffix = '\n\n';
      }
    }
    additionalTextEdits.push(
      vscode.TextEdit.insert(
        document.positionAt(insertOffset),
        `${prefix}${newImportLines}${suffix}`,
      ),
    );
  }

  return additionalTextEdits;
}

function stripLeadingImports(body) {
  const lines = body.split('\n');
  let index = 0;

  while (index < lines.length && lines[index].trim().startsWith('import ')) {
    index += 1;
  }
  if (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }

  return lines.slice(index).join('\n');
}

export { buildImportInsertionEdits, stripLeadingImports };
