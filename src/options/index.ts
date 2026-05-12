import type { Settings } from '../shared/types';
import { parseRepoInput } from '../shared/utils/repo-parser';
import { escapeHtml } from '../shared/utils/html-escaper';

document.addEventListener('DOMContentLoaded', async () => {
  await loadContent();
});

async function loadContent(): Promise<void> {
  const content = document.getElementById('content');
  if (!content) return;

  const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const settings = settingsResponse.settings as Settings;

  if (settings.accessToken && settings.repoOwner && settings.repoName) {
    renderBoundRepo(content, settings);
  } else {
    renderBindForm(content, settings);
  }
}

function renderBindForm(container: HTMLElement, settings: Settings): void {
  const repoInput = settings.repoInput ||
    (settings.repoOwner && settings.repoName ? `${settings.repoOwner}/${settings.repoName}` : '');

  container.innerHTML = `
    <div class="card">
      <h2>${chrome.i18n.getMessage('bindGitHubRepo')}</h2>
      <div class="form-group">
        <label for="accessToken">${chrome.i18n.getMessage('personalAccessToken')}</label>
        <input type="password" id="accessToken" placeholder="${chrome.i18n.getMessage('accessTokenPlaceholder')}" value="${escapeHtml(settings.accessToken)}">
        <small style="color: #888; font-size: 12px; margin-top: 8px; display: block;">
          ${chrome.i18n.getMessage('createTokenDesc')} <strong>${chrome.i18n.getMessage('repoScope')}</strong> ${chrome.i18n.getMessage('scopeAt')}
          <a href="https://github.com/settings/tokens/new" target="_blank" style="color: #2ecc71;">${chrome.i18n.getMessage('githubSettings')}</a>
        </small>
      </div>
      <div class="form-group">
        <label for="repoInput">${chrome.i18n.getMessage('repository')}</label>
        <input type="text" id="repoInput" placeholder="${chrome.i18n.getMessage('repoInputPlaceholder')}" value="${escapeHtml(repoInput)}">
        <small style="color: #888; font-size: 12px; margin-top: 8px; display: block;">
          ${chrome.i18n.getMessage('supportFormats')} <code>owner/repo</code>, <code>https://github.com/owner/repo</code>, or <code>git@github.com:owner/repo.git</code>
        </small>
      </div>
      <div class="btn-group">
        <button id="saveBtn" class="btn btn-primary">${chrome.i18n.getMessage('saveSync')}</button>
      </div>
      <div id="status"></div>
    </div>
  `;

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const status = document.getElementById('status');
      const accessTokenInput = document.getElementById('accessToken') as HTMLInputElement;
      const repoInputElement = document.getElementById('repoInput') as HTMLInputElement;

      if (!status || !accessTokenInput || !repoInputElement) return;

      const accessToken = accessTokenInput.value.trim();
      const repoInputValue = repoInputElement.value.trim();

      if (!accessToken || !repoInputValue) {
        status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('pleaseFillAll')}</div>`;
        return;
      }

      const parsed = parseRepoInput(repoInputValue);
      if (!parsed) {
        status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('invalidRepoFormat')}</div>`;
        return;
      }

      status.innerHTML = `<div class="loading">${chrome.i18n.getMessage('savingSyncing')}</div>`;

      try {
        await chrome.runtime.sendMessage({
          action: 'saveSettings',
          settings: {
            accessToken,
            repoInput: repoInputValue,
            repoOwner: parsed.owner,
            repoName: parsed.repo,
            lastSync: new Date().toISOString(),
          },
        });

        await chrome.runtime.sendMessage({ action: 'syncScripts' });

        status.innerHTML = `<div class="status success">${chrome.i18n.getMessage('successBound')}</div>`;
        setTimeout(loadContent, 1000);
      } catch (error) {
        status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('error')} ${(error as Error).message}</div>`;
      }
    });
  }
}

function renderBoundRepo(container: HTMLElement, settings: Settings): void {
  const repoUrl = `https://github.com/${settings.repoOwner}/${settings.repoName}`;
  const lastSync = settings.lastSync
    ? new Date(settings.lastSync).toLocaleString()
    : chrome.i18n.getMessage('never');

  container.innerHTML = `
    <div class="card">
      <h2>${chrome.i18n.getMessage('boundRepository')}</h2>
      <div class="repo-info">
        <div>
          <div class="repo-name">${escapeHtml(settings.repoOwner)}/${escapeHtml(settings.repoName)}</div>
          <div style="font-size: 12px; color: #888; margin-top: 4px;">${chrome.i18n.getMessage('lastSync')} ${lastSync}</div>
        </div>
        <a href="${repoUrl}" target="_blank" class="repo-link">${chrome.i18n.getMessage('viewOnGitHub')}</a>
      </div>
      <div class="btn-group">
        <button id="syncBtn" class="btn btn-primary">${chrome.i18n.getMessage('syncNow')}</button>
        <button id="editBtn" class="btn btn-secondary">${chrome.i18n.getMessage('editSettings')}</button>
        <button id="unbindBtn" class="btn btn-danger">${chrome.i18n.getMessage('unbind')}</button>
      </div>
      <div id="status"></div>
    </div>
  `;

  const syncBtn = document.getElementById('syncBtn');
  const editBtn = document.getElementById('editBtn');
  const unbindBtn = document.getElementById('unbindBtn');

  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      const status = document.getElementById('status');
      if (!status) return;

      status.innerHTML = `<div class="loading">${chrome.i18n.getMessage('syncing')}</div>`;

      try {
        await chrome.runtime.sendMessage({ action: 'syncScripts' });

        const updatedSettingsResponse = await chrome.runtime.sendMessage({
          action: 'saveSettings',
          settings: { ...settings, lastSync: new Date().toISOString() },
        });

        status.innerHTML = `<div class="status success">${chrome.i18n.getMessage('syncSuccess')}</div>`;
        setTimeout(() => loadContent(), 1000);
      } catch (error) {
        status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('syncFailed')} ${(error as Error).message}</div>`;
      }
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      renderBindForm(container, settings);
    });
  }

  if (unbindBtn) {
    unbindBtn.addEventListener('click', async () => {
      if (confirm(chrome.i18n.getMessage('confirmUnbind'))) {
        await chrome.runtime.sendMessage({ action: 'unbindRepo' });
        loadContent();
      }
    });
  }
}
