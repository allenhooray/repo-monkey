export interface RepoInfo {
  owner: string;
  repo: string;
}

/**
 * 解析仓库输入，支持 owner/repo、HTTPS URL、SSH URL 格式
 */
export function parseRepoInput(input: string): RepoInfo | null {
  if (!input) return null;

  const trimmed = input.trim();

  // 解析 owner/repo 格式
  const ownerRepoMatch = trimmed.match(/^([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)$/);
  if (ownerRepoMatch) {
    return {
      owner: ownerRepoMatch[1],
      repo: ownerRepoMatch[2],
    };
  }

  // 解析 HTTPS URL 格式
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)(?:\.git)?\/?$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    };
  }

  // 解析 SSH URL 格式
  const sshMatch = trimmed.match(/^git@github\.com:([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)(?:\.git)?\/?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  return null;
}
