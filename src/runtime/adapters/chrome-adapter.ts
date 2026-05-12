import type { RuntimeAdapter } from '../types/adapter';

export class ChromeAdapter implements RuntimeAdapter {
  private tabId?: number;

  constructor(tabId?: number) {
    this.tabId = tabId;
  }

  async injectScript(wrappedCode: string, name: string): Promise<void> {
    let targetTabId = this.tabId;

    if (!targetTabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }
      targetTabId = tab.id;
    }

    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (code: string, scriptName: string) => {
        try {
          const script = document.createElement('script');
          script.setAttribute('data-repo-monkey', scriptName);
          script.textContent = code;
          (document.head || document.documentElement || document.body).appendChild(script);
          script.parentNode?.removeChild(script);
        } catch (error) {
          console.error('[RepoMonkey] Failed to inject script ' + scriptName + ':', error);
        }
      },
      args: [wrappedCode, name],
      world: 'MAIN',
    });
  }

  getCurrentUrl(): string {
    return window.location.href;
  }

  storage = {
    async get(key: string): Promise<any> {
      const result = await chrome.storage.local.get(key);
      return result[key];
    },
    async set(key: string, value: any): Promise<void> {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key: string): Promise<void> {
      await chrome.storage.local.remove(key);
    },
  };
}
