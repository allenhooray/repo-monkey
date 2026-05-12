export interface RegisteredUserScriptEntry {
  scriptId: string;
  matches: string[];
  code: string;
  runAt?: 'document_start' | 'document_end' | 'document_idle';
}

export interface RuntimeAdapter {
  registerScripts(entries: RegisteredUserScriptEntry[]): Promise<void>;
  unregisterAll(): Promise<void>;
  ensureWorldConfigured(): Promise<void>;
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    remove(key: string): Promise<void>;
  };
}

export type Platform = 'chrome' | 'firefox' | 'web';
