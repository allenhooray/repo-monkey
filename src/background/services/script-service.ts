import { MetadataParser } from '../../runtime';
import { STORAGE_KEY_SCRIPTS, ScriptSource } from '../../shared/constants';
import { generateUUID, isValidUUID } from '../../shared/utils/uuid';
import type { Script } from '../../runtime';

/**
 * 获取所有脚本
 * @returns 脚本数组
 */
export async function getScripts(): Promise<Script[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SCRIPTS);
  return (result[STORAGE_KEY_SCRIPTS] as Script[]) || [];
}

/**
 * 保存远程脚本并合并本地修改
 * @param remoteScripts - 远程脚本数组
 */
export async function saveScripts(remoteScripts: Script[]): Promise<void> {
  const existingScripts = await getScripts();
  
  // 构建索引便于查找
  const existingById = new Map(existingScripts.map(s => [s.id, s]));
  const existingByRemotePath = new Map(
    existingScripts
      .filter(s => s.remotePath)
      .map(s => [s.remotePath!, s])
  );
  
  const mergedScripts: Script[] = [];
  const processedRemotePaths = new Set<string>();
  
  // 处理远程脚本
  for (const remoteScript of remoteScripts) {
    const remotePath = remoteScript.remotePath || remoteScript.fileName;
    processedRemotePaths.add(remotePath);
    
    const existingByPath = existingByRemotePath.get(remotePath);
    
    if (existingByPath) {
      // 如果本地有修改或脏标记，检查是否冲突
      if (existingByPath.source === ScriptSource.LOCAL || existingByPath.dirty) {
        if (remoteScript.remoteSha && existingByPath.remoteSha !== remoteScript.remoteSha) {
          mergedScripts.push({ ...existingByPath, conflict: true });
        } else {
          mergedScripts.push(existingByPath);
        }
      } else {
        // 更新远程脚本
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
      // 新增远程脚本
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
  
  // 处理本地修改或未在远程的脚本
  for (const existingScript of existingScripts) {
    if (existingScript.source === ScriptSource.LOCAL || existingScript.dirty) {
      if (!mergedScripts.some(s => s.id === existingScript.id)) {
        mergedScripts.push(existingScript);
      }
    } else if (existingScript.remotePath && !processedRemotePaths.has(existingScript.remotePath)) {
      // 标记为孤儿脚本
      mergedScripts.push({ ...existingScript, orphan: true });
    }
  }
  
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: mergedScripts });
}

/**
 * 切换脚本启用状态
 * @param scriptId - 脚本 ID
 * @returns 更新后的脚本数组
 */
export async function toggleScript(scriptId: string): Promise<Script[]> {
  const scripts = await getScripts();
  const updatedScripts = scripts.map(script =>
    script.id === scriptId ? { ...script, enabled: !script.enabled } : script
  );
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}

/**
 * 创建新脚本
 * @param script - 脚本信息（不含 id 和时间）
 * @returns 更新后的脚本数组
 */
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

/**
 * 更新脚本
 * @param script - 脚本信息
 * @returns 更新后的脚本数组
 */
export async function updateScript(script: Script): Promise<Script[]> {
  const scripts = await getScripts();
  const metadataParser = new MetadataParser();
  const metadata = metadataParser.parse(script.content);
  
  const existingScript = scripts.find(s => s.id === script.id);
  let updatedSource = script.source;
  let updatedDirty = script.dirty;
  
  // 如果原来是远程脚本，现在修改了，标记为已修改
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

/**
 * 删除脚本
 * @param scriptId - 脚本 ID
 * @returns 更新后的脚本数组
 */
export async function deleteScript(scriptId: string): Promise<Script[]> {
  const scripts = await getScripts();
  const updatedScripts = scripts.filter(s => s.id !== scriptId);
  await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
  return updatedScripts;
}

/**
 * 从文件解析脚本
 * @param content - 脚本内容
 * @param file - 文件信息
 * @returns 脚本对象
 */
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

/**
 * 数据迁移（如果需要）
 */
export async function migrateScriptsIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEY_SCRIPTS, 'dataVersion']);
  const currentVersion = (result.dataVersion as number) || 0;
  
  // 已经是最新版本
  if (currentVersion >= 1) {
    return;
  }
  
  const oldScripts = (result[STORAGE_KEY_SCRIPTS] as any[]) || [];
  
  const migratedScripts: Script[] = oldScripts.map(oldScript => {
    let id = oldScript.id;
    // 确保 ID 是 UUID
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

/**
 * 拉取远程脚本更新
 * @param scriptId - 脚本 ID
 * @param remoteContent - 远程内容
 * @param remoteSha - 远程 SHA
 * @returns 更新后的脚本数组
 */
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
