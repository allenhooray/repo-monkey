export type Locale = 'en' | 'zh_CN';

export interface Settings {
  accessToken: string;
  repoInput: string;
  repoOwner: string;
  repoName: string;
  lastSync: string | null;
  language?: Locale;
}

export interface GitHubFile {
  name: string;
  type: string;
  sha: string;
  download_url: string;
  path?: string;
}

export type MessageAction =
  | 'syncScripts'
  | 'getScripts'
  | 'toggleScript'
  | 'getSettings'
  | 'saveSettings'
  | 'unbindRepo'
  | 'gmBridge'
  | 'createScript'
  | 'updateScript'
  | 'deleteScript';

export interface MessageRequest {
  action: MessageAction;
  scriptId?: string;
  settings?: Settings;
  request?: any;
  script?: any;
}
