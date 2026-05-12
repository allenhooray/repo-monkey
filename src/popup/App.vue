<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Script } from '../runtime';
import type { Settings } from '../shared/types';

const settings = ref<Settings | null>(null);
const scripts = ref<Script[]>([]);
const loading = ref(true);
const syncing = ref(false);

const hasRepo = computed(
  () =>
    !!settings.value?.accessToken &&
    !!settings.value?.repoOwner &&
    !!settings.value?.repoName,
);

const lastSyncText = computed(() => {
  return settings.value?.lastSync
    ? new Date(settings.value.lastSync).toLocaleString()
    : chrome.i18n.getMessage('never');
});

function t(key: string): string {
  return chrome.i18n.getMessage(key);
}

function openOptions(): void {
  chrome.runtime.openOptionsPage();
}

async function loadData(): Promise<void> {
  loading.value = true;
  const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSettings' });
  settings.value = settingsResponse.settings as Settings;

  if (hasRepo.value) {
    const scriptsResponse = await chrome.runtime.sendMessage({ action: 'getScripts' });
    scripts.value = (scriptsResponse.scripts as Script[]) ?? [];
  }
  loading.value = false;
}

async function handleSync(): Promise<void> {
  syncing.value = true;
  try {
    await chrome.runtime.sendMessage({ action: 'syncScripts' });
    await loadData();
  } finally {
    syncing.value = false;
  }
}

async function handleToggle(scriptId: string): Promise<void> {
  await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId });
}

function formatDate(script: Script): string {
  return new Date(script.updatedAt || script.createdAt).toLocaleDateString();
}

onMounted(loadData);
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>RepoMonkey</h1>
      <button class="icon-btn" @click="openOptions">⚙️</button>
    </div>

    <div id="content">
      <div v-if="loading" class="loading">...</div>

      <div v-else-if="!hasRepo" class="no-repo">
        <p>{{ t('noRepoBound') }}</p>
        <button class="btn btn-primary" @click="openOptions">
          {{ t('bindRepo') }}
        </button>
      </div>

      <template v-else>
        <div class="sync-bar">
          <div class="sync-info">{{ t('lastSync') }} {{ lastSyncText }}</div>
          <button
            class="btn btn-secondary"
            :disabled="syncing"
            @click="handleSync"
          >
            {{ t('syncNow') }}
          </button>
        </div>

        <div v-if="syncing" class="loading">{{ t('syncing') }}</div>

        <p v-else-if="scripts.length === 0" class="empty-hint">
          {{ t('noScriptsFound') }}
        </p>

        <div v-else class="script-list">
          <div
            v-for="script in scripts"
            :key="script.id"
            class="script-item"
          >
            <div class="script-info">
              <div class="script-name">{{ script.name }}</div>
              <div class="script-meta">
                {{ script.fileName }} • {{ formatDate(script) }}
              </div>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                :checked="script.enabled"
                @change="handleToggle(script.id)"
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.empty-hint {
  text-align: center;
  color: #888;
}
</style>
