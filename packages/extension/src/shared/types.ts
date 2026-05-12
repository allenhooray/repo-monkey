import type { Script } from '../runtime';

export type Locale = 'en' | 'zh_CN';

export interface Settings {
  accessToken: string;
  repoInput: string;
  repoOwner: string;
  repoName: string;
  lastSync: string | null;
  language?: Locale;
  branch?: string;
}

export interface GitHubFile {
  name: string;
  type: string;
  sha: string;
  download_url: string;
  path?: string;
}

export type PushErrorCode =
  | 'TOKEN_INVALID'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'PATH_INVALID'
  | 'NETWORK_ERROR'
  | 'FILE_EXISTS';

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
  | 'deleteScript'
  | 'pushScript'
  | 'deleteFromRepo'
  | 'batchPush'
  | 'pullScript'
  | 'getRemoteContent'
  | 'getBranches'
  | 'createBranch';

export interface MessageRequest {
  action: MessageAction;
  scriptId?: string;
  settings?: Settings;
  request?: unknown;
  script?: unknown;
  commitMessage?: string;
  forceOverwrite?: boolean;
  branch?: string;
  sourceBranch?: string;
}

export interface BatchPushResult {
  success: number;
  failed: number;
  conflict: number;
  results: Array<{
    scriptId: string;
    fileName: string;
    success: boolean;
    errorCode?: PushErrorCode;
    error?: string;
  }>;
}

export interface PushError {
  code: PushErrorCode;
  message: string;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
}
