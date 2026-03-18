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

function findParenEndIndex(text, startIndex) {
  if (startIndex < 0 || text[startIndex] !== '(') {
    return -1;
  }

  let parenDepth = 0;
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

    if (ch === '(') {
      parenDepth += 1;
      continue;
    }
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
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

function collectTopLevelObjectValueObjectRanges(text, objectStart, objectEnd) {
  const ranges = [];
  if (objectStart < 0 || objectEnd <= objectStart) {
    return ranges;
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
  let currentKey = '';

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

    const isTopLevelBeforeValueCheck =
      braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
    // Top-level value object like: key: { ... }
    if (
      isTopLevelBeforeValueCheck &&
      !expectingKey &&
      currentKey &&
      ch === '{'
    ) {
      const valueObjectStart = i;
      const valueObjectEnd = findObjectEndIndex(text, valueObjectStart);
      if (valueObjectEnd !== -1) {
        ranges.push({
          key: currentKey,
          objectEnd: valueObjectEnd,
          objectStart: valueObjectStart,
        });
        i = valueObjectEnd;
        continue;
      }
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
      currentKey = '';
      continue;
    }

    if (expectingKey) {
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
          currentKey = key;
          expectingKey = false;
          i = k;
        } else {
          i = j - 1;
        }
      }
      continue;
    }

  }

  return ranges;
}

function isCursorAtObjectTopLevel(text, objectStart, cursorOffset, objectEnd) {
  if (objectStart < 0 || cursorOffset <= objectStart) {
    return false;
  }
  if (objectEnd !== -1 && cursorOffset > objectEnd) {
    return false;
  }

  const scanEnd = objectEnd === -1 ? cursorOffset : Math.min(cursorOffset, objectEnd);

  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = objectStart + 1; i < scanEnd; i++) {
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
  }

  return braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
}

const NESTED_OPTION_OWNER_MAP = {
  useVbenVxeGrid: {
    formOptions: 'useVbenForm',
    gridEvents: 'VxeGridEvents',
    gridOptions: 'VxeGridProps',
  },
};

const VARIABLE_NAME_OPTION_OWNER_MAP = {
  formOptions: 'useVbenForm',
  gridEvents: 'VxeGridEvents',
  gridOptions: 'VxeGridProps',
};

function getBraceDepth(text, startIndex) {
  if (startIndex < 0 || text[startIndex] !== '{') {
    return 0;
  }

  const objectEnd = findObjectEndIndex(text, startIndex);
  if (objectEnd !== -1 && text.length > objectEnd + 1) {
    return 0;
  }

  let depth = 0;
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
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
    }
  }

  return depth > 0 ? depth : 0;
}

function getInlineComponentOptionsContext(document, position) {
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

function resolveFunctionNameByOptionsVariable(text, variableName, anchorIndex) {
  if (!text || !variableName) {
    return '';
  }

  const escapedVariableName = escapeRegExp(variableName);
  let bestMatched = null;

  for (const functionName of Object.keys(COMPONENT_OPTIONS)) {
    const escapedFunctionName = escapeRegExp(functionName);
    const functionCallPattern = new RegExp(
      String.raw`\b${escapedFunctionName}\s*\(`,
      'g',
    );

    let callMatch = functionCallPattern.exec(text);
    while (callMatch) {
      const openParenIndex =
        callMatch.index + callMatch[0].lastIndexOf('(');
      const closeParenIndex = findParenEndIndex(text, openParenIndex);
      if (closeParenIndex === -1) {
        callMatch = functionCallPattern.exec(text);
        continue;
      }

      const argsText = text.slice(openParenIndex + 1, closeParenIndex);
      const directArgPattern = new RegExp(
        String.raw`(?:^|,)\s*${escapedVariableName}\s*(?:,|$)`,
      );
      const shorthandObjectPattern = new RegExp(
        String.raw`[{,]\s*${escapedVariableName}\s*(?=[,}])`,
      );
      const assignedObjectPattern = new RegExp(
        String.raw`:\s*${escapedVariableName}\s*(?=[,}])`,
      );
      const spreadPattern = new RegExp(
        String.raw`\.\.\.\s*${escapedVariableName}\b`,
      );

      const isReferencedInArgs =
        directArgPattern.test(argsText) ||
        shorthandObjectPattern.test(argsText) ||
        assignedObjectPattern.test(argsText) ||
        spreadPattern.test(argsText);

      let mappedFunctionName = '';
      const nestedMap = NESTED_OPTION_OWNER_MAP[functionName];
      if (nestedMap) {
        for (const [optionKey, ownerFunctionName] of Object.entries(nestedMap)) {
          const escapedOptionKey = escapeRegExp(optionKey);
          const shorthandNestedPattern = new RegExp(
            String.raw`[{,]\s*${escapedOptionKey}\s*(?=[,}])`,
          );
          const assignedNestedPattern = new RegExp(
            String.raw`\b${escapedOptionKey}\s*:\s*${escapedVariableName}\s*(?=[,}])`,
          );
          if (
            shorthandNestedPattern.test(argsText) &&
            variableName === optionKey
          ) {
            mappedFunctionName = ownerFunctionName;
            break;
          }
          if (assignedNestedPattern.test(argsText)) {
            mappedFunctionName = ownerFunctionName;
            break;
          }
        }
      }

      if (isReferencedInArgs) {
        const distance = Math.abs(callMatch.index - anchorIndex);
        if (!bestMatched || distance < bestMatched.distance) {
          bestMatched = {
            distance,
            functionName: mappedFunctionName || functionName,
          };
        }
      }

      callMatch = functionCallPattern.exec(text);
    }
  }

  if (bestMatched?.functionName) {
    return bestMatched.functionName;
  }

  // Fallback for common option vars used with useVbenVxeGrid.
  if (/\buseVbenVxeGrid\s*\(/.test(text)) {
    return VARIABLE_NAME_OPTION_OWNER_MAP[variableName] || '';
  }

  return '';
}

function getVariableComponentOptionsContext(document, position) {
  const textBeforeCursor = getTextBeforeCursor(document, position);
  const fullText = document.getText();
  const pattern =
    /\b(?:const|let|var)\s+([A-Z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{/gi;
  let match = pattern.exec(textBeforeCursor);
  let matchedContext = null;

  while (match) {
    const variableName = match[1] || '';
    const objectStart = match.index + match[0].lastIndexOf('{');
    const depth = getBraceDepth(textBeforeCursor, objectStart);
    if (depth <= 0) {
      match = pattern.exec(textBeforeCursor);
      continue;
    }

    const functionName = resolveFunctionNameByOptionsVariable(
      fullText,
      variableName,
      objectStart,
    );
    if (
      !functionName ||
      (matchedContext && objectStart <= matchedContext.objectStart)
    ) {
      match = pattern.exec(textBeforeCursor);
      continue;
    }

    matchedContext = {
      depth,
      functionName,
      objectStart,
    };
    match = pattern.exec(textBeforeCursor);
  }

  return matchedContext;
}

function getComponentOptionsContext(document, position) {
  const inlineContext = getInlineComponentOptionsContext(document, position);
  const variableContext = getVariableComponentOptionsContext(document, position);

  if (!inlineContext) {
    return variableContext;
  }
  if (!variableContext) {
    return inlineContext;
  }

  return inlineContext.objectStart > variableContext.objectStart
    ? inlineContext
    : variableContext;
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

function getNamedVariableObjectLiteralContext(document, position) {
  const textBeforeCursor = getTextBeforeCursor(document, position);
  const pattern =
    /\b(?:const|let|var)\s+([A-Z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{/gi;
  let match = pattern.exec(textBeforeCursor);
  let matchedContext = null;

  while (match) {
    const variableName = match[1] || '';
    const objectStart = match.index + match[0].lastIndexOf('{');
    const depth = getBraceDepth(textBeforeCursor, objectStart);
    if (depth > 0 && (!matchedContext || objectStart > matchedContext.objectStart)) {
      matchedContext = {
        depth,
        objectStart,
        variableName,
      };
    }
    match = pattern.exec(textBeforeCursor);
  }

  return matchedContext;
}

function getForcedVariableOwnerContext(document, position) {
  const namedVariableObjectContext = getNamedVariableObjectLiteralContext(
    document,
    position,
  );
  if (!namedVariableObjectContext || namedVariableObjectContext.depth !== 1) {
    return null;
  }

  const mappedFunctionName =
    VARIABLE_NAME_OPTION_OWNER_MAP[namedVariableObjectContext.variableName];
  if (!mappedFunctionName) {
    return null;
  }

  return {
    functionName: mappedFunctionName,
    objectStart: namedVariableObjectContext.objectStart,
    sourcePriority: 5,
  };
}

function getNearestTopLevelOptionsOwnerContext(document, position) {
  const contexts = [];
  const cursorOffset = document.offsetAt(position);

  const componentOptionsContext = getComponentOptionsContext(document, position);
  if (componentOptionsContext) {
    const nestedMap =
      NESTED_OPTION_OWNER_MAP[componentOptionsContext.functionName];
    if (nestedMap) {
      const text = document.getText();
      const parentObjectStart = componentOptionsContext.objectStart;
      const parentObjectEnd = findObjectEndIndex(text, parentObjectStart);
      if (parentObjectEnd !== -1) {
        const valueObjectRanges = collectTopLevelObjectValueObjectRanges(
          text,
          parentObjectStart,
          parentObjectEnd,
        );
        for (const range of valueObjectRanges) {
          const mappedFunctionName = nestedMap[range.key];
          if (
            mappedFunctionName &&
            cursorOffset > range.objectStart &&
            cursorOffset <= range.objectEnd
          ) {
            contexts.push({
              functionName: mappedFunctionName,
              objectStart: range.objectStart,
              sourcePriority: 3,
            });
          }
        }
      }
    }
  }

  if (componentOptionsContext && componentOptionsContext.depth === 1) {
    contexts.push({
      functionName: componentOptionsContext.functionName,
      objectStart: componentOptionsContext.objectStart,
      sourcePriority: 1,
    });
  }

  const typedObjectContext = getTypedObjectLiteralContext(document, position);
  if (typedObjectContext && typedObjectContext.depth === 1) {
    contexts.push({
      functionName: typedObjectContext.typeName,
      objectStart: typedObjectContext.objectStart,
      sourcePriority: 2,
    });
  }

  const namedVariableObjectContext = getNamedVariableObjectLiteralContext(
    document,
    position,
  );
  if (namedVariableObjectContext && namedVariableObjectContext.depth === 1) {
    const mappedFunctionName =
      VARIABLE_NAME_OPTION_OWNER_MAP[namedVariableObjectContext.variableName];
    if (mappedFunctionName) {
      contexts.push({
        functionName: mappedFunctionName,
        objectStart: namedVariableObjectContext.objectStart,
        sourcePriority: 4,
      });
    }
  }

  if (contexts.length === 0) {
    return null;
  }

  contexts.sort(
    (a, b) =>
      b.objectStart - a.objectStart || b.sourcePriority - a.sourcePriority,
  );

  for (const context of contexts) {
    if ((COMPONENT_OPTIONS[context.functionName] || []).length > 0) {
      return context;
    }
  }

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
  const context =
    getForcedVariableOwnerContext(document, position) ||
    getNearestTopLevelOptionsOwnerContext(document, position);
  if (!context) {
    return null;
  }

  const text = document.getText();
  const objectStart = context.objectStart;
  const objectEnd = findObjectEndIndex(text, objectStart);
  const cursorOffset = document.offsetAt(position);
  if (!isCursorAtObjectTopLevel(text, objectStart, cursorOffset, objectEnd)) {
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
  const context =
    getForcedVariableOwnerContext(document, position) ||
    getNearestTopLevelOptionsOwnerContext(document, position);
  if (!context) {
    return null;
  }

  const text = document.getText();
  const objectStart = context.objectStart;
  const objectEnd = findObjectEndIndex(text, objectStart);
  const cursorOffset = document.offsetAt(position);
  if (!isCursorAtObjectTopLevel(text, objectStart, cursorOffset, objectEnd)) {
    return null;
  }
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
  // 支持普通回车与花括号中间回车（可能一次插入两行缩进）。
  if (!change.text || !change.text.includes('\n')) {
    return false;
  }
  return /^[\r\n \t]+$/.test(change.text);
}

function shouldTriggerSuggestOnEnter(editor) {
  const position = editor.selection.active;
  if (!isInsideVueScript(editor.document, position)) {
    return false;
  }

  if (!canSuggestOptionKeys(editor.document, position)) {
    return false;
  }

  const componentCandidates = getCurrentComponentOptionCandidates(
    editor.document,
    position,
  );
  if (!componentCandidates || componentCandidates.options.length === 0) {
    return false;
  }

  return true;
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
