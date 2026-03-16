import * as vscode from 'vscode';

import {
  COMPONENT_OPTION_VALUE_ENUMS,
  COMPONENT_OPTIONS,
} from '../vben-data.js';

function getVbPrefixContext(document, position) {
  const linePrefix = document
    .lineAt(position.line)
    .text.slice(0, position.character);
  const match = /vb-[a-z-]*$/i.exec(linePrefix);
  if (!match) {
    return null;
  }

  const start = position.character - match[0].length;
  const range = new vscode.Range(
    new vscode.Position(position.line, start),
    position,
  );

  return { range, typedPrefix: match[0].toLowerCase() };
}

function isInsideVueScript(document, position) {
  if (document.languageId !== 'vue') {
    return false;
  }

  const textBeforeCursor = document.getText(
    new vscode.Range(new vscode.Position(0, 0), position),
  );
  const lastScriptOpen = textBeforeCursor.lastIndexOf('<script');
  const lastScriptClose = textBeforeCursor.lastIndexOf('</script>');

  return lastScriptOpen > lastScriptClose;
}

function escapeRegExp(text) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function getIdentifierPrefixContext(document, position) {
  const linePrefix = document
    .lineAt(position.line)
    .text.slice(0, position.character);
  const match = /[A-Z_$][\w$]*$/i.exec(linePrefix);
  if (!match) {
    return {
      range: new vscode.Range(position, position),
      typedPrefix: '',
    };
  }

  const start = position.character - match[0].length;
  return {
    range: new vscode.Range(
      new vscode.Position(position.line, start),
      position,
    ),
    typedPrefix: match[0],
  };
}

function getDotAccessContext(document, position) {
  const linePrefix = document
    .lineAt(position.line)
    .text.slice(0, position.character);
  const match = /([A-Z_$][\w$]*)\.([A-Z_$]*)$/i.exec(linePrefix);
  if (!match) {
    return null;
  }

  const [, objectName, methodPrefix = ''] = match;
  const start = position.character - methodPrefix.length;
  const range = new vscode.Range(
    new vscode.Position(position.line, start),
    position,
  );
  return {
    methodPrefix,
    objectName,
    range,
  };
}

function getTextBeforeCursor(document, position) {
  return document.getText(
    new vscode.Range(new vscode.Position(0, 0), position),
  );
}

function findObjectEndIndex(text, startIndex) {
  if (startIndex < 0 || text[startIndex] !== '{') {
    return -1;
  }

  let braceDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inTemplate) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '{') {
      braceDepth += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function collectTopLevelObjectKeys(text, objectStart, objectEnd) {
  const keys = new Set();
  if (objectStart < 0 || objectEnd <= objectStart) {
    return keys;
  }

  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;
  let expectingKey = true;

  for (let i = objectStart + 1; i < objectEnd; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inTemplate) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '{') {
      braceDepth += 1;
      continue;
    }
    if (ch === '}') {
      if (braceDepth > 0) {
        braceDepth -= 1;
      }
      continue;
    }
    if (ch === '[') {
      bracketDepth += 1;
      continue;
    }
    if (ch === ']') {
      if (bracketDepth > 0) {
        bracketDepth -= 1;
      }
      continue;
    }
    if (ch === '(') {
      parenDepth += 1;
      continue;
    }
    if (ch === ')') {
      if (parenDepth > 0) {
        parenDepth -= 1;
      }
      continue;
    }

    const isTopLevel =
      braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
    if (!isTopLevel) {
      continue;
    }

    if (ch === ',') {
      expectingKey = true;
      continue;
    }

    if (!expectingKey) {
      continue;
    }

    if (/[A-Z_$]/i.test(ch)) {
      let j = i + 1;
      while (j < objectEnd && /[\w$]/.test(text[j])) {
        j += 1;
      }
      const key = text.slice(i, j);

      let k = j;
      while (k < objectEnd && /\s/.test(text[k])) {
        k += 1;
      }

      if (text[k] === ':') {
        keys.add(key);
        expectingKey = false;
        i = k;
      } else {
        i = j - 1;
      }
    }
  }

  return keys;
}

function getBraceDepth(text, startIndex) {
  let depth = 0;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
    }
  }
  return depth;
}

function getComponentOptionsContext(document, position) {
  const textBeforeCursor = getTextBeforeCursor(document, position);
  let matchedContext = null;

  for (const functionName of Object.keys(COMPONENT_OPTIONS)) {
    const pattern = new RegExp(String.raw`${functionName}\s*\(\s*\{`, 'g');
    let match = pattern.exec(textBeforeCursor);
    while (match) {
      const objectStart = match.index + match[0].length - 1;
      const depth = getBraceDepth(textBeforeCursor, objectStart);
      if (
        depth > 0 &&
        (!matchedContext || objectStart > matchedContext.objectStart)
      ) {
        matchedContext = {
          depth,
          functionName,
          objectStart,
        };
      }
      match = pattern.exec(textBeforeCursor);
    }
  }

  return matchedContext;
}

const TYPED_OBJECT_OPTION_TYPE_NAMES = new Set(['VxeGridProps']);

function getTypeRootName(typeExpression) {
  if (!typeExpression) {
    return '';
  }
  const match = /^\s*([A-Z_$][\w$]*)/i.exec(typeExpression);
  return match ? match[1] : '';
}

function getTypedObjectLiteralContext(document, position) {
  const textBeforeCursor = getTextBeforeCursor(document, position);
  const pattern =
    /\b(?:const|let|var)\s+[A-Z_$][\w$]*\s*:\s*([^=]+?)\s*=\s*\{/gi;
  let match = pattern.exec(textBeforeCursor);
  let matchedContext = null;

  while (match) {
    const typeExpression = match[1] || '';
    const typeName = getTypeRootName(typeExpression);
    if (!TYPED_OBJECT_OPTION_TYPE_NAMES.has(typeName)) {
      match = pattern.exec(textBeforeCursor);
      continue;
    }

    const objectStart = match.index + match[0].lastIndexOf('{');
    const depth = getBraceDepth(textBeforeCursor, objectStart);
    if (depth > 0 && (!matchedContext || objectStart > matchedContext.objectStart)) {
      matchedContext = {
        depth,
        objectStart,
        typeName,
      };
    }
    match = pattern.exec(textBeforeCursor);
  }

  return matchedContext;
}

function getNearestTopLevelOptionsOwnerContext(document, position) {
  const contexts = [];

  const componentOptionsContext = getComponentOptionsContext(document, position);
  if (componentOptionsContext && componentOptionsContext.depth === 1) {
    contexts.push({
      functionName: componentOptionsContext.functionName,
      objectStart: componentOptionsContext.objectStart,
    });
  }

  const typedObjectContext = getTypedObjectLiteralContext(document, position);
  if (typedObjectContext && typedObjectContext.depth === 1) {
    contexts.push({
      functionName: typedObjectContext.typeName,
      objectStart: typedObjectContext.objectStart,
    });
  }

  if (contexts.length === 0) {
    return null;
  }

  contexts.sort((a, b) => b.objectStart - a.objectStart);
  return contexts[0];
}

function collectApiVariableMap(document) {
  const text = document.getText();
  const map = new Map();

  const patterns = [
    {
      apiType: 'modalApi',
      pattern:
        /\b(?:const|let|var)\s*\[\s*[\w$]+\s*,\s*([\w$]+)\s*\]\s*=\s*useVbenModal\s*\(/g,
    },
    {
      apiType: 'drawerApi',
      pattern:
        /\b(?:const|let|var)\s*\[\s*[\w$]+\s*,\s*([\w$]+)\s*\]\s*=\s*useVbenDrawer\s*\(/g,
    },
    {
      apiType: 'formApi',
      pattern:
        /\b(?:const|let|var)\s*\[\s*[\w$]+\s*,\s*([\w$]+)\s*\]\s*=\s*useVbenForm\s*\(/g,
    },
    {
      apiType: 'gridApi',
      pattern:
        /\b(?:const|let|var)\s*\[\s*[\w$]+\s*,\s*([\w$]+)\s*\]\s*=\s*useVbenVxeGrid\s*\(/g,
    },
  ];

  for (const { apiType, pattern } of patterns) {
    let match = pattern.exec(text);
    while (match) {
      const variableName = match[1];
      if (variableName) {
        map.set(variableName, apiType);
      }
      match = pattern.exec(text);
    }
  }

  return map;
}

function getCurrentOptionValueContext(document, position) {
  const context = getNearestTopLevelOptionsOwnerContext(document, position);
  if (!context) {
    return null;
  }

  const linePrefix = document
    .lineAt(position.line)
    .text.slice(0, position.character);
  const colonIndex = linePrefix.lastIndexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const keyPart = linePrefix.slice(0, colonIndex);
  const valuePart = linePrefix.slice(colonIndex + 1);
  if (valuePart.includes(',') || valuePart.includes('}')) {
    return null;
  }

  const keyMatch = /([A-Z_$][\w$]*)\s*$/i.exec(keyPart);
  if (!keyMatch) {
    return null;
  }

  const optionName = keyMatch[1];
  const rawValuePrefix = valuePart;
  const enumValues =
    COMPONENT_OPTION_VALUE_ENUMS[context.functionName]?.[optionName];
  if (!enumValues || enumValues.length === 0) {
    return null;
  }

  const start = position.character - rawValuePrefix.length;
  const range = new vscode.Range(
    new vscode.Position(position.line, start),
    position,
  );
  const valuePrefix = rawValuePrefix
    .trim()
    .replace(/^['"`]/, '')
    .toLowerCase();

  return {
    enumValues,
    functionName: context.functionName,
    optionName,
    range,
    valuePrefix,
  };
}

function getCurrentComponentOptionCandidates(document, position) {
  const context = getNearestTopLevelOptionsOwnerContext(document, position);
  if (!context) {
    return null;
  }

  const text = document.getText();
  const objectStart = context.objectStart;
  const objectEnd = findObjectEndIndex(text, objectStart);
  const cursorOffset = document.offsetAt(position);
  const effectiveEnd =
    objectEnd === -1 ? cursorOffset : Math.max(objectEnd, cursorOffset);
  const existedKeys = collectTopLevelObjectKeys(
    text,
    objectStart,
    effectiveEnd,
  );
  const options = (COMPONENT_OPTIONS[context.functionName] || []).filter(
    (name) => !existedKeys.has(name),
  );

  return {
    functionName: context.functionName,
    options,
  };
}

function canSuggestOptionKeys(document, position) {
  const linePrefix = document
    .lineAt(position.line)
    .text.slice(0, position.character);
  const trimmed = linePrefix.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith('//')) {
    return false;
  }
  // 冒号后一般是值区域，避免在 value 区域给出 key 提示
  if (linePrefix.includes(':')) {
    return false;
  }
  return true;
}

function isPureEnterChange(change) {
  if (!change || change.rangeLength !== 0) {
    return false;
  }
  // 回车通常会插入换行和缩进空白字符。
  return /^\r?\n[ \t]*$/.test(change.text);
}

function shouldTriggerSuggestOnEnter(editor) {
  const position = editor.selection.active;
  if (!isInsideVueScript(editor.document, position)) {
    return false;
  }

  const componentCandidates = getCurrentComponentOptionCandidates(
    editor.document,
    position,
  );
  if (!componentCandidates || componentCandidates.options.length === 0) {
    return false;
  }

  return canSuggestOptionKeys(editor.document, position);
}

function getNearestFunctionCallName(document, position, functionNames) {
  if (!functionNames || functionNames.length === 0) {
    return '';
  }

  const escapedNames = functionNames.map((name) => escapeRegExp(name));
  const regex = new RegExp(String.raw`\b(${escapedNames.join('|')})\s*\(`, 'g');
  const textBeforeCursor = getTextBeforeCursor(document, position);
  let matchedName = '';
  let match = regex.exec(textBeforeCursor);
  while (match) {
    matchedName = match[1] || '';
    match = regex.exec(textBeforeCursor);
  }
  return matchedName;
}

export {
  canSuggestOptionKeys,
  collectApiVariableMap,
  getComponentOptionsContext,
  getCurrentComponentOptionCandidates,
  getCurrentOptionValueContext,
  getDotAccessContext,
  getIdentifierPrefixContext,
  getNearestFunctionCallName,
  getVbPrefixContext,
  isInsideVueScript,
  isPureEnterChange,
  shouldTriggerSuggestOnEnter,
};
