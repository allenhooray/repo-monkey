export interface RepoInfo {
  owner: string;
  repo: string;
}

export interface Script {
  id: string;
  name: string;
  match: string;
  content: string;
  fileName: string;
  sha: string;
  updatedAt: string;
  enabled: boolean;
}

export interface Settings {
  accessToken: string;
  repoInput: string;
  repoOwner: string;
  repoName: string;
  lastSync: string | null;
}

export interface GitHubFile {
  name: string;
  type: string;
  sha: string;
  download_url: string;
}

export type MessageAction =
  | 'syncScripts'
  | 'getScripts'
  | 'toggleScript'
  | 'getSettings'
  | 'saveSettings'
  | 'unbindRepo'
  | 'executeScripts'
  | 'injectScript';

export interface MessageRequest {
  action: MessageAction;
  scriptId?: string;
  settings?: Settings;
  url?: string;
  script?: Script;
}

export interface MessageResponse {
  success?: boolean;
  scripts?: Script[];
  settings?: Settings;
  error?: string;
}
