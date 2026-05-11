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
      <h2>Bind GitHub Repository</h2>
      <div class="form-group">
        <label for="accessToken">Personal Access Token</label>
        <input type="password" id="accessToken" placeholder="ghp_xxxxxxxxxxxx" value="${escapeHtml(settings.accessToken)}">
        <small style="color: #888; font-size: 12px; margin-top: 8px; display: block;">
          Create a token with <strong>repo</strong> scope at 
          <a href="https://github.com/settings/tokens/new" target="_blank" style="color: #2ecc71;">GitHub Settings</a>
        </small>
      </div>
      <div class="form-group">
        <label for="repoInput">Repository</label>
        <input type="text" id="repoInput" placeholder="owner/repo or https://github.com/owner/repo or git@github.com:owner/repo.git" value="${escapeHtml(repoInput)}">
        <small style="color: #888; font-size: 12px; margin-top: 8px; display: block;">
          Support: <code>owner/repo</code>, <code>https://github.com/owner/repo</code>, or <code>git@github.com:owner/repo.git</code>
        </small>
      </div>
      <div class="btn-group">
        <button id="saveBtn" class="btn btn-primary">Save & Sync</button>
      </div>
      <div id="status"></div>
    </div>
  `;

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    const accessToken = document.getElementById('accessToken').value.trim();
    const repoInput = document.getElementById('repoInput').value.trim();

    if (!accessToken || !repoInput) {
      status.innerHTML = '<div class="status error">Please fill in all fields</div>';
      return;
    }

    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      status.innerHTML = '<div class="status error">Invalid repository format. Please use owner/repo, HTTPS, or SSH URL</div>';
      return;
    }

    status.innerHTML = '<div class="loading">Saving and syncing...</div>';

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

      status.innerHTML = '<div class="status success">Successfully bound repository!</div>';
      setTimeout(loadContent, 1000);
    } catch (error) {
      status.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
  });
}

function renderBoundRepo(container, settings) {
  const repoUrl = `https://github.com/${settings.repoOwner}/${settings.repoName}`;
  const lastSync = settings.lastSync 
    ? new Date(settings.lastSync).toLocaleString() 
    : 'Never';

  container.innerHTML = `
    <div class="card">
      <h2>Bound Repository</h2>
      <div class="repo-info">
        <div>
          <div class="repo-name">${escapeHtml(settings.repoOwner)}/${escapeHtml(settings.repoName)}</div>
          <div style="font-size: 12px; color: #888; margin-top: 4px;">Last sync: ${lastSync}</div>
        </div>
        <a href="${repoUrl}" target="_blank" class="repo-link">View on GitHub →</a>
      </div>
      <div class="btn-group">
        <button id="syncBtn" class="btn btn-primary">Sync Now</button>
        <button id="editBtn" class="btn btn-secondary">Edit Settings</button>
        <button id="unbindBtn" class="btn btn-danger">Unbind</button>
      </div>
      <div id="status"></div>
    </div>
  `;

  document.getElementById('syncBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerHTML = '<div class="loading">Syncing...</div>';
    
    try {
      await chrome.runtime.sendMessage({ action: 'syncScripts' });
      
      const updatedSettings = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { ...settings, lastSync: new Date().toISOString() }
      });
      
      status.innerHTML = '<div class="status success">Sync successful!</div>';
      setTimeout(() => loadContent(), 1000);
    } catch (error) {
      status.innerHTML = `<div class="status error">Sync failed: ${error.message}</div>`;
    }
  });

  document.getElementById('editBtn').addEventListener('click', () => {
    renderBindForm(container, settings);
  });

  document.getElementById('unbindBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to unbind this repository?')) {
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
