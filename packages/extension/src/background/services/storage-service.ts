import type { Settings, MessageResponse } from '../../shared/types';
import { STORAGE_KEY_SCRIPTS, STORAGE_KEY_SETTINGS } from '../../shared/constants';
import { parseRepoInput } from '../../shared/utils/repo-parser';

/**
 * 获取设置
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return (result[STORAGE_KEY_SETTINGS] as Settings) || {
    accessToken: '',
    repoInput: '',
    repoOwner: '',
    repoName: '',
    lastSync: null,
  };
}

/**
 * 保存设置
 */
export async function saveSettings(settings: Settings): Promise<Settings> {
  if (settings.repoInput) {
    const parsed = parseRepoInput(settings.repoInput);
    if (parsed) {
      settings.repoOwner = parsed.owner;
      settings.repoName = parsed.repo;
    }
  }
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
  return settings;
}

/**
 * 解绑仓库
 */
export async function unbindRepo(): Promise<MessageResponse> {
  await chrome.storage.local.remove([STORAGE_KEY_SETTINGS, STORAGE_KEY_SCRIPTS]);
  return { success: true };
}
