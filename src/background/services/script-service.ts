import { ScriptManager, MetadataParser, ChromeAdapter } from '../../runtime';
import { STORAGE_KEY_SCRIPTS } from '../../shared/constants';
import type { Script } from '../../runtime';

const adapter = new ChromeAdapter();
const scriptManager = new ScriptManager(adapter);

export async function getScripts(): Promise<Script[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SCRIPTS);
  return (result[STORAGE_KEY_SCRIPTS] as Script[]) || [];
}

export async function saveScripts(scripts: Script[]): Promise<void> {
  const existingScripts = await getScripts();
  const existingMap = new Map(existingScripts.map(s => [s.id, s]));

  const mergedScripts = scripts.map(script => ({
    ...script,
    enabled: existingMap.has(script.id) ? existingMap.get(script.id)!.enabled : true,
  }));

  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: mergedScripts });
}

export async function toggleScript(scriptId: string): Promise<Script[]> {
  const scripts = await getScripts();
  const updatedScripts = scripts.map(script =>
    script.id === scriptId ? { ...script, enabled: !script.enabled } : script
  );
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}

export async function parseScriptFromFile(content: string, file: any): Promise<Script> {
  const metadataParser = new MetadataParser();
  const metadata = metadataParser.parse(content);

  return {
    id: file.sha,
    name: metadata.name || file.name.replace('.js', ''),
    metadata,
    content,
    fileName: file.name,
    sha: file.sha,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
