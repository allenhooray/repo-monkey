import { getSettings, saveSettings } from './storage-service';
import { saveScripts, parseScriptFromFile } from './script-service';
import { fetchFilesFromRepo, fetchFileContent } from './github-service';
import type { Script } from '../../runtime';
import { ScriptSource } from '../../shared/constants';

/**
 * 同步脚本
 */
export async function syncScripts(): Promise<void> {
  const settings = await getSettings();
  if (!settings.accessToken || !settings.repoOwner || !settings.repoName) {
    console.log('No repo bound, skipping sync');
    return;
  }

  try {
    const files = await fetchFilesFromRepo(settings);
    const remoteScripts: Script[] = [];

    // 遍历文件，解析脚本
    for (const file of files) {
      if (file.name.endsWith('.js') && file.type === 'file') {
        const content = await fetchFileContent(file.download_url);
        const script = await parseScriptFromFile(content, file);
        remoteScripts.push({
          ...script,
          remoteSha: file.sha,
          remotePath: file.path || file.name,
        });
      }
    }

    await saveScripts(remoteScripts);
    
    settings.lastSync = new Date().toISOString();
    await saveSettings(settings);
    
    console.log('Scripts synced successfully');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
