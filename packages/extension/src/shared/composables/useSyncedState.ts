import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { STORAGE_KEY_SETTINGS, STORAGE_KEY_SCRIPTS } from '../constants';
import type { Settings } from '../types';
import type { Script } from '../../runtime';

export function useSyncedSettings(): { settings: Ref<Settings | null>; load: () => Promise<void> } {
  const settings = ref<Settings | null>(null);

  const load = async (): Promise<void> => {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    settings.value = response.settings;
  };

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
    if (areaName === 'local' && changes[STORAGE_KEY_SETTINGS]) {
      load();
    }
  };

  onMounted(() => {
    load();
    chrome.storage.onChanged.addListener(handleStorageChange);
  });

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
  });

  return { settings, load };
}

export function useSyncedScripts(): { scripts: Ref<Script[]>; load: () => Promise<void> } {
  const scripts = ref<Script[]>([]);

  const load = async (): Promise<void> => {
    const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
    scripts.value = (response.scripts as Script[] | undefined) || [];
  };

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
    if (areaName === 'local' && changes[STORAGE_KEY_SCRIPTS]) {
      load();
    }
  };

  onMounted(() => {
    load();
    chrome.storage.onChanged.addListener(handleStorageChange);
  });

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
  });

  return { scripts, load };
}
