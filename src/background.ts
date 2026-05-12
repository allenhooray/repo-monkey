import type { RepoInfo, Script, Settings, GitHubFile, MessageRequest, MessageResponse } from './types';

const SYNC_ALARM_NAME = 'repo-monkey-sync';
const SYNC_INTERVAL_MINUTES = 30;

function parseRepoInput(input: string): RepoInfo | null {
  if (!input) return null;

  const trimmed = input.trim();

  const ownerRepoMatch = trimmed.match(/^([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)$/);
  if (ownerRepoMatch) {
    return {
      owner: ownerRepoMatch[1],
      repo: ownerRepoMatch[2]
    };
  }

  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)(?:\.git)?\/?$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  const sshMatch = trimmed.match(/^git@github\.com:([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)(?:\.git)?\/?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2]
    };
  }

  return null;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  console.log('RepoMonkey installed');
});

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    syncScripts();
  }
});

chrome.runtime.onMessage.addListener((request: MessageRequest, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
  switch (request.action) {
    case 'syncScripts':
      syncScripts().then(() => sendResponse({ success: true }));
      return true;
    case 'getScripts':
      getScripts().then(scripts => sendResponse({ scripts }));
      return true;
    case 'toggleScript':
      if (request.scriptId) {
        toggleScript(request.scriptId).then(scripts => sendResponse({ scripts }));
      }
      return true;
    case 'getSettings':
      getSettings().then(settings => sendResponse({ settings }));
      return true;
    case 'saveSettings':
      if (request.settings) {
        saveSettings(request.settings).then(settings => sendResponse({ settings }));
      }
      return true;
    case 'unbindRepo':
      unbindRepo().then(response => sendResponse(response));
      return true;
    case 'executeScripts':
      if (request.url) {
        executeScripts(request.url).then(scripts => sendResponse({ scripts }));
      }
      return true;
    case 'injectScript':
      if (request.script && sender.tab?.id) {
        injectScript(request.script, sender.tab.id).then(response => sendResponse(response));
      }
      return true;
  }
});

async function syncScripts(): Promise<void> {
  const settings = await getSettings();
  if (!settings.accessToken || !settings.repoOwner || !settings.repoName) {
    console.log('No repo bound, skipping sync');
    return;
  }

  try {
    const scripts = await fetchScriptsFromRepo(settings);
    await saveScripts(scripts);
    console.log('Scripts synced successfully');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

async function fetchScriptsFromRepo(settings: Settings): Promise<Script[]> {
  const headers = {
    'Authorization': `Bearer ${settings.accessToken}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  let files: GitHubFile[] = [];
  try {
    const outputResponse = await fetch(`https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/output`, { headers });
    if (outputResponse.ok) {
      files = await outputResponse.json() as GitHubFile[];
    }
    if (files.length === 0) {
      throw new Error('No files found in output directory');
    }
  } catch (e) {
    const rootResponse = await fetch(`https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/`, { headers });
    if (rootResponse.ok) {
      const allFiles = await rootResponse.json() as GitHubFile[];
      files = allFiles.filter(file => file.name.endsWith('.js'));
    }
  }

  const scripts: Script[] = [];
  for (const file of files) {
    if (file.name.endsWith('.js') && file.type === 'file') {
      const contentResponse = await fetch(file.download_url);
      const content = await contentResponse.text();
      const scriptInfo = parseScriptInfo(content, file);
      scripts.push(scriptInfo);
    }
  }

  return scripts;
}

function parseScriptInfo(content: string, file: GitHubFile): Script {
  let name = file.name.replace('.js', '');
  const nameMatch = content.match(/@name\s+(.+)/);
  if (nameMatch) {
    name = nameMatch[1].trim();
  }

  let match = '*://*/*';
  const matchMatch = content.match(/@match\s+(.+)/);
  if (matchMatch) {
    match = matchMatch[1].trim();
  }

  return {
    id: file.sha,
    name,
    match,
    content,
    fileName: file.name,
    sha: file.sha,
    updatedAt: new Date().toISOString(),
    enabled: true
  };
}

async function getScripts(): Promise<Script[]> {
  const result = await chrome.storage.local.get('scripts');
  return (result.scripts as Script[]) || [];
}

async function saveScripts(scripts: Script[]): Promise<void> {
  const existingScripts = await getScripts();
  const existingMap = new Map(existingScripts.map(s => [s.id, s]));

  const mergedScripts = scripts.map(script => ({
    ...script,
    enabled: existingMap.has(script.id) ? existingMap.get(script.id)!.enabled : true
  }));

  await chrome.storage.local.set({ scripts: mergedScripts });
}

async function toggleScript(scriptId: string): Promise<Script[]> {
  const scripts = await getScripts();
  const updatedScripts = scripts.map(script => 
    script.id === scriptId ? { ...script, enabled: !script.enabled } : script
  );
  await chrome.storage.local.set({ scripts: updatedScripts });
  return updatedScripts;
}

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return (result.settings as Settings) || {
    accessToken: '',
    repoInput: '',
    repoOwner: '',
    repoName: '',
    lastSync: null
  };
}

async function saveSettings(settings: Settings): Promise<Settings> {
  if (settings.repoInput) {
    const parsed = parseRepoInput(settings.repoInput);
    if (parsed) {
      settings.repoOwner = parsed.owner;
      settings.repoName = parsed.repo;
    }
  }
  await chrome.storage.local.set({ settings });
  return settings;
}

async function unbindRepo(): Promise<MessageResponse> {
  await chrome.storage.local.remove(['settings', 'scripts']);
  return { success: true };
}

async function executeScripts(url: string): Promise<Script[]> {
  const scripts = await getScripts();
  const enabledScripts = scripts.filter(script => {
    if (!script.enabled) return false;
    return matchUrl(script.match, url);
  });
  return enabledScripts;
}

function matchUrl(pattern: string, url: string): boolean {
  if (pattern === '<all_urls>' || pattern === '*://*/*') return true;
  
  const patternRegex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${patternRegex}$`).test(url);
}

async function injectScript(script: Script, tabId: number): Promise<MessageResponse> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (scriptContent: string, scriptName: string) => {
        try {
          eval(scriptContent);
        } catch (error) {
          console.error(`Error executing script ${scriptName}:`, error);
        }
      },
      args: [script.content, script.name],
      world: 'MAIN'
    });
    return { success: true };
  } catch (error) {
    console.error(`Failed to inject script ${script.name}:`, error);
    return { success: false, error: (error as Error).message };
  }
}
