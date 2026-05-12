import type { ScriptMetadata } from './metadata';

export interface GMInfo {
  script: ScriptMetadata & {
    name: string;
    namespace?: string;
    description?: string;
    version?: string;
    matches?: string[];
    grant?: string[];
  };
  scriptHandler: string;
  version: string;
  scriptMetaStr: string;
}

export interface GMXHRDetails {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string;
  responseType?: 'text' | 'json' | 'arraybuffer' | 'blob' | 'document';
  timeout?: number;
  onload?: (response: GMXHRResponse) => void;
  onerror?: (response: GMXHRResponse) => void;
  ontimeout?: (response: GMXHRResponse) => void;
  onabort?: (response: GMXHRResponse) => void;
}

export interface GMXHRResponse {
  status: number;
  statusText: string;
  responseHeaders: string;
  response: any;
  responseText?: string;
  finalUrl: string;
}

export interface GMNotificationDetails {
  text: string;
  title?: string;
  image?: string;
  onclick?: () => void;
}

export type GMBridgeChannel = 'gm-bridge';

export type GMBridgeRequestType =
  | 'GM_getValue'
  | 'GM_setValue'
  | 'GM_deleteValue'
  | 'GM_listValues'
  | 'GM_xmlhttpRequest'
  | 'GM_openInTab'
  | 'GM_setClipboard'
  | 'GM_notification';

export interface GMBridgeRequest {
  channel: GMBridgeChannel;
  direction: 'request';
  id: string;
  scriptId: string;
  type: GMBridgeRequestType;
  payload: any;
}

export interface GMBridgeResponse {
  channel: GMBridgeChannel;
  direction: 'response';
  id: string;
  ok: boolean;
  result?: any;
  error?: string;
}
