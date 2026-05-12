<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Settings } from '../shared/types';
import { parseRepoInput } from '../shared/utils/repo-parser';

type StatusType = 'success' | 'error' | 'loading' | '';

const settings = ref<Settings | null>(null);
const loading = ref(true);
const editing = ref(false);

const accessToken = ref('');
const repoInput = ref('');

const statusType = ref<StatusType>('');
const statusMessage = ref('');

const isBound = computed(
  () =>
    !!settings.value?.accessToken &&
    !!settings.value?.repoOwner &&
    !!settings.value?.repoName,
);

const showForm = computed(() => editing.value || !isBound.value);

const repoUrl = computed(() => {
  if (!settings.value?.repoOwner || !settings.value?.repoName) return '';
  return `https://github.com/${settings.value.repoOwner}/${settings.value.repoName}`;
});

const lastSyncText = computed(() => {
  return settings.value?.lastSync
    ? new Date(settings.value.lastSync).toLocaleString()
    : t('never');
});

function t(key: string): string {
  return chrome.i18n.getMessage(key);
}

function setStatus(type: StatusType, message: string): void {
  statusType.value = type;
  statusMessage.value = message;
}

function clearStatus(): void {
  statusType.value = '';
  statusMessage.value = '';
}

function syncFormFields(): void {
  if (!settings.value) return;
  accessToken.value = settings.value.accessToken || '';
  repoInput.value =
    settings.value.repoInput ||
    (settings.value.repoOwner && settings.value.repoName
      ? `${settings.value.repoOwner}/${settings.value.repoName}`
      : '');
}

async function loadSettings(): Promise<void> {
  loading.value = true;
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  settings.value = response.settings as Settings;
  syncFormFields();
  loading.value = false;
}

async function handleSave(): Promise<void> {
  clearStatus();
  const tokenValue = accessToken.value.trim();
  const repoValue = repoInput.value.trim();

  if (!tokenValue || !repoValue) {
    setStatus('error', t('pleaseFillAll'));
    return;
  }

  const parsed = parseRepoInput(repoValue);
  if (!parsed) {
    setStatus('error', t('invalidRepoFormat'));
    return;
  }

  setStatus('loading', t('savingSyncing'));

  try {
    await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: {
        accessToken: tokenValue,
        repoInput: repoValue,
        repoOwner: parsed.owner,
        repoName: parsed.repo,
        lastSync: new Date().toISOString(),
      },
    });

    await chrome.runtime.sendMessage({ action: 'syncScripts' });

    setStatus('success', t('successBound'));
    editing.value = false;
    setTimeout(async () => {
      await loadSettings();
      clearStatus();
    }, 1000);
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

async function handleSync(): Promise<void> {
  if (!settings.value) return;
  setStatus('loading', t('syncing'));

  try {
    await chrome.runtime.sendMessage({ action: 'syncScripts' });
    await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { ...settings.value, lastSync: new Date().toISOString() },
    });

    setStatus('success', t('syncSuccess'));
    setTimeout(async () => {
      await loadSettings();
      clearStatus();
    }, 1000);
  } catch (error) {
    setStatus('error', `${t('syncFailed')} ${(error as Error).message}`);
  }
}

function handleEdit(): void {
  syncFormFields();
  editing.value = true;
  clearStatus();
}

function handleCancelEdit(): void {
  editing.value = false;
  clearStatus();
}

async function handleUnbind(): Promise<void> {
  if (!confirm(t('confirmUnbind'))) return;
  await chrome.runtime.sendMessage({ action: 'unbindRepo' });
  editing.value = false;
  await loadSettings();
}

onMounted(loadSettings);
</script>

<template>
  <div class="container">
    <header>
      <h1>RepoMonkey Settings</h1>
    </header>
    <main>
      <div v-if="loading" class="loading">...</div>

      <template v-else>
        <div v-if="showForm" class="card">
          <h2>{{ t('bindGitHubRepo') }}</h2>
          <div class="form-group">
            <label for="accessToken">{{ t('personalAccessToken') }}</label>
            <input
              id="accessToken"
              v-model="accessToken"
              type="password"
              :placeholder="t('accessTokenPlaceholder')"
            />
            <small class="hint">
              {{ t('createTokenDesc') }}
              <strong>{{ t('repoScope') }}</strong>
              {{ t('scopeAt') }}
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                class="hint-link"
              >{{ t('githubSettings') }}</a>
            </small>
          </div>
          <div class="form-group">
            <label for="repoInput">{{ t('repository') }}</label>
            <input
              id="repoInput"
              v-model="repoInput"
              type="text"
              :placeholder="t('repoInputPlaceholder')"
            />
            <small class="hint">
              {{ t('supportFormats') }}
              <code>owner/repo</code>,
              <code>https://github.com/owner/repo</code>, or
              <code>git@github.com:owner/repo.git</code>
            </small>
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" @click="handleSave">
              {{ t('saveSync') }}
            </button>
            <button
              v-if="isBound && editing"
              class="btn btn-secondary"
              @click="handleCancelEdit"
            >
              {{ t('cancel') || 'Cancel' }}
            </button>
          </div>
          <div v-if="statusMessage" :class="['status-line', statusType]">
            {{ statusMessage }}
          </div>
        </div>

        <div v-else class="card">
          <h2>{{ t('boundRepository') }}</h2>
          <div class="repo-info">
            <div>
              <div class="repo-name">
                {{ settings?.repoOwner }}/{{ settings?.repoName }}
              </div>
              <div class="repo-meta">
                {{ t('lastSync') }} {{ lastSyncText }}
              </div>
            </div>
            <a :href="repoUrl" target="_blank" class="repo-link">
              {{ t('viewOnGitHub') }}
            </a>
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" @click="handleSync">
              {{ t('syncNow') }}
            </button>
            <button class="btn btn-secondary" @click="handleEdit">
              {{ t('editSettings') }}
            </button>
            <button class="btn btn-danger" @click="handleUnbind">
              {{ t('unbind') }}
            </button>
          </div>
          <div v-if="statusMessage" :class="['status-line', statusType]">
            {{ statusMessage }}
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.hint {
  color: #888;
  font-size: 12px;
  margin-top: 8px;
  display: block;
}

.hint-link {
  color: #2ecc71;
}

.repo-meta {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.status-line {
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 14px;
}

.status-line.success {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.status-line.error {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.status-line.loading {
  text-align: center;
  color: #888;
}
</style>
