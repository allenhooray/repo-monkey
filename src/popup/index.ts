import type { Script } from '../runtime';
import type { Settings } from '../shared/types';
import { escapeHtml } from '../shared/utils/html-escaper';

document.addEventListener('DOMContentLoaded', async () => {
  const settingsBtn = document.getElementById('settingsBtn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  await loadContent();
});

async function loadContent(): Promise<void> {
  const content = document.getElementById('content');
  if (!content) return;

  const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = settingsResponse.settings as Settings;

  if (!settings.accessToken || !settings.repoOwner || !settings.repoName) {
    renderNoRepo(content);
    return;
  }

  const scriptsResponse = await chrome.runtime.sendMessage({ action: 'getScripts' });
  const scripts = scriptsResponse.scripts as Script[];
  renderScripts(content, scripts, settings);
}

function renderNoRepo(container: HTMLElement): void {
  container.innerHTML = `
    <div class="no-repo">
      <p>${chrome.i18n.getMessage('noRepoBound')}</p>
      <button id="openSettingsBtn" class="btn btn-primary">${chrome.i18n.getMessage('bindRepo')}</button>
    </div>
  `;

  const openSettingsBtn = document.getElementById('openSettingsBtn');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

function renderScripts(container: HTMLElement, scripts: Script[], settings: Settings): void {
  const lastSync = settings.lastSync
    ? new Date(settings.lastSync).toLocaleString()
    : chrome.i18n.getMessage('never');

  container.innerHTML = `
    <div class="sync-bar">
      <div class="sync-info">${chrome.i18n.getMessage('lastSync')} ${lastSync}</div>
      <button id="syncBtn" class="btn btn-secondary">${chrome.i18n.getMessage('syncNow')}</button>
    </div>
    <div id="scriptList" class="script-list"></div>
  `;

  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      container.innerHTML = `<div class="loading">${chrome.i18n.getMessage('syncing')}</div>`;
      await chrome.runtime.sendMessage({ action: 'syncScripts' });
      await loadContent();
    });
  }

  const scriptList = document.getElementById('scriptList');
  if (!scriptList) return;

  if (scripts.length === 0) {
    scriptList.innerHTML = `<p style="text-align: center; color: #888;">${chrome.i18n.getMessage('noScriptsFound')}</p>`;
    return;
  }

  scripts.forEach(script => {
    const item = document.createElement('div');
    item.className = 'script-item';
    item.innerHTML = `
      <div class="script-info">
        <div class="script-name">${escapeHtml(script.name)}</div>
        <div class="script-meta">${script.fileName} • ${new Date(script.updatedAt || script.createdAt).toLocaleDateString()}</div>
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
      const scriptId = (e.target as HTMLInputElement).dataset.id;
      if (scriptId) {
        await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId });
      }
    });
  });
}
