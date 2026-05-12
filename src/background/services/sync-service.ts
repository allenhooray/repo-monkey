import { getSettings, saveSettings } from './storage-service';
import { saveScripts, parseScriptFromFile } from './script-service';
import { fetchFilesFromRepo, fetchFileContent } from './github-service';
import type { Script } from '../../runtime';

export async function syncScripts(): Promise<void> {
  const settings = await getSettings();
  if (!settings.accessToken || !settings.repoOwner || !settings.repoName) {
    console.log('No repo bound, skipping sync');
    return;
  }

  try {
    const files = await fetchFilesFromRepo(settings);
    const scripts: Script[] = [];

    for (const file of files) {
      if (file.name.endsWith('.js') && file.type === 'file') {
        const content = await fetchFileContent(file.download_url);
        const script = await parseScriptFromFile(content, file);
        scripts.push(script);
      }
    }

    await saveScripts(scripts);
    
    settings.lastSync = new Date().toISOString();
    await saveSettings(settings);
    
    console.log('Scripts synced successfully');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
