document.addEventListener('DOMContentLoaded', async () => {
  await loadContent();
});

function parseRepoInput(input) {
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

async function loadContent() {
  const content = document.getElementById('content');
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });

  if (settings.accessToken && settings.repoOwner && settings.repoName) {
    renderBoundRepo(content, settings);
  } else {
    renderBindForm(content, settings);
  }
}

function renderBindForm(container, settings) {
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

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    const accessToken = document.getElementById('accessToken').value.trim();
    const repoInput = document.getElementById('repoInput').value.trim();

    if (!accessToken || !repoInput) {
      status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('pleaseFillAll')}</div>`;
      return;
    }

    const parsed = parseRepoInput(repoInput);
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
          repoInput,
          repoOwner: parsed.owner,
          repoName: parsed.repo,
          lastSync: new Date().toISOString()
        }
      });

      await chrome.runtime.sendMessage({ action: 'syncScripts' });

      status.innerHTML = `<div class="status success">${chrome.i18n.getMessage('successBound')}</div>`;
      setTimeout(loadContent, 1000);
    } catch (error) {
      status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('error')} ${error.message}</div>`;
    }
  });
}

function renderBoundRepo(container, settings) {
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

  document.getElementById('syncBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerHTML = `<div class="loading">${chrome.i18n.getMessage('syncing')}</div>`;
    
    try {
      await chrome.runtime.sendMessage({ action: 'syncScripts' });
      
      const updatedSettings = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { ...settings, lastSync: new Date().toISOString() }
      });
      
      status.innerHTML = `<div class="status success">${chrome.i18n.getMessage('syncSuccess')}</div>`;
      setTimeout(() => loadContent(), 1000);
    } catch (error) {
      status.innerHTML = `<div class="status error">${chrome.i18n.getMessage('syncFailed')} ${error.message}</div>`;
    }
  });

  document.getElementById('editBtn').addEventListener('click', () => {
    renderBindForm(container, settings);
  });

  document.getElementById('unbindBtn').addEventListener('click', async () => {
    if (confirm(chrome.i18n.getMessage('confirmUnbind'))) {
      await chrome.runtime.sendMessage({ action: 'unbindRepo' });
      loadContent();
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
