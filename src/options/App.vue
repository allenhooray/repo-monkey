<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Locale, Settings } from '../shared/types';
import { availableLocales, currentLocale, setLocale, t as translate } from '../shared/i18n';
import { parseRepoInput } from '../shared/utils/repo-parser';

type StatusType = 'success' | 'error' | 'loading' | '';
type TabKey = 'general' | 'repository' | 'scripts';

const settings = ref<Settings | null>(null);
const loading = ref(true);
const editing = ref(false);
const activeTab = ref<TabKey>('general');

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
  // Touch the ref so this computed/template re-evaluates on locale change.
  void currentLocale.value;
  return translate(key);
}

const navItems = computed<{ key: TabKey; label: string }[]>(() => [
  { key: 'general', label: t('generalSettings') },
  { key: 'repository', label: t('repositorySettings') },
  { key: 'scripts', label: t('scriptManagement') },
]);

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
  if (settings.value?.language) {
    setLocale(settings.value.language);
  }
  syncFormFields();
  loading.value = false;
}

async function persistSettings(patch: Partial<Settings>): Promise<void> {
  const merged: Settings = {
    accessToken: settings.value?.accessToken ?? '',
    repoInput: settings.value?.repoInput ?? '',
    repoOwner: settings.value?.repoOwner ?? '',
    repoName: settings.value?.repoName ?? '',
    lastSync: settings.value?.lastSync ?? null,
    language: settings.value?.language,
    ...patch,
  };
  await chrome.runtime.sendMessage({
    action: 'saveSettings',
    settings: merged,
  });
  settings.value = merged;
}

async function handleLanguageChange(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value as Locale;
  setLocale(value);
  await persistSettings({ language: value });
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
        ...(settings.value ?? {}),
        accessToken: tokenValue,
        repoInput: repoValue,
        repoOwner: parsed.owner,
        repoName: parsed.repo,
        lastSync: new Date().toISOString(),
        language: settings.value?.language,
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

watch(activeTab, () => {
  clearStatus();
});

onMounted(loadSettings);
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>RepoMonkey</h1>
        <span class="sidebar-subtitle">{{ t('settingsTitle') }}</span>
      </div>
      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          :class="['nav-item', { active: activeTab === item.key }]"
          @click="activeTab = item.key"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>

    <main class="content">
      <div v-if="loading" class="loading">...</div>

      <template v-else>
        <!-- General settings -->
        <section v-if="activeTab === 'general'" class="page">
          <h2 class="page-title">{{ t('generalSettings') }}</h2>
          <div class="card">
            <div class="form-group">
              <label for="languageSelect">{{ t('language') }}</label>
              <select
                id="languageSelect"
                class="select"
                :value="currentLocale"
                @change="handleLanguageChange"
              >
                <option
                  v-for="locale in availableLocales"
                  :key="locale.value"
                  :value="locale.value"
                >
                  {{ t(locale.labelKey) }}
                </option>
              </select>
              <small class="hint">{{ t('languageDesc') }}</small>
            </div>
          </div>
        </section>

        <!-- Repository settings -->
        <section v-else-if="activeTab === 'repository'" class="page">
          <h2 class="page-title">{{ t('repositorySettings') }}</h2>

          <div v-if="showForm" class="card">
            <h3 class="card-title">{{ t('bindGitHubRepo') }}</h3>
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
                {{ t('cancel') }}
              </button>
            </div>
            <div v-if="statusMessage" :class="['status-line', statusType]">
              {{ statusMessage }}
            </div>
          </div>

          <div v-else class="card">
            <h3 class="card-title">{{ t('boundRepository') }}</h3>
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
        </section>

        <!-- Script management -->
        <section v-else-if="activeTab === 'scripts'" class="page">
          <h2 class="page-title">{{ t('scriptManagement') }}</h2>
          <div class="card empty-card">
            <p class="empty-text">{{ t('comingSoon') }}</p>
          </div>
        </section>
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

.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1a1a1a;
  border-right: 1px solid #2a2a2a;
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-header {
  padding: 0 12px 16px;
  border-bottom: 1px solid #2a2a2a;
}

.sidebar-header h1 {
  font-size: 20px;
  font-weight: 700;
  color: #2ecc71;
  margin: 0;
}

.sidebar-subtitle {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #888;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  text-align: left;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #cfcfcf;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.nav-item:hover {
  background: #242424;
  color: #fff;
}

.nav-item.active {
  background: rgba(46, 204, 113, 0.15);
  color: #2ecc71;
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 40px 48px;
  max-width: 760px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #f0f0f0;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.select {
  width: 100%;
  padding: 12px 16px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.select:focus {
  outline: none;
  border-color: #2ecc71;
}

.empty-card {
  text-align: center;
  padding: 48px 24px;
}

.empty-text {
  color: #888;
  font-size: 14px;
}
</style>
