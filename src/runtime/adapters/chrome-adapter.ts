import type { RuntimeAdapter, RegisteredUserScriptEntry } from '../types/adapter';

const USER_SCRIPT_ID_PREFIX = 'repo-monkey-';

function toUserScriptId(scriptId: string): string {
  return `${USER_SCRIPT_ID_PREFIX}${scriptId}`;
}

function isUserScriptsAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.userScripts;
}

export class ChromeAdapter implements RuntimeAdapter {
  async ensureWorldConfigured(): Promise<void> {
    if (!isUserScriptsAvailable()) return;
    try {
      await chrome.userScripts.configureWorld({ messaging: true });
    } catch (error) {
      console.warn('[RepoMonkey] configureWorld failed:', error);
    }
  }

  async registerScripts(entries: RegisteredUserScriptEntry[]): Promise<void> {
    if (!isUserScriptsAvailable()) {
      throw new Error('chrome.userScripts API not available. Enable "Allow User Scripts" in extension details.');
    }

    await this.ensureWorldConfigured();

    const existing = await chrome.userScripts.getScripts();
    const existingIds = new Set(
      existing
        .map((s) => s.id)
        .filter((id) => id.startsWith(USER_SCRIPT_ID_PREFIX)),
    );
    if (existingIds.size > 0) {
      await chrome.userScripts.unregister({ ids: Array.from(existingIds) });
    }

    if (entries.length === 0) return;

    const registrations = entries.map((entry) => ({
      id: toUserScriptId(entry.scriptId),
      matches: entry.matches,
      js: [{ code: entry.code }],
      runAt: entry.runAt,
      world: 'USER_SCRIPT' as const,
      allFrames: false,
    }));

    await chrome.userScripts.register(registrations);
  }

  async unregisterAll(): Promise<void> {
    if (!isUserScriptsAvailable()) return;
    try {
      const existing = await chrome.userScripts.getScripts();
      const ids = existing
        .map((s) => s.id)
        .filter((id) => id.startsWith(USER_SCRIPT_ID_PREFIX));
      if (ids.length > 0) {
        await chrome.userScripts.unregister({ ids });
      }
    } catch (error) {
      console.warn('[RepoMonkey] unregisterAll failed:', error);
    }
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
