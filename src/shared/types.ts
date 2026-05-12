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
}

export type MessageAction =
  | 'syncScripts'
  | 'getScripts'
  | 'toggleScript'
  | 'getSettings'
  | 'saveSettings'
  | 'unbindRepo'
  | 'executeScripts'
  | 'injectScript'
  | 'gmBridge';

export interface MessageRequest {
  action: MessageAction;
  scriptId?: string;
  settings?: Settings;
  url?: string;
  script?: any;
  request?: any;
}

export interface MessageResponse {
  success?: boolean;
  scripts?: any[];
  settings?: Settings;
  error?: string;
}
