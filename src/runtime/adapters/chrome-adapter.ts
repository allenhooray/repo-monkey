import type { RuntimeAdapter, RegisteredUserScriptEntry } from '../types/adapter';

const USER_SCRIPT_ID_PREFIX = 'repo-monkey-';

/**
 * 转换脚本 ID 为 Chrome 脚本 ID
 */
function toUserScriptId(scriptId: string): string {
  return `${USER_SCRIPT_ID_PREFIX}${scriptId}`;
}

/**
 * 检查 Chrome UserScripts API 是否可用
 */
function isUserScriptsAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.userScripts;
}

/**
 * Chrome 浏览器适配器 - 实现浏览器特定的功能
 */
export class ChromeAdapter implements RuntimeAdapter {
  /**
   * 确保 UserScript 环境已配置
   */
  async ensureWorldConfigured(): Promise<void> {
    if (!isUserScriptsAvailable()) return;
    try {
      await chrome.userScripts.configureWorld({ messaging: true });
    } catch (error) {
      console.warn('[RepoMonkey] configureWorld failed:', error);
    }
  }

  /**
   * 注册用户脚本
   */
  async registerScripts(entries: RegisteredUserScriptEntry[]): Promise<void> {
    if (!isUserScriptsAvailable()) {
      throw new Error('chrome.userScripts API not available. Enable "Allow User Scripts" in extension details.');
    }

    await this.ensureWorldConfigured();

    // 先清除旧的脚本注册
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

    // 注册新脚本
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

  /**
   * 取消注册所有脚本
   */
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

  /**
   * 存储适配器
   */
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
