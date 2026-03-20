import path from 'node:path';
import { promises as fs } from 'node:fs';

import * as vscode from 'vscode';

const TARGET_OWNER = 'vbenjs';
const TARGET_REPO = 'vue-vben-admin';
const TARGET_REPO_FULL_NAME = `${TARGET_OWNER}/${TARGET_REPO}`;

const SYNC_UPSTREAM_COMMIT_COMMAND_ID = 'vbenAdminSnippet.syncUpstreamCommit';
const OUTPUT_CHANNEL_NAME = 'Vben Admin Snippet: Upstream Sync';

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const SUPPORTED_FILE_STATUSES = new Set(['added', 'modified', 'removed']);

const GITHUB_API_BASE_URL = `https://api.github.com/repos/${TARGET_REPO_FULL_NAME}`;
const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${TARGET_REPO_FULL_NAME}`;

class OperationCancelledError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OperationCancelledError';
  }
}

let outputChannel;

function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
  return outputChannel;
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function encodeRepoPath(filePath) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

function toNormalizedWorkspacePath(filePath) {
  return path.resolve(filePath).replaceAll('\\', '/').toLowerCase();
}

function toSafeWorkspaceFilePath(workspaceRootPath, relativePath) {
  if (!relativePath || relativePath.includes('\0')) {
    return null;
  }

  const normalizedRelativePath = relativePath.replaceAll('\\', '/');
  if (normalizedRelativePath.startsWith('/')) {
    return null;
  }

  const resolvedPath = path.resolve(workspaceRootPath, normalizedRelativePath);
  const workspacePathNormalized = toNormalizedWorkspacePath(workspaceRootPath);
  const resolvedPathNormalized = toNormalizedWorkspacePath(resolvedPath);
  const workspacePathWithSlash = workspacePathNormalized.endsWith('/')
    ? workspacePathNormalized
    : `${workspacePathNormalized}/`;

  if (
    resolvedPathNormalized !== workspacePathNormalized &&
    !resolvedPathNormalized.startsWith(workspacePathWithSlash)
  ) {
    return null;
  }

  return resolvedPath;
}

function buildRawFileUrl(commitSha, filePath) {
  return `${GITHUB_RAW_BASE_URL}/${commitSha}/${encodeRepoPath(filePath)}`;
}

function createGithubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vben-admin-snippet-vscode',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readGithubErrorMessage(response) {
  try {
    const body = await response.json();
    if (body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {}
  return `${response.status} ${response.statusText}`;
}

async function fetchGithubJson(url) {
  const response = await fetch(url, {
    headers: createGithubHeaders(),
    method: 'GET',
  });
  if (!response.ok) {
    const message = await readGithubErrorMessage(response);
    throw new Error(`请求 GitHub 失败 (${response.status}): ${message}`);
  }
  return response.json();
}

async function fetchGithubRawBytes(commitSha, filePath) {
  const response = await fetch(buildRawFileUrl(commitSha, filePath), {
    headers: createGithubHeaders(),
    method: 'GET',
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const message = await readGithubErrorMessage(response);
    throw new Error(
      `读取上游文件失败 (${response.status}): ${filePath} @ ${commitSha} (${message})`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getRawFileBytes(cache, commitSha, filePath) {
  const cacheKey = `${commitSha}:${filePath}`;
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, fetchGithubRawBytes(commitSha, filePath));
  }
  return cache.get(cacheKey);
}

async function readLocalFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeLocalFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function removeLocalFile(filePath) {
  await fs.rm(filePath, { force: true });
}

function hasSameTextContent(leftBuffer, rightBuffer) {
  return (
    normalizeLineEndings(leftBuffer.toString('utf8')) ===
    normalizeLineEndings(rightBuffer.toString('utf8'))
  );
}

function parseCommitInput(input) {
  const normalizedInput = String(input || '').trim();
  if (!normalizedInput) {
    return { errorMessage: '请输入 commit SHA 或 GitHub commit URL。' };
  }

  if (COMMIT_SHA_PATTERN.test(normalizedInput)) {
    return { commitSha: normalizedInput };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedInput);
  } catch {
    return {
      errorMessage:
        '输入格式不正确，请输入 commit SHA 或 https://github.com/vbenjs/vue-vben-admin/commit/<sha>。',
    };
  }

  if (parsedUrl.hostname !== 'github.com') {
    return { errorMessage: '仅支持 GitHub commit URL。' };
  }

  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  if (pathParts.length < 4 || pathParts[2] !== 'commit') {
    return {
      errorMessage:
        'URL 需要是 commit 链接，例如 https://github.com/vbenjs/vue-vben-admin/commit/<sha>。',
    };
  }

  const owner = pathParts[0];
  const repo = pathParts[1];
  if (owner !== TARGET_OWNER || repo !== TARGET_REPO) {
    return {
      errorMessage: `仅允许同步 ${TARGET_REPO_FULL_NAME} 的 commit。`,
    };
  }

  const shaCandidate = pathParts[3].replace(/\.(patch|diff)$/i, '');
  if (!COMMIT_SHA_PATTERN.test(shaCandidate)) {
    return { errorMessage: 'URL 中的 commit SHA 格式不正确。' };
  }

  return { commitSha: shaCandidate };
}

async function pickWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  return vscode.window.showWorkspaceFolderPick({
    placeHolder: '选择要同步 commit 的工作区目录',
  });
}

async function promptCommitInput() {
  return vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder:
      '输入 commit SHA 或 https://github.com/vbenjs/vue-vben-admin/commit/<sha>',
    prompt: `仅支持 ${TARGET_REPO_FULL_NAME} 的 commit`,
    title: '同步上游 Commit（安全模式）',
    validateInput: (value) => {
      const parsed = parseCommitInput(value);
      return parsed.errorMessage || null;
    },
  });
}

function formatFileResult(result) {
  return `[${result.status.toUpperCase()}] ${result.path} - ${result.reason}`;
}

async function applyFileChange(file, context) {
  const relativePath = typeof file.filename === 'string' ? file.filename : '';
  if (!relativePath) {
    return {
      path: '<unknown>',
      reason: 'commit 文件条目缺少 filename',
      status: 'skipped',
    };
  }

  const localFilePath = toSafeWorkspaceFilePath(
    context.workspaceRootPath,
    relativePath,
  );
  if (!localFilePath) {
    return {
      path: relativePath,
      reason: '文件路径超出工作区范围，已跳过',
      status: 'skipped',
    };
  }

  const changeStatus = typeof file.status === 'string' ? file.status : '';
  if (!SUPPORTED_FILE_STATUSES.has(changeStatus)) {
    return {
      path: relativePath,
      reason: `暂不支持 ${changeStatus || 'unknown'} 变更（例如 renamed/binary）`,
      status: 'skipped',
    };
  }

  if (typeof file.patch !== 'string') {
    return {
      path: relativePath,
      reason: '二进制文件或补丁过大，当前版本暂不自动同步',
      status: 'skipped',
    };
  }

  if (changeStatus === 'added') {
    const localContent = await readLocalFileIfExists(localFilePath);
    if (localContent !== null) {
      return {
        path: relativePath,
        reason: '本地文件已存在，视为已改动，已跳过',
        status: 'skipped',
      };
    }

    const nextContent = await getRawFileBytes(
      context.rawFileCache,
      context.commitSha,
      relativePath,
    );
    if (nextContent === null) {
      return {
        path: relativePath,
        reason: '未能读取 commit 版本文件内容',
        status: 'failed',
      };
    }

    await writeLocalFile(localFilePath, nextContent);
    return {
      path: relativePath,
      reason: '已新增到本地',
      status: 'applied',
    };
  }

  if (changeStatus === 'removed') {
    const localContent = await readLocalFileIfExists(localFilePath);
    if (localContent === null) {
      return {
        path: relativePath,
        reason: '本地文件已不存在，已跳过',
        status: 'skipped',
      };
    }

    const parentContent = await getRawFileBytes(
      context.rawFileCache,
      context.parentSha,
      relativePath,
    );
    if (parentContent === null) {
      return {
        path: relativePath,
        reason: '未能读取父提交中的文件内容',
        status: 'failed',
      };
    }

    if (!hasSameTextContent(localContent, parentContent)) {
      return {
        path: relativePath,
        reason: '本地文件与父提交内容不一致，已跳过',
        status: 'skipped',
      };
    }

    await removeLocalFile(localFilePath);
    return {
      path: relativePath,
      reason: '已按上游 commit 删除本地文件',
      status: 'applied',
    };
  }

  const localContent = await readLocalFileIfExists(localFilePath);
  if (localContent === null) {
    return {
      path: relativePath,
      reason: '本地文件不存在，无法判断是否未改动，已跳过',
      status: 'skipped',
    };
  }

  const parentContent = await getRawFileBytes(
    context.rawFileCache,
    context.parentSha,
    relativePath,
  );
  const nextContent = await getRawFileBytes(
    context.rawFileCache,
    context.commitSha,
    relativePath,
  );
  if (parentContent === null || nextContent === null) {
    return {
      path: relativePath,
      reason: '读取上游父提交或 commit 文件内容失败',
      status: 'failed',
    };
  }

  if (!hasSameTextContent(localContent, parentContent)) {
    return {
      path: relativePath,
      reason: '本地文件与父提交内容不一致，已跳过',
      status: 'skipped',
    };
  }

  await writeLocalFile(localFilePath, nextContent);
  return {
    path: relativePath,
    reason: '已更新为上游 commit 版本',
    status: 'applied',
  };
}

async function syncUpstreamCommit() {
  const workspaceFolder = await pickWorkspaceFolder();
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('未找到可用工作区，请先打开项目目录。');
    return;
  }

  const input = await promptCommitInput();
  if (!input) {
    return;
  }

  const parsed = parseCommitInput(input);
  if (parsed.errorMessage) {
    vscode.window.showErrorMessage(parsed.errorMessage);
    return;
  }

  const output = getOutputChannel();
  output.show(true);
  output.appendLine('');
  output.appendLine(`== ${new Date().toLocaleString()} ==`);
  output.appendLine(`工作区: ${workspaceFolder.uri.fsPath}`);
  output.appendLine(`目标仓库: ${TARGET_REPO_FULL_NAME}`);
  output.appendLine(`输入: ${input}`);
  output.appendLine(`解析 commit: ${parsed.commitSha}`);

  try {
    const summary = await vscode.window.withProgress(
      {
        cancellable: false,
        location: vscode.ProgressLocation.Notification,
        title: 'Vben Admin Snippet: 正在同步上游 commit',
      },
      async (progress) => {
        progress.report({ message: '读取 commit 信息...' });
        const commitData = await fetchGithubJson(
          `${GITHUB_API_BASE_URL}/commits/${parsed.commitSha}`,
        );

        const parents = Array.isArray(commitData.parents) ? commitData.parents : [];
        if (parents.length === 0) {
          throw new Error('当前暂不支持 root commit（无父提交）。');
        }

        const parentSha = String(parents[0]?.sha || '');
        if (!COMMIT_SHA_PATTERN.test(String(parentSha || ''))) {
          throw new Error('未能识别父提交 SHA。');
        }

        if (!Array.isArray(commitData.files) || commitData.files.length === 0) {
          throw new Error('该 commit 没有可同步的文件变更。');
        }

        const isMergeCommit = parents.length > 1;
        const proceed = await vscode.window.showWarningMessage(
          `将同步 ${TARGET_REPO_FULL_NAME} 的 commit ${String(commitData.sha).slice(0, 12)}，共 ${commitData.files.length} 个文件。对比父提交 ${String(parentSha).slice(0, 12)}${isMergeCommit ? '（merge commit，默认第 1 父提交）' : ''}，仅当本地文件与该父提交一致时才会应用，是否继续？`,
          { modal: true },
          '继续',
        );
        if (proceed !== '继续') {
          throw new OperationCancelledError('已取消同步。');
        }

        output.appendLine(`上游 commit: ${commitData.sha}`);
        output.appendLine(`父提交: ${parentSha}`);
        if (isMergeCommit) {
          output.appendLine(
            `merge parents: ${parents.map((item) => String(item?.sha || '')).join(', ')}`,
          );
        }
        output.appendLine(`文件数: ${commitData.files.length}`);

        const context = {
          commitSha: String(commitData.sha),
          parentSha: String(parentSha),
          rawFileCache: new Map(),
          workspaceRootPath: workspaceFolder.uri.fsPath,
        };
        const totals = { applied: 0, failed: 0, skipped: 0 };

        const step = commitData.files.length > 0 ? 100 / commitData.files.length : 100;
        for (let index = 0; index < commitData.files.length; index += 1) {
          const file = commitData.files[index];
          progress.report({
            increment: step,
            message: `处理文件 ${index + 1}/${commitData.files.length}`,
          });

          let result;
          try {
            result = await applyFileChange(file, context);
          } catch (error) {
            result = {
              path:
                typeof file?.filename === 'string' ? file.filename : '<unknown>',
              reason: getErrorMessage(error),
              status: 'failed',
            };
          }

          totals[result.status] += 1;
          output.appendLine(formatFileResult(result));
        }

        return totals;
      },
    );

    const message = `同步完成：应用 ${summary.applied}，跳过 ${summary.skipped}，失败 ${summary.failed}。`;
    output.appendLine(message);
    if (summary.failed > 0) {
      vscode.window.showWarningMessage(`${message} 详情见输出面板。`);
      return;
    }

    vscode.window.showInformationMessage(message);
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      output.appendLine(error.message);
      vscode.window.showInformationMessage(error.message);
      return;
    }

    const message = getErrorMessage(error);
    output.appendLine(`同步失败: ${message}`);
    vscode.window.showErrorMessage(`同步上游 commit 失败: ${message}`);
  }
}

function registerUpstreamCommitSyncCommand(context) {
  const disposable = vscode.commands.registerCommand(
    SYNC_UPSTREAM_COMMIT_COMMAND_ID,
    syncUpstreamCommit,
  );
  const outputDisposable = new vscode.Disposable(() => {
    if (!outputChannel) {
      return;
    }
    outputChannel.dispose();
    outputChannel = undefined;
  });

  context.subscriptions.push(disposable, outputDisposable);
}

export { SYNC_UPSTREAM_COMMIT_COMMAND_ID, registerUpstreamCommitSyncCommand };
