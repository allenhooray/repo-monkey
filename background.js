const SYNC_ALARM_NAME = 'repo-monkey-sync';
const SYNC_INTERVAL_MINUTES = 30;

function parseRepoInput(input) {
  if (!input) return null;

  const trimmed = input.trim();

  // 格式 1: owner/repo
  const ownerRepoMatch = trimmed.match(/^([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)$/);
  if (ownerRepoMatch) {
    return {
      owner: ownerRepoMatch[1],
      repo: ownerRepoMatch[2]
    };
  }

  // 格式 2: HTTPS 链接
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)(?:\.git)?\/?$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  // 格式 3: SSH 链接
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    syncScripts();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'syncScripts':
      syncScripts().then(() => sendResponse({ success: true }));
      return true;
    case 'getScripts':
      getScripts().then(sendResponse);
      return true;
    case 'toggleScript':
      toggleScript(request.scriptId).then(sendResponse);
      return true;
    case 'getSettings':
      getSettings().then(sendResponse);
      return true;
    case 'saveSettings':
      saveSettings(request.settings).then(sendResponse);
      return true;
    case 'unbindRepo':
      unbindRepo().then(sendResponse);
      return true;
    case 'executeScripts':
      executeScripts(request.url).then(sendResponse);
      return true;
  }
});

async function syncScripts() {
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

async function fetchScriptsFromRepo(settings) {
  const headers = {
    'Authorization': `Bearer ${settings.accessToken}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  let files = [];
  try {
    const outputResponse = await fetch(`https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/output`, { headers });
    if (outputResponse.ok) {
      files = await outputResponse.json();
    }
    if (files.length === 0) {
      throw new Error('No files found in output directory');
    }
  } catch (e) {
    const rootResponse = await fetch(`https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/`, { headers });
    if (rootResponse.ok) {
      const allFiles = await rootResponse.json();
      files = allFiles.filter(file => file.name.endsWith('.js'));
    }
  }

  const scripts = [];
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

function parseScriptInfo(content, file) {
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

async function getScripts() {
  const result = await chrome.storage.local.get('scripts');
  return result.scripts || [];
}

async function saveScripts(scripts) {
  const existingScripts = await getScripts();
  const existingMap = new Map(existingScripts.map(s => [s.id, s]));

  const mergedScripts = scripts.map(script => ({
    ...script,
    enabled: existingMap.has(script.id) ? existingMap.get(script.id).enabled : true
  }));

  await chrome.storage.local.set({ scripts: mergedScripts });
}

async function toggleScript(scriptId) {
  const scripts = await getScripts();
  const updatedScripts = scripts.map(script => 
    script.id === scriptId ? { ...script, enabled: !script.enabled } : script
  );
  await chrome.storage.local.set({ scripts: updatedScripts });
  return updatedScripts;
}

async function getSettings() {
  const result = await chrome.storage.local.get('settings');
  return result.settings || {
    accessToken: '',
    repoInput: '',
    repoOwner: '',
    repoName: '',
    lastSync: null
  };
}

async function saveSettings(settings) {
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

async function unbindRepo() {
  await chrome.storage.local.remove(['settings', 'scripts']);
  return { success: true };
}

async function executeScripts(url) {
  const scripts = await getScripts();
  const enabledScripts = scripts.filter(script => {
    if (!script.enabled) return false;
    return matchUrl(script.match, url);
  });
  return enabledScripts;
}

function matchUrl(pattern, url) {
  if (pattern === '<all_urls>' || pattern === '*://*/*') return true;
  
  const patternRegex = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\./g, '\\.');
  
  return new RegExp(`^${patternRegex}$`).test(url);
}
