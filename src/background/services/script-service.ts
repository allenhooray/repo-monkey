import { MetadataParser } from '../../runtime';
import { STORAGE_KEY_SCRIPTS, ScriptSource } from '../../shared/constants';
import type { Script } from '../../runtime';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function getScripts(): Promise<Script[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SCRIPTS);
  return (result[STORAGE_KEY_SCRIPTS] as Script[]) || [];
}

export async function saveScripts(remoteScripts: Script[]): Promise<void> {
  const existingScripts = await getScripts();
  
  const existingById = new Map(existingScripts.map(s => [s.id, s]));
  const existingByRemotePath = new Map(
    existingScripts
      .filter(s => s.remotePath)
      .map(s => [s.remotePath!, s])
  );
  
  const mergedScripts: Script[] = [];
  const processedRemotePaths = new Set<string>();
  
  for (const remoteScript of remoteScripts) {
    const remotePath = remoteScript.remotePath || remoteScript.fileName;
    processedRemotePaths.add(remotePath);
    
    const existingByPath = existingByRemotePath.get(remotePath);
    
    if (existingByPath) {
      if (existingByPath.source === ScriptSource.LOCAL || existingByPath.dirty) {
        if (remoteScript.remoteSha && existingByPath.remoteSha !== remoteScript.remoteSha) {
          mergedScripts.push({ ...existingByPath, conflict: true });
        } else {
          mergedScripts.push(existingByPath);
        }
      } else {
        mergedScripts.push({
          ...remoteScript,
          id: existingByPath.id,
          enabled: existingByPath.enabled,
          source: ScriptSource.REMOTE,
          dirty: false,
          conflict: false,
          orphan: false,
          lastPushedAt: existingByPath.lastPushedAt,
          remotePath,
        });
      }
    } else {
      mergedScripts.push({
        ...remoteScript,
        id: generateUUID(),
        source: ScriptSource.REMOTE,
        dirty: false,
        conflict: false,
        orphan: false,
        remotePath,
      });
    }
  }
  
  for (const existingScript of existingScripts) {
    if (existingScript.source === ScriptSource.LOCAL || existingScript.dirty) {
      if (!mergedScripts.some(s => s.id === existingScript.id)) {
        mergedScripts.push(existingScript);
      }
    } else if (existingScript.remotePath && !processedRemotePaths.has(existingScript.remotePath)) {
      mergedScripts.push({ ...existingScript, orphan: true });
    }
  }
  
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

export async function createScript(script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>): Promise<Script[]> {
  const scripts = await getScripts();
  const metadataParser = new MetadataParser();
  const metadata = metadataParser.parse(script.content);
  
  const newScript: Script = {
    ...script,
    id: generateUUID(),
    name: metadata.name || script.fileName.replace('.js', ''),
    metadata,
    source: ScriptSource.LOCAL,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dirty: false,
  };
  
  const updatedScripts = [...scripts, newScript];
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}

export async function updateScript(script: Script): Promise<Script[]> {
  const scripts = await getScripts();
  const metadataParser = new MetadataParser();
  const metadata = metadataParser.parse(script.content);
  
  const existingScript = scripts.find(s => s.id === script.id);
  let updatedSource = script.source;
  let updatedDirty = script.dirty;
  
  if (existingScript && existingScript.source === ScriptSource.REMOTE) {
    updatedSource = ScriptSource.MODIFIED;
    updatedDirty = true;
  }
  
  const updatedScripts = scripts.map(s => {
    if (s.id === script.id) {
      return {
        ...s,
        ...script,
        name: metadata.name || script.fileName.replace('.js', ''),
        metadata,
        source: updatedSource,
        dirty: updatedDirty,
        updatedAt: new Date().toISOString(),
      };
    }
    return s;
  });
  
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}

export async function deleteScript(scriptId: string): Promise<Script[]> {
  const scripts = await getScripts();
  const updatedScripts = scripts.filter(s => s.id !== scriptId);
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}

export async function parseScriptFromFile(content: string, file: any): Promise<Script> {
  const metadataParser = new MetadataParser();
  const metadata = metadataParser.parse(content);

  return {
    id: generateUUID(),
    name: metadata.name || file.name.replace('.js', ''),
    metadata,
    content,
    fileName: file.name,
    sha: file.sha,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: ScriptSource.REMOTE,
    remoteSha: file.sha,
    remotePath: file.path || file.name,
    dirty: false,
  };
}

export async function migrateScriptsIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEY_SCRIPTS, 'dataVersion']);
  const currentVersion = (result.dataVersion as number) || 0;
  
  if (currentVersion >= 1) {
    return;
  }
  
  const oldScripts = (result[STORAGE_KEY_SCRIPTS] as any[]) || [];
  
  const migratedScripts: Script[] = oldScripts.map(oldScript => {
    let id = oldScript.id;
    if (!isValidUUID(id)) {
      id = generateUUID();
    }
    
    return {
      ...oldScript,
      id,
      source: ScriptSource.REMOTE,
      remoteSha: oldScript.sha || oldScript.remoteSha,
      remotePath: oldScript.fileName,
      dirty: false,
      orphan: false,
      conflict: false,
    };
  });
  
  await chrome.storage.local.set({
    [STORAGE_KEY_SCRIPTS]: migratedScripts,
    dataVersion: 1,
  });
  
  console.log(`[RepoMonkey] Migrated ${migratedScripts.length} scripts to data version 1`);
}

export async function pullScript(scriptId: string, remoteContent: string, remoteSha: string): Promise<Script[]> {
  const scripts = await getScripts();
  const metadataParser = new MetadataParser();
  const metadata = metadataParser.parse(remoteContent);
  
  const updatedScripts = scripts.map(script => {
    if (script.id === scriptId) {
      return {
        ...script,
        content: remoteContent,
        remoteSha,
        name: metadata.name || script.fileName.replace('.js', ''),
        metadata,
        source: ScriptSource.REMOTE,
        dirty: false,
        conflict: false,
        updatedAt: new Date().toISOString(),
      };
    }
    return script;
  });
  
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}
