import type { Settings, GitHubFile, PushError, PushErrorCode } from '../../shared/types';
import type { Script } from '../../runtime';
import { ScriptSource } from '../../shared/constants';

/**
 * 将 Unicode 字符串编码为 Base64
 */
function encodeUnicodeToBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = '';
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/**
 * 将 Base64 解码为 Unicode 字符串
 */
function decodeBase64ToUnicode(base64Str: string): string {
  const binaryString = atob(base64Str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export interface PushResult {
  success: boolean;
  sha?: string;
  error?: PushError;
  remotePath?: string;
}

/**
 * 推送脚本到仓库
 */
export async function pushScriptToRepo(
  settings: Settings,
  script: Script,
  commitMessage: string,
  forceOverwrite = false
): Promise<PushResult> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const remotePath = script.remotePath || script.fileName;
  let apiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${encodeURIComponent(remotePath)}`;
  if (settings.branch) {
    apiUrl += `?ref=${encodeURIComponent(settings.branch)}`;
  }

  try {
    let currentSha: string | undefined;
    
    // 检查文件是否已存在
    const checkResponse = await fetch(apiUrl, { headers });
    if (checkResponse.ok) {
      const fileInfo = await checkResponse.json();
      currentSha = fileInfo.sha;
    }

    // 如果是本地脚本且文件已存在，且不强制覆盖，返回错误
    if (script.source === ScriptSource.LOCAL && currentSha && !forceOverwrite) {
      return {
        success: false,
        error: {
          code: 'FILE_EXISTS',
          message: 'File already exists in repository',
        },
      };
    }

    const body: any = {
      message: commitMessage,
      content: encodeUnicodeToBase64(script.content),
    };

    // 如果是修改的脚本或强制覆盖，添加 sha
    if (script.source === ScriptSource.MODIFIED || forceOverwrite) {
      if (forceOverwrite && currentSha) {
        body.sha = currentSha;
      } else if (script.remoteSha) {
        body.sha = script.remoteSha;
      }
    }

    // 如果指定了分支，添加到请求体
    if (settings.branch) {
      body.branch = settings.branch;
    }

    // PUT 请求不需要 ref 查询参数，通过 body 中的 branch 字段设置
    const putApiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${encodeURIComponent(remotePath)}`;
    const response = await fetch(putApiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorCode: PushError['code'];
      let errorMessage = `GitHub API error: ${response.status}`;
      
      switch (response.status) {
        case 401:
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Invalid or expired access token';
          break;
        case 403:
          errorCode = 'PERMISSION_DENIED';
          errorMessage = 'Insufficient permissions to push to repository';
          break;
        case 409:
          errorCode = 'CONFLICT';
          errorMessage = 'Conflict: remote file has changed';
          break;
        case 422:
          errorCode = 'PATH_INVALID';
          errorMessage = 'Invalid file path';
          break;
        default:
          errorCode = 'NETWORK_ERROR';
      }
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      sha: result.content.sha,
      remotePath,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * 递归获取目录内容
 */
async function fetchDirectoryContents(
  settings: Settings,
  path: string,
  headers: Record<string, string>
): Promise<GitHubFile[]> {
  let url = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${path}`;
  if (settings.branch) {
    url += `?ref=${encodeURIComponent(settings.branch)}`;
  }
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  const items = await response.json();
  const allFiles: GitHubFile[] = [];

  // 处理 GitHub API 返回单个文件（对象）或目录列表（数组）的情况
  const fileList = Array.isArray(items) ? items : [items];

  for (const item of fileList) {
    allFiles.push(item);
    if (item.type === 'dir') {
      const subFiles = await fetchDirectoryContents(settings, item.path, headers);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

/**
 * 从仓库获取文件列表
 */
export async function fetchFilesFromRepo(settings: Settings): Promise<GitHubFile[]> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  let files: GitHubFile[] = [];

  try {
    // 先尝试从 output 目录获取
    files = await fetchDirectoryContents(settings, 'output', headers);
    if (files.length === 0) {
      throw new Error('No files found in output directory');
    }
  } catch (e) {
    // 如果失败，尝试从根目录获取
    try {
      files = await fetchDirectoryContents(settings, '', headers);
    } catch (rootErr) {
      console.error('Failed to fetch root directory:', rootErr);
    }
  }

  return files;
}

/**
 * 获取文件内容
 */
export async function fetchFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  return response.text();
}

export interface DeleteFileResult {
  success: boolean;
  error?: PushError;
}

/**
 * 从仓库删除文件
 */
export async function deleteFileFromRepo(
  settings: Settings,
  remotePath: string,
  sha: string,
  commitMessage: string
): Promise<DeleteFileResult> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const apiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${encodeURIComponent(remotePath)}`;

  try {
    const body: any = {
      message: commitMessage,
      sha,
    };

    // 如果指定了分支，添加到请求体
    if (settings.branch) {
      body.branch = settings.branch;
    }

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorCode: PushErrorCode = 'NETWORK_ERROR';
      let errorMessage = `GitHub API error: ${response.status}`;
      
      switch (response.status) {
        case 401:
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Invalid or expired access token';
          break;
        case 403:
          errorCode = 'PERMISSION_DENIED';
          errorMessage = 'Insufficient permissions to delete from repository';
          break;
        case 422:
          errorCode = 'PATH_INVALID';
          errorMessage = 'Invalid file path';
          break;
      }
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

export interface RemoteContentResult {
  success: boolean;
  content?: string;
  sha?: string;
  error?: PushError;
}

/**
 * 获取远程文件内容
 */
export async function fetchRemoteContent(
  settings: Settings,
  remotePath: string
): Promise<RemoteContentResult> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  let apiUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${encodeURIComponent(remotePath)}`;
  if (settings.branch) {
    apiUrl += `?ref=${encodeURIComponent(settings.branch)}`;
  }

  try {
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      let errorCode: PushErrorCode = 'NETWORK_ERROR';
      let errorMessage = `GitHub API error: ${response.status}`;
      
      switch (response.status) {
        case 401:
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Invalid or expired access token';
          break;
        case 403:
          errorCode = 'PERMISSION_DENIED';
          errorMessage = 'Insufficient permissions';
          break;
        case 404:
          errorCode = 'PATH_INVALID';
          errorMessage = 'File not found';
          break;
      }
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    const data = await response.json();
    const content = decodeBase64ToUnicode(data.content);

    return {
      success: true,
      content,
      sha: data.sha,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

export interface Branch {
  name: string;
  protected: boolean;
}

export interface BranchesResult {
  success: boolean;
  branches?: Branch[];
  defaultBranch?: string;
  error?: PushError;
}

export interface CreateBranchResult {
  success: boolean;
  branchName?: string;
  error?: PushError;
}

/**
 * 获取仓库分支列表
 */
export async function fetchBranches(settings: Settings): Promise<BranchesResult> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  try {
    // 先获取仓库信息以获取默认分支
    const repoResponse = await fetch(
      `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}`,
      { headers }
    );

    if (!repoResponse.ok) {
      let errorCode: PushErrorCode = 'NETWORK_ERROR';
      let errorMessage = `GitHub API error: ${repoResponse.status}`;
      
      switch (repoResponse.status) {
        case 401:
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Invalid or expired access token';
          break;
        case 403:
          errorCode = 'PERMISSION_DENIED';
          errorMessage = 'Insufficient permissions';
          break;
      }
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Fetch branches
    const branchesResponse = await fetch(
      `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/branches?per_page=100`,
      { headers }
    );

    if (!branchesResponse.ok) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to fetch branches',
        },
      };
    }

    const branches: Branch[] = await branchesResponse.json();

    return {
      success: true,
      branches,
      defaultBranch,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * 创建新分支
 */
export async function createBranch(
  settings: Settings,
  newBranchName: string,
  sourceBranch?: string
): Promise<CreateBranchResult> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // 先获取源分支的 SHA
    const branchToUse = sourceBranch || settings.branch;
    let refUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/git/ref/heads/${encodeURIComponent(branchToUse || '')}`;
    
    // 如果没有指定源分支，获取默认分支
    if (!branchToUse) {
      const repoResponse = await fetch(
        `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}`,
        { headers }
      );
      if (!repoResponse.ok) {
        let errorCode: PushErrorCode = 'NETWORK_ERROR';
        let errorMessage = `GitHub API error: ${repoResponse.status}`;
        return {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
          },
        };
      }
      const repoData = await repoResponse.json();
      refUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/git/ref/heads/${encodeURIComponent(repoData.default_branch)}`;
    }

    const refResponse = await fetch(refUrl, { headers });
    if (!refResponse.ok) {
      let errorCode: PushErrorCode = 'NETWORK_ERROR';
      let errorMessage = `Failed to get source branch: ${refResponse.status}`;
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    const refData = await refResponse.json();
    const sourceSha = refData.object.sha;

    // 创建新分支
    const createResponse = await fetch(
      `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/git/refs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${newBranchName}`,
          sha: sourceSha,
        }),
      }
    );

    if (!createResponse.ok) {
      let errorCode: PushErrorCode = 'NETWORK_ERROR';
      let errorMessage = `Failed to create branch: ${createResponse.status}`;
      
      switch (createResponse.status) {
        case 401:
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Invalid or expired access token';
          break;
        case 403:
          errorCode = 'PERMISSION_DENIED';
          errorMessage = 'Insufficient permissions';
          break;
        case 422:
          errorCode = 'PATH_INVALID';
          errorMessage = 'Branch already exists';
          break;
      }
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      branchName: newBranchName,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}
