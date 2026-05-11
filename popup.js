document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  const settingsBtn = document.getElementById('settingsBtn');

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  await loadContent();
});

async function loadContent() {
  const content = document.getElementById('content');
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });

  if (!settings.accessToken || !settings.repoOwner || !settings.repoName) {
    renderNoRepo(content);
    return;
  }

  const scripts = await chrome.runtime.sendMessage({ action: 'getScripts' });
  renderScripts(content, scripts, settings);
}

function renderNoRepo(container) {
  container.innerHTML = `
    <div class="no-repo">
      <p>No repository bound yet</p>
      <button id="openSettingsBtn" class="btn btn-primary">Bind Repository</button>
    </div>
  `;

  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function renderScripts(container, scripts, settings) {
  const lastSync = settings.lastSync 
    ? new Date(settings.lastSync).toLocaleString() 
    : 'Never';

  container.innerHTML = `
    <div class="sync-bar">
      <div class="sync-info">Last sync: ${lastSync}</div>
      <button id="syncBtn" class="btn btn-secondary">Sync Now</button>
    </div>
    <div id="scriptList" class="script-list"></div>
  `;

  document.getElementById('syncBtn').addEventListener('click', async () => {
    container.innerHTML = '<div class="loading">Syncing...</div>';
    await chrome.runtime.sendMessage({ action: 'syncScripts' });
    await loadContent();
  });

  const scriptList = document.getElementById('scriptList');
  if (scripts.length === 0) {
    scriptList.innerHTML = '<p style="text-align: center; color: #888;">No scripts found</p>';
    return;
  }

  scripts.forEach(script => {
    const item = document.createElement('div');
    item.className = 'script-item';
    item.innerHTML = `
      <div class="script-info">
        <div class="script-name">${escapeHtml(script.name)}</div>
        <div class="script-meta">${script.fileName} • ${new Date(script.updatedAt).toLocaleDateString()}</div>
      </div>
      <label class="switch">
        <input type="checkbox" ${script.enabled ? 'checked' : ''} data-id="${script.id}">
        <span class="slider"></span>
      </label>
    `;
    scriptList.appendChild(item);
  });

  document.querySelectorAll('.switch input').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const scriptId = e.target.dataset.id;
      await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId });
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
