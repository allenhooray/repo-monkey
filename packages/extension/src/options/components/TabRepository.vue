<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { currentLocale, t as translate } from '../../shared/i18n';
import { parseRepoInput } from '../../shared/utils/repo-parser';
import { useSyncedSettings } from '../../shared/composables/useSyncedState';
import { Button, Input, Select, Dialog } from '../../shared';

const props = defineProps<{
  onStatus: (type: string, message: string) => void;
  onClearStatus: () => void;
}>();

const { settings } = useSyncedSettings();
const editing = ref(false);
const accessToken = ref('');
const repoInput = ref('');

// Branch related state
const branches = ref<Array<{ name: string; protected: boolean }>>([]);
const showCreateBranchDialog = ref(false);
const newBranchName = ref('');
const selectedSourceBranch = ref('');
const loadingBranches = ref(false);
const isCreatingBranch = ref(false);

const isBound = computed(() => {
  return !!(
    settings.value?.accessToken &&
    settings.value?.repoOwner &&
    settings.value?.repoName
  );
});

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
  void currentLocale.value;
  return translate(key);
}

function syncFormFields() {
  if (!settings.value) return;
  accessToken.value = settings.value.accessToken || '';
  repoInput.value =
    settings.value.repoInput ||
    (settings.value.repoOwner && settings.value.repoName
      ? `${settings.value.repoOwner}/${settings.value.repoName}`
      : '');
}

// Watch settings changes
watch(
  settings,
  (newSettings) => {
    syncFormFields();
    if (newSettings && !branches.value.length) {
      fetchBranches();
    }
  },
  { immediate: true }
);

async function handleSave() {
  props.onClearStatus();
  const tokenValue = accessToken.value.trim();
  const repoValue = repoInput.value.trim();

  if (!tokenValue || !repoValue) {
    props.onStatus('error', t('pleaseFillAll'));
    return;
  }

  const parsed = parseRepoInput(repoValue);
  if (!parsed) {
    props.onStatus('error', t('invalidRepoFormat'));
    return;
  }

  props.onStatus('loading', t('savingSyncing'));

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

    props.onStatus('success', t('successBound'));
    editing.value = false;
    setTimeout(() => {
      props.onClearStatus();
    }, 1000);
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

async function handleSync() {
  if (!settings.value) return;
  props.onStatus('loading', t('syncing'));

  try {
    await chrome.runtime.sendMessage({ action: 'syncScripts' });
    await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { ...settings.value, lastSync: new Date().toISOString() },
    });

    props.onStatus('success', t('syncSuccess'));
    setTimeout(() => {
      props.onClearStatus();
    }, 1000);
  } catch (error) {
    props.onStatus('error', `${t('syncFailed')} ${(error as Error).message}`);
  }
}

function handleEdit() {
  syncFormFields();
  editing.value = true;
  props.onClearStatus();
}

function handleCancelEdit() {
  editing.value = false;
  props.onClearStatus();
}

async function handleUnbind() {
  if (!confirm(t('confirmUnbind'))) return;
  await chrome.runtime.sendMessage({ action: 'unbindRepo' });
  editing.value = false;
}

// Branch related functions
async function fetchBranches() {
  if (!isBound.value) return;

  loadingBranches.value = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getBranches' });
    if (response.success && response.branches) {
      branches.value = response.branches;
      if (!settings.value?.branch && response.defaultBranch) {
        await persistSettings({ branch: response.defaultBranch });
      }
    } else {
      props.onStatus('error', response.error || t('failedToFetchBranches'));
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  } finally {
    loadingBranches.value = false;
  }
}

async function handleSelectBranch(branchName: string) {
  await persistSettings({ branch: branchName });
  props.onStatus('success', t('branchSwitch').replace('{branchName}', branchName));
  setTimeout(props.onClearStatus, 2000);
}

function handleOpenCreateBranchDialog() {
  newBranchName.value = '';
  selectedSourceBranch.value = settings.value?.branch || '';
  showCreateBranchDialog.value = true;
}

async function handleCreateBranch() {
  const branchName = newBranchName.value.trim();
  if (!branchName) {
    props.onStatus('error', t('branchNameRequired'));
    return;
  }

  if (isCreatingBranch.value) return;
  isCreatingBranch.value = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'createBranch',
      branch: branchName,
      sourceBranch: selectedSourceBranch.value,
    });

    if (response.success) {
      showCreateBranchDialog.value = false;
      await handleSelectBranch(branchName);
      await fetchBranches();
      props.onStatus('success', t('branchCreated').replace('{branchName}', branchName));
    } else {
      props.onStatus('error', response.error || t('failedToFetchBranches'));
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  } finally {
    isCreatingBranch.value = false;
  }
}

async function persistSettings(patch: Partial<any>) {
  const merged: any = {
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

// Watch bound status to fetch branches
watch(isBound, async (newVal) => {
  if (newVal) {
    await fetchBranches();
  }
});
</script>

<template>
  <section class="page">
    <h2 class="page-title">{{ t('repositorySettings') }}</h2>

    <div v-if="showForm" class="card">
      <h3 class="card-title">{{ t('bindGitHubRepo') }}</h3>
      <div class="form-group">
        <label for="accessToken">{{ t('personalAccessToken') }}</label>
        <Input
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
        <Input
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
        <Button variant="primary" @click="handleSave">
          {{ t('saveSync') }}
        </Button>
        <Button
          v-if="isBound && editing"
          variant="secondary"
          @click="handleCancelEdit"
        >
          {{ t('cancel') }}
        </Button>
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
      
      <!-- Branch selection area -->
      <div class="form-group" style="margin-top: 20px;">
        <label>{{ t('branch') }}</label>
        <div class="branch-selector">
          <Select
            v-if="branches.length > 0"
            :options="branches.map(b => ({ value: b.name, label: b.name }))"
            :value="settings?.branch || ''"
            @change="(value) => handleSelectBranch(value as string)"
            :disabled="loadingBranches"
          />
          <Button
            v-else
            variant="secondary"
            @click="fetchBranches"
            :disabled="loadingBranches"
          >
            {{ loadingBranches ? t('loadingBranches') : t('loadBranches') }}
          </Button>
          <Button
            variant="primary"
            @click="handleOpenCreateBranchDialog"
            :disabled="loadingBranches || isCreatingBranch"
          >
            {{ t('newBranch') }}
          </Button>
        </div>
      </div>
      
      <div class="btn-group">
        <Button variant="primary" @click="handleSync">
          {{ t('syncNow') }}
        </Button>
        <Button variant="secondary" @click="handleEdit">
          {{ t('editSettings') }}
        </Button>
        <Button variant="danger" @click="handleUnbind">
          {{ t('unbind') }}
        </Button>
      </div>
    </div>

    <!-- Create Branch Dialog -->
    <Dialog
      v-model="showCreateBranchDialog"
      :title="t('createNewBranch')"
    >
      <div class="form-group">
        <label>{{ t('branchName') }}</label>
        <Input
          v-model="newBranchName"
          type="text"
          :placeholder="t('branchNamePlaceholder')"
          @keyup.enter="handleCreateBranch"
          autofocus
        />
      </div>
      <div class="form-group" v-if="branches.length > 0">
        <label>{{ t('sourceBranch') }}</label>
        <Select
          :options="branches.map(b => ({ value: b.name, label: b.name }))"
          v-model="selectedSourceBranch"
        />
      </div>
      <template #footer>
        <Button variant="secondary" @click="showCreateBranchDialog = false">
          {{ t('cancel') }}
        </Button>
        <Button variant="primary" @click="handleCreateBranch" :disabled="isCreatingBranch">
          {{ isCreatingBranch ? t('loadingBranches') : t('create') }}
        </Button>
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.page {
  max-width: 800px;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #f0f0f0;
  flex-shrink: 0;
}

.card {
  background: #1e1e1e;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #333;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #aaa;
  margin-bottom: 8px;
}

.btn-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.hint {
  color: #666;
  font-size: 12px;
  margin-top: 8px;
  display: block;
}

.hint-link {
  color: #2ecc71;
}

.repo-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #2d2d2d;
  border-radius: 8px;
  margin-bottom: 16px;
}

.repo-name {
  font-size: 16px;
  font-weight: 500;
  color: #e0e0e0;
}

.repo-meta {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.repo-link {
  color: #2ecc71;
  text-decoration: none;
  font-size: 14px;
}

.repo-link:hover {
  text-decoration: underline;
}

.branch-selector {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
