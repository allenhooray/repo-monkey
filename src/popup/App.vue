<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Script } from '../runtime';
import type { Settings } from '../shared/types';
import { currentLocale, setLocale, t as translate } from '../shared/i18n';
import { buildTree, flattenTree, type TreeNode } from '../shared';

const settings = ref<Settings | null>(null);
const scripts = ref<Script[]>([]);
const loading = ref(true);
const syncing = ref(false);
const userScriptsAllowed = ref(true);
const expandedDirs = ref<Set<string>>(new Set());

const hasRepo = computed(
  () =>
    !!settings.value?.accessToken &&
    !!settings.value?.repoOwner &&
    !!settings.value?.repoName,
);

const lastSyncText = computed(() => {
  return settings.value?.lastSync
    ? new Date(settings.value.lastSync).toLocaleString()
    : t('never');
});

const scriptTree = computed(() => {
  return buildTree<Script>(scripts.value, 'remotePath');
});

const flattenedTree = computed(() => {
  return flattenTree(scriptTree.value);
});

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}

function openOptions(): void {
  chrome.runtime.openOptionsPage();
}

function openExtensionDetails(): void {
  const url = `chrome://extensions/?id=${chrome.runtime.id}`;
  chrome.tabs.create({ url });
}

async function checkUserScriptsAllowed(): Promise<void> {
  try {
    if (!chrome.userScripts) {
      userScriptsAllowed.value = false;
      return;
    }
    await chrome.userScripts.getScripts();
    userScriptsAllowed.value = true;
  } catch {
    userScriptsAllowed.value = false;
  }
}

async function loadData(): Promise<void> {
  loading.value = true;
  await checkUserScriptsAllowed();
  const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSettings' });
  settings.value = settingsResponse.settings as Settings;

  if (settings.value?.language) {
    setLocale(settings.value.language);
  }

  if (hasRepo.value) {
    const scriptsResponse = await chrome.runtime.sendMessage({ action: 'getScripts' });
    scripts.value = (scriptsResponse.scripts as Script[]) || [];
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
  const response = await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId });
  scripts.value = response.scripts as Script[];
}

function formatDate(script: Script): string {
  return new Date(script.updatedAt || script.createdAt).toLocaleDateString();
}

function toggleDir(dirId: string): void {
  if (expandedDirs.value.has(dirId)) {
    expandedDirs.value.delete(dirId);
  } else {
    expandedDirs.value.add(dirId);
  }
  // 触发响应式更新
  expandedDirs.value = new Set(expandedDirs.value);
}

function isDirExpanded(dirId: string): boolean {
  return expandedDirs.value.has(dirId);
}

function shouldShowNode(node: TreeNode<Script> & { depth: number }): boolean {
  // 根节点不显示
  if (node.id === 'root') return false;
  
  // 检查父目录是否展开
  const pathParts = node.path.split('/').filter(Boolean);
  for (let i = 0; i < pathParts.length - 1; i++) {
    const parentPath = pathParts.slice(0, i + 1).join('/');
    if (!expandedDirs.value.has(parentPath)) {
      return false;
    }
  }
  return true;
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

      <div v-else-if="!userScriptsAllowed" class="permission-notice">
        <div class="permission-title">{{ t('userScriptsPermissionTitle') }}</div>
        <p class="permission-desc">{{ t('userScriptsPermissionDesc') }}</p>
        <button class="btn btn-primary" @click="openExtensionDetails">
          {{ t('openExtensionDetails') }}
        </button>
      </div>

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
          <template v-for="node in flattenedTree" :key="node.id">
            <div
              v-if="shouldShowNode(node)"
              :class="['tree-node', { 'tree-node-dir': node.type === 'dir' }]"
              :style="{ paddingLeft: `${(node.depth - 1) * 16}px` }"
            >
              <template v-if="node.type === 'dir'">
                <span class="dir-toggle" @click="toggleDir(node.id)">
                  {{ isDirExpanded(node.id) ? '▼' : '▶' }}
                </span>
                <span class="dir-icon">📁</span>
                <span class="dir-name">{{ node.name }}</span>
              </template>
              <template v-else-if="node.file">
                <span class="file-icon">📜</span>
                <div class="script-info">
                  <div class="script-name">{{ node.file.name }}</div>
                  <div class="script-meta">
                    {{ node.file.fileName }} • {{ formatDate(node.file) }}
                  </div>
                </div>
                <label class="switch">
                  <input
                    type="checkbox"
                    :checked="node.file.enabled"
                    @change="handleToggle(node.file.id)"
                  />
                  <span class="slider"></span>
                </label>
              </template>
            </div>
          </template>
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

.permission-notice {
  padding: 16px;
  border-radius: 8px;
  background: rgba(241, 196, 15, 0.12);
  border: 1px solid rgba(241, 196, 15, 0.4);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.permission-title {
  font-weight: 600;
  color: #f1c40f;
}

.permission-desc {
  font-size: 12px;
  color: #ccc;
  margin: 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-node-dir {
  cursor: pointer;
}

.dir-toggle {
  width: 16px;
  text-align: center;
  font-size: 10px;
  color: #888;
  user-select: none;
}

.dir-icon,
.file-icon {
  font-size: 14px;
}

.dir-name {
  font-weight: 500;
  color: #e0e0e0;
}

.script-info {
  flex: 1;
  min-width: 0;
}

.script-name {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
}

.script-meta {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #404040;
  transition: 0.2s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #2ecc71;
}

input:checked + .slider:before {
  transform: translateX(16px);
}
</style>
