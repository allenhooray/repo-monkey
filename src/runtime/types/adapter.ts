export interface RuntimeAdapter {
  injectScript(content: string, name: string): Promise<void>;
  getCurrentUrl(): string;
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    remove(key: string): Promise<void>;
  };
}

export type Platform = 'chrome' | 'firefox' | 'web';
