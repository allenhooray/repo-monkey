<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { lineNumbers } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import type { Locale, Settings, BatchPushResult } from '../shared/types';
import { availableLocales, currentLocale, setLocale, t as translate } from '../shared/i18n';
import { parseRepoInput } from '../shared/utils/repo-parser';
import { ScriptSource } from '../shared/constants';
import { buildTree, flattenTree, type TreeNode } from '../shared';
import type { Script } from '../runtime';
import { diffLines } from 'diff';

type StatusType = 'success' | 'error' | 'loading' | '';
type TabKey = 'general' | 'repository' | 'scripts';
type PushStatus = 'idle' | 'pushing' | 'success' | 'conflict';

const settings = ref<Settings | null>(null);
const loading = ref(true);
const editing = ref(false);
const activeTab = ref<TabKey>('general');
const accessToken = ref('');
const repoInput = ref('');
const statusType = ref<StatusType>('');
const statusMessage = ref('');
const scripts = ref<Script[]>([]);
const selectedScriptId = ref<string | null>(null);
const searchQuery = ref('');
const isFullscreen = ref(false);
const editorContainer = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;
const expandedDirs = ref<Set<string>>(new Set());

const pushStatus = ref<PushStatus>('idle');
const commitMessageInput = ref('');
const showCommitMessageDialog = ref(false);
const showConflictDialog = ref(false);
const conflictRemoteContent = ref('');

const showDiffDialog = ref(false);
const diffRemoteContent = ref('');
const diffLocalContent = ref('');
const diffContent = ref('');

const showDeleteMenu = ref(false);
const showBatchPushProgress = ref(false);
const batchPushResult = ref<BatchPushResult | null>(null);
const showBatchPushResult = ref(false);

const isBatchPushing = ref(false);

const isBound = computed(
  () =>
    !!settings.value?.accessToken &&
    !!settings.value?.repoOwner &&
    !!settings.value?.repoName,
);

const dirtyScriptsCount = computed(() => {
  return scripts.value.filter(s => 
    s.source === ScriptSource.LOCAL || s.source === ScriptSource.MODIFIED || s.dirty
  ).length;
});

const orphanScriptsCount = computed(() => {
  return scripts.value.filter(s => s.orphan).length;
});

const hasDirtyScripts = computed(() => dirtyScriptsCount > 0);
const hasOrphanScripts = computed(() => orphanScriptsCount > 0);

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

const scriptTree = computed(() => {
  return buildTree<Script>(scripts.value, 'remotePath');
});

const flattenedTree = computed(() => {
  return flattenTree(scriptTree.value);
});

const filteredTree = computed(() => {
  if (!searchQuery.value) {
    return flattenedTree.value;
  }
  
  // 如果有搜索，先找到匹配的文件，然后显示它们及其父目录
  const query = searchQuery.value.toLowerCase();
  const matchingPaths = new Set<string>();
  
  for (const node of flattenedTree.value) {
    if (node.type === 'file' && node.file) {
      const name = node.file.name.toLowerCase();
      const fileName = node.file.fileName.toLowerCase();
      if (name.includes(query) || fileName.includes(query)) {
        // 添加匹配文件
        matchingPaths.add(node.path);
        // 添加所有父目录
        const parts = node.path.split('/').filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          const parentPath = parts.slice(0, i + 1).join('/');
          matchingPaths.add(parentPath);
        }
      }
    }
  }
  
  return flattenedTree.value.filter(node => matchingPaths.has(node.path) || node.id === 'root');
});

const selectedScript = computed(() => {
  return scripts.value.find(s => s.id === selectedScriptId.value) || null;
});

const isLocalScript = computed(() => {
  return selectedScript.value?.source === ScriptSource.LOCAL;
});

const isRemoteScript = computed(() => {
  return selectedScript.value?.source === ScriptSource.REMOTE;
});

const isModifiedScript = computed(() => {
  const script = selectedScript.value;
  if (!script || script.id === 'new') return false;
  return script.source === ScriptSource.MODIFIED || script.dirty;
});

const canPush = computed(() => {
  return (
    isBound.value &&
    selectedScript.value &&
    (selectedScript.value.source === ScriptSource.LOCAL ||
      selectedScript.value.source === ScriptSource.MODIFIED ||
      selectedScript.value.dirty) &&
    pushStatus.value !== 'pushing'
  );
});

const editorContent = computed({
  get: () => selectedScript.value?.content || '',
  set: (val) => {
    if (selectedScript.value) {
      selectedScript.value.content = val;
    }
  }
});

const editorFileName = computed({
  get: () => selectedScript.value?.fileName || '',
  set: (val) => {
    if (selectedScript.value) {
      selectedScript.value.fileName = val;
    }
  }
});

function t(key: string): string {
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
  await loadScripts();
  loading.value = false;
}

async function loadScripts(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
  scripts.value = response.scripts as Script[];
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
    await loadScripts();

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
    await loadScripts();
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

async function handleToggleScript(scriptId: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({ 
    action: 'toggleScript', 
    scriptId 
  });
  scripts.value = response.scripts as Script[];
}

const DEFAULT_SCRIPT_TEMPLATE = `// ==UserScript==
// @name New Script
// @description My new user script
// @version 1.0
// @author Me
// @match *://*/*
// ==/UserScript==

console.log('Hello, world!');
`;

function handleNewScript(): void {
  const tempScript: Partial<Script> = {
    name: 'New Script',
    fileName: `new-script-${Date.now()}.js`,
    content: DEFAULT_SCRIPT_TEMPLATE,
    enabled: true,
  };
  
  selectedScriptId.value = 'new';
  editorFileName.value = tempScript.fileName as string;
  editorContent.value = tempScript.content as string;
  
  nextTick(() => {
    initEditor();
  });
}

function validateFileName(fileName: string): { valid: boolean; message?: string } {
  if (!fileName.trim()) {
    return { valid: false, message: t('fileNameRequired') };
  }
  
  if (!fileName.endsWith('.js')) {
    return { valid: false, message: t('fileNameInvalid') };
  }
  
  const validNameRegex = /^[a-zA-Z0-9-_./]+$/;
  if (!validNameRegex.test(fileName)) {
    return { valid: false, message: t('fileNameInvalid') };
  }
  
  const duplicate = scripts.value.some(s => 
    s.id !== selectedScriptId.value && 
    (s.fileName === fileName || s.remotePath === fileName)
  );
  
  if (duplicate) {
    return { valid: false, message: t('fileNameDuplicate') };
  }
  
  return { valid: true };
}

async function handleSaveScript(): Promise<void> {
  if (!selectedScript.value && selectedScriptId.value !== 'new') return;
  
  const fileNameValidation = validateFileName(editorFileName.value);
  if (!fileNameValidation.valid) {
    setStatus('error', fileNameValidation.message as string);
    return;
  }
  
  try {
    let response;
    
    if (selectedScriptId.value === 'new') {
      const newScriptData = {
        fileName: editorFileName.value,
        content: editorContent.value,
        name: '',
        metadata: {},
      };
      
      response = await chrome.runtime.sendMessage({
        action: 'createScript',
        script: newScriptData,
      });
    } else {
      const updatedScript = {
        ...selectedScript.value,
        fileName: editorFileName.value,
        content: editorContent.value,
      };
      
      response = await chrome.runtime.sendMessage({
        action: 'updateScript',
        script: updatedScript,
      });
    }
    
    if (response.success) {
      scripts.value = response.scripts as Script[];
      if (selectedScriptId.value === 'new') {
        const newScript = scripts.value[scripts.value.length - 1];
        selectedScriptId.value = newScript.id;
      }
      setStatus('success', t('saveSuccess'));
      setTimeout(clearStatus, 2000);
    }
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

async function handleDeleteScript(): Promise<void> {
  if (!selectedScriptId.value || selectedScriptId.value === 'new') return;

  const confirmMessage = isLocalScript.value
    ? t('confirmDeleteLocalScript')
    : t('confirmDeleteRemoteScript');

  if (!confirm(confirmMessage)) return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteScript',
      scriptId: selectedScriptId.value,
    });

    if (response.success) {
      scripts.value = response.scripts as Script[];
      selectedScriptId.value = null;
      destroyEditor();
      setStatus('success', t('deleteSuccess'));
      setTimeout(clearStatus, 2000);
    }
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

function handlePushScript(skipDiff = false): void {
  if (!canPush.value || !selectedScript.value) return;

  // Show diff for non-local scripts unless skipDiff is true
  if (!skipDiff && selectedScript.value.source !== ScriptSource.LOCAL) {
    handleViewDiff();
    return;
  }

  commitMessageInput.value =
    selectedScript.value.source === ScriptSource.LOCAL
      ? `Add ${selectedScript.value.fileName}`
      : `Update ${selectedScript.value.fileName}`;
  showCommitMessageDialog.value = true;
}

async function confirmPush(): Promise<void> {
  showCommitMessageDialog.value = false;
  await doPush(false);
}

async function doPush(forceOverwrite: boolean): Promise<void> {
  if (!selectedScriptId.value) return;

  pushStatus.value = 'pushing';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pushScript',
      scriptId: selectedScriptId.value,
      commitMessage: commitMessageInput.value,
      forceOverwrite,
    });

    if (response.success) {
      scripts.value = response.scripts as Script[];
      pushStatus.value = 'success';
      setStatus('success', 'Successfully pushed to GitHub');
      setTimeout(() => {
        pushStatus.value = 'idle';
        clearStatus();
      }, 2000);
    } else {
      if (response.errorCode === 'CONFLICT') {
        pushStatus.value = 'conflict';
        showConflictDialog.value = true;
      } else {
        pushStatus.value = 'idle';
        setStatus('error', response.error || 'Push failed');
      }
    }
  } catch (error) {
    pushStatus.value = 'idle';
    setStatus('error', `${(error as Error).message}`);
  }
}

async function handleConflictView(): Promise<void> {
  if (!selectedScript.value || !settings.value) return;

  try {
    const remotePath = selectedScript.value.remotePath || selectedScript.value.fileName;
    const response = await fetch(
      `https://api.github.com/repos/${settings.value.repoOwner}/${settings.value.repoName}/contents/${encodeURIComponent(remotePath)}`,
      {
        headers: {
          Authorization: `Bearer ${settings.value.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      // 正确解码 UTF-8 编码的 base64 内容
      const binaryString = atob(data.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoded = new TextDecoder('utf-8').decode(bytes);
      conflictRemoteContent.value = decoded;
    }
  } catch (error) {
    console.error('Failed to fetch remote content', error);
  }
}

async function handleConflictOverwrite(): Promise<void> {
  showConflictDialog.value = false;
  await doPush(true);
}

function handleConflictCancel(): void {
  showConflictDialog.value = false;
  pushStatus.value = 'idle';
}

function handleSelectScript(scriptId: string): void {
  selectedScriptId.value = scriptId;
  nextTick(() => {
    initEditor();
  });
}

function handleFullscreen(): void {
  if (!editorContainer.value) return;
  
  if (!isFullscreen.value) {
    if (editorContainer.value.requestFullscreen) {
      editorContainer.value.requestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function initEditor(): void {
  destroyEditor();
  
  if (!editorContainer.value) return;
  
  const state = EditorState.create({
    doc: editorContent.value,
    extensions: [
      basicSetup,
      javascript(),
      lineNumbers(),
      keymap.of([
        ...defaultKeymap,
        indentWithTab,
        {
          key: 'Mod-s',
          run: () => {
            handleSaveScript();
            return true;
          },
          preventDefault: true,
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && selectedScript.value) {
          editorContent.value = update.state.doc.toString();
        }
      }),
      EditorView.theme({
        '&': {
          backgroundColor: '#1e1e1e',
          color: '#e0e0e0',
          height: '100%',
        },
        '.cm-scroller': {
          fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
        },
        '.cm-gutters': {
          backgroundColor: '#2d2d2d',
          color: '#666',
          borderRight: '1px solid #404040',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#333',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(46, 204, 113, 0.05)',
        },
        '.cm-selectionMatch': {
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
        },
        '.cm-cursor': {
          borderLeftColor: '#2ecc71',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: '#2ecc71',
        },
        '.cm-line': {
          padding: '0 4px',
        },
      }),
    ],
  });
  
  editorView = new EditorView({
    state,
    parent: editorContainer.value,
  });
}

function destroyEditor(): void {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
}

watch(activeTab, () => {
  clearStatus();
  if (activeTab.value === 'scripts') {
    loadScripts();
  }
});

onMounted(() => {
  loadSettings();
  
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement;
  });
  
  document.addEventListener('click', (e) => {
    if (showDeleteMenu.value) {
      const target = e.target as HTMLElement;
      if (!target.closest('.delete-menu-trigger') && !target.closest('.delete-menu')) {
        showDeleteMenu.value = false;
      }
    }
  });
});

async function handleDeleteFromRepo(): Promise<void> {
  if (!selectedScriptId.value || selectedScriptId.value === 'new') return;
  
  if (!confirm(t('confirmDeleteFromRepo'))) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteFromRepo',
      scriptId: selectedScriptId.value,
    });
    
    if (response.success) {
      scripts.value = response.scripts as Script[];
      selectedScriptId.value = null;
      destroyEditor();
      setStatus('success', t('deleteSuccess'));
      setTimeout(clearStatus, 2000);
    } else {
      setStatus('error', response.error || 'Delete failed');
    }
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
  }
  
  showDeleteMenu.value = false;
}

async function handleBatchPush(): Promise<void> {
  if (!hasDirtyScripts.value || isBatchPushing.value) return;
  
  isBatchPushing.value = true;
  showBatchPushProgress.value = true;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'batchPush',
    });
    
    if (response.success) {
      scripts.value = response.scripts as Script[];
      batchPushResult.value = response.batchResult as BatchPushResult;
      showBatchPushProgress.value = false;
      showBatchPushResult.value = true;
    } else {
      setStatus('error', response.error || 'Batch push failed');
      isBatchPushing.value = false;
      showBatchPushProgress.value = false;
    }
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
    isBatchPushing.value = false;
    showBatchPushProgress.value = false;
  }
}

function closeBatchPushResult(): void {
  showBatchPushResult.value = false;
  batchPushResult.value = null;
  isBatchPushing.value = false;
}

async function handleViewDiff(): Promise<void> {
  if (!selectedScriptId.value || selectedScriptId.value === 'new') return;
  
  const script = scripts.value.find(s => s.id === selectedScriptId.value);
  if (!script || script.source === ScriptSource.LOCAL) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getRemoteContent',
      scriptId: selectedScriptId.value,
    });
    
    if (response.success) {
      diffRemoteContent.value = response.content as string;
      diffLocalContent.value = editorContent.value;
      
      const diffResult = diffLines(diffRemoteContent.value, diffLocalContent.value);
      let html = '';
      diffResult.forEach(part => {
        if (part.added) {
          html += `<span style="background-color: rgba(46, 204, 113, 0.2); display: block;">+${part.value}</span>`;
        } else if (part.removed) {
          html += `<span style="background-color: rgba(231, 76, 60, 0.2); display: block;">-${part.value}</span>`;
        } else {
          html += `<span style="display: block;">${part.value}</span>`;
        }
      });
      diffContent.value = html;
      
      showDiffDialog.value = true;
    } else {
      setStatus('error', response.error || 'Failed to fetch remote content');
    }
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

async function handlePullFromGitHub(): Promise<void> {
  if (!selectedScriptId.value || selectedScriptId.value === 'new') return;
  
  if (!confirm(t('confirmPull'))) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pullScript',
      scriptId: selectedScriptId.value,
    });
    
    if (response.success) {
      scripts.value = response.scripts as Script[];
      setStatus('success', t('pullSuccess'));
      setTimeout(clearStatus, 2000);
      nextTick(() => {
        initEditor();
      });
    } else {
      setStatus('error', response.error || 'Pull failed');
    }
  } catch (error) {
    setStatus('error', `${t('error')} ${(error as Error).message}`);
  }
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
  
  // 如果有搜索，直接显示所有匹配的节点
  if (searchQuery.value) {
    return true;
  }
  
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
        <section v-else-if="activeTab === 'scripts'" class="page scripts-page">
          <h2 class="page-title">{{ t('scriptManagement') }}</h2>
          
          <div class="scripts-layout">
            <!-- Script list -->
            <div class="script-list-panel">
              <div class="script-list-header">
                <div class="search-box">
                  <input
                    type="text"
                    :placeholder="t('searchScripts')"
                    v-model="searchQuery"
                    class="search-input"
                  />
                </div>
                <div class="btn-group">
                  <button 
                    v-if="hasDirtyScripts"
                    class="btn btn-primary"
                    :disabled="isBatchPushing"
                    @click="handleBatchPush"
                  >
                    {{ t('pushAllChanges') }}
                    <span class="dirty-count-badge">{{ dirtyScriptsCount }}</span>
                  </button>
                  <button class="btn btn-primary btn-new-script" @click="handleNewScript">
                    {{ t('newScript') }}
                  </button>
                </div>
              </div>
              
              <div class="script-list">
          <template v-for="node in filteredTree" :key="node.id">
            <div
              v-if="shouldShowNode(node)"
              :class="['tree-node', {
                'tree-node-dir': node.type === 'dir',
                'tree-node-file': node.type === 'file',
                'active': node.type === 'file' && node.file && selectedScriptId === node.file.id,
                'orphan': node.type === 'file' && node.file && node.file.orphan
              }]"
              :style="{ paddingLeft: `${(node.depth - 1) * 16}px` }"
              @click="node.type === 'file' && node.file ? handleSelectScript(node.file.id) : null"
            >
              <template v-if="node.type === 'dir'">
                <span class="dir-toggle" @click.stop="toggleDir(node.id)">
                  <span class="chevron" :class="{ expanded: isDirExpanded(node.id) || searchQuery.value }"></span>
                </span>
                <span class="dir-icon"></span>
                <span class="dir-name">{{ node.name }}</span>
              </template>
              <template v-else-if="node.file">
                <span class="dir-toggle-placeholder"></span>
                <span class="file-icon"></span>
                <div class="script-item-content">
                  <div class="script-item-header">
                    <input
                      type="checkbox"
                      :checked="node.file.enabled"
                      @click.stop
                      @change="handleToggleScript(node.file.id)"
                      class="script-toggle"
                    />
                    <span class="script-name">{{ node.file.name }}</span>
                    <span v-if="node.file.orphan" class="orphan-badge">Orphan</span>
                  </div>
                  <div class="script-item-meta">
                    <span
                      :class="['source-tag', {
                        'source-tag-local': node.file.source === ScriptSource.LOCAL,
                        'source-tag-remote': node.file.source === ScriptSource.REMOTE,
                        'source-tag-modified': node.file.source === ScriptSource.MODIFIED,
                      }]"
                    >
                      {{ node.file.source === ScriptSource.LOCAL ? t('labelLocal') :
                         node.file.source === ScriptSource.MODIFIED ? t('labelModified') : t('labelRemote') }}
                    </span>
                    <span class="script-filename">{{ node.file.fileName }}</span>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
            </div>
            
            <!-- Editor panel -->
            <div class="editor-panel">
              <div v-if="!selectedScriptId" class="editor-empty">
                <p>{{ t('selectScriptToEdit') }}</p>
              </div>
              
              <div v-else class="editor-container" :class="{ fullscreen: isFullscreen }">
                <div class="editor-toolbar">
                  <div class="toolbar-left">
                    <div class="form-group">
                      <label>{{ t('fileName') }}</label>
                      <input
                        type="text"
                        v-model="editorFileName"
                        class="file-name-input"
                        :disabled="selectedScript?.source === ScriptSource.REMOTE && !selectedScript?.dirty"
                      />
                    </div>
                  </div>
                  <div class="toolbar-right">
                    <button class="btn btn-secondary" @click="handleFullscreen">
                      {{ isFullscreen ? t('exitFullscreen') : t('fullscreen') }}
                    </button>
                    <button 
                      v-if="isModifiedScript"
                      class="btn btn-secondary"
                      @click="handleViewDiff"
                    >
                      {{ t('viewDiff') }}
                    </button>
                    <button 
                      v-if="isModifiedScript"
                      class="btn btn-secondary"
                      @click="handlePullFromGitHub"
                    >
                      {{ t('pullFromGitHub') }}
                    </button>
                    <button 
                      v-if="canPush" 
                      class="btn btn-primary"
                      :disabled="pushStatus === 'pushing'"
                      @click="handlePushScript"
                    >
                      {{ pushStatus === 'pushing' ? 'Pushing...' : 'Push to GitHub' }}
                    </button>
                    <div v-if="selectedScriptId !== 'new'" class="delete-menu-container">
                      <button 
                        class="btn btn-danger delete-menu-trigger"
                        @click.stop="showDeleteMenu = !showDeleteMenu"
                      >
                        {{ t('delete') }}
                      </button>
                      <div v-if="showDeleteMenu" class="delete-menu">
                        <button class="delete-menu-item" @click="handleDeleteScript">
                          {{ t('deleteLocal') }}
                        </button>
                        <button 
                          v-if="selectedScript?.source !== ScriptSource.LOCAL"
                          class="delete-menu-item danger"
                          @click="handleDeleteFromRepo"
                        >
                          {{ t('deleteFromRepo') }}
                        </button>
                      </div>
                    </div>
                    <button class="btn btn-primary" @click="handleSaveScript">
                      {{ t('save') }}
                    </button>
                  </div>
                </div>
                
                <div ref="editorContainer" class="code-editor"></div>
                
                <div v-if="statusMessage" :class="['status-line', statusType]">
                  {{ statusMessage }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>
    
    <!-- Commit Message Dialog -->
    <div v-if="showCommitMessageDialog" class="dialog-overlay">
      <div class="dialog">
        <h3 class="dialog-title">Commit Message</h3>
        <div class="form-group">
          <input
            v-model="commitMessageInput"
            type="text"
            class="input"
            placeholder="Enter commit message"
          />
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showCommitMessageDialog = false">
            Cancel
          </button>
          <button class="btn btn-primary" @click="confirmPush">
            Push
          </button>
        </div>
      </div>
    </div>
    
    <!-- Conflict Dialog -->
    <div v-if="showConflictDialog" class="dialog-overlay">
      <div class="dialog conflict-dialog">
        <h3 class="dialog-title">Conflict Detected</h3>
        <p class="dialog-description">
          The remote file has changed since your last sync. What would you like to do?
        </p>
        <div v-if="conflictRemoteContent" class="conflict-content">
          <h4>Remote Content:</h4>
          <pre>{{ conflictRemoteContent }}</pre>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="handleConflictCancel">
            Cancel
          </button>
          <button class="btn btn-secondary" @click="handleConflictView">
            View Remote
          </button>
          <button class="btn btn-primary" @click="handleConflictOverwrite">
            Overwrite Remote
          </button>
        </div>
      </div>
    </div>

    <!-- Diff Dialog -->
    <div v-if="showDiffDialog" class="dialog-overlay">
      <div class="dialog diff-dialog">
        <h3 class="dialog-title">{{ t('diffDialogTitle') }}</h3>
        <div class="diff-content">
          <div v-html="diffContent" class="diff-text"></div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showDiffDialog = false">
            Cancel
          </button>
          <button class="btn btn-primary" @click="showDiffDialog = false; handlePushScript(true)">
            {{ t('continuePush') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Push Progress Dialog -->
    <div v-if="showBatchPushProgress" class="dialog-overlay">
      <div class="dialog">
        <h3 class="dialog-title">{{ t('batchPushProgress') }}</h3>
        <div class="batch-progress-indicator">
          <div class="progress-spinner"></div>
        </div>
      </div>
    </div>

    <!-- Batch Push Result Dialog -->
    <div v-if="showBatchPushResult" class="dialog-overlay">
      <div class="dialog">
        <h3 class="dialog-title">Push Complete</h3>
        <div class="batch-result-summary">
          <div class="result-item success">
            <span class="result-count">{{ batchPushResult?.success }}</span>
            <span class="result-label">Succeeded</span>
          </div>
          <div class="result-item failed">
            <span class="result-count">{{ batchPushResult?.failed }}</span>
            <span class="result-label">Failed</span>
          </div>
          <div class="result-item conflict">
            <span class="result-count">{{ batchPushResult?.conflict }}</span>
            <span class="result-label">Conflicts</span>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-primary" @click="closeBatchPushResult">
            OK
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint {
  color: #666;
  font-size: 12px;
  margin-top: 8px;
  display: block;
}

.hint-link {
  color: #2ecc71;
}

.repo-meta {
  font-size: 12px;
  color: #666;
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
  color: #666;
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
  color: #666;
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
  color: #b0b0b0;
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
  max-width: 100%;
  overflow: hidden;
}

.page {
  max-width: 800px;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

.page.scripts-page {
  max-width: 100%;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #f0f0f0;
  flex-shrink: 0;
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
  color: #666;
  font-size: 14px;
}

.card {
  background: #1e1e1e;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #333;
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

.form-group input {
  width: 100%;
  padding: 12px 16px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #2ecc71;
}

.form-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2ecc71;
  color: #000;
}

.btn-primary:hover {
  background: #27ae60;
}

.btn-danger {
  background: #e74c3c;
  color: #fff;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-secondary {
  background: #404040;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background: #505050;
}

.btn-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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
}

.repo-link {
  color: #2ecc71;
  text-decoration: none;
  font-size: 14px;
}

.repo-link:hover {
  text-decoration: underline;
}

.loading {
  text-align: center;
  padding: 48px;
  color: #666;
}

.scripts-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.script-list-panel {
  width: 320px;
  flex-shrink: 0;
  background: #1e1e1e;
  border-radius: 12px;
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.script-list-header {
  padding: 16px;
  border-bottom: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.search-box {
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #2ecc71;
}

.btn-new-script {
  width: 100%;
  padding: 10px 16px;
}

.script-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.script-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
  border: 1px solid transparent;
}

.script-item:hover {
  background: #242424;
}

.script-item.active {
  background: rgba(46, 204, 113, 0.1);
  border-color: rgba(46, 204, 113, 0.3);
}

.script-item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.script-toggle {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.script-name {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
}

.script-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.source-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.source-tag-local {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.source-tag-remote {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.source-tag-modified {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.script-filename {
  font-size: 12px;
  color: #666;
}

.editor-panel {
  flex: 1;
  background: #1e1e1e;
  border-radius: 12px;
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: 16px;
}

.editor-container.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: #1e1e1e;
  border-radius: 0;
  padding: 24px;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-left {
  flex: 1;
  min-width: 0;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.file-name-input {
  width: 100%;
  max-width: 400px;
}

.code-editor {
  flex: 1;
  min-height: 300px;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
}

.dirty-count-badge {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-left: 8px;
}

.delete-menu-container {
  position: relative;
}

.delete-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  overflow: hidden;
  z-index: 100;
  min-width: 180px;
}

.delete-menu-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #e0e0e0;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
  font-size: 14px;
}

.delete-menu-item:hover {
  background: #3d3d3d;
}

.delete-menu-item.danger {
  color: #e74c3c;
}

.delete-menu-item.danger:hover {
  background: rgba(231, 76, 60, 0.1);
}

.orphan-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.script-item.orphan {
  border-color: rgba(231, 76, 60, 0.3);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #f0f0f0;
}

.dialog-description {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 20px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.conflict-content {
  margin: 16px 0;
  padding: 16px;
  background: #2d2d2d;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.conflict-content h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #aaa;
}

.conflict-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 12px;
  color: #e0e0e0;
}

.diff-dialog {
  max-width: 900px;
}

.diff-content {
  margin: 16px 0;
  padding: 16px;
  background: #2d2d2d;
  border-radius: 8px;
  max-height: 500px;
  overflow-y: auto;
}

.diff-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.batch-progress-indicator {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.progress-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #404040;
  border-top-color: #2ecc71;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.batch-result-summary {
  display: flex;
  gap: 24px;
  justify-content: center;
  padding: 24px 0;
}

.result-item {
  text-align: center;
}

.result-count {
  display: block;
  font-size: 36px;
  font-weight: 700;
}

.result-label {
  display: block;
  font-size: 14px;
  color: #aaa;
}

.result-item.success .result-count {
  color: #2ecc71;
}

.result-item.failed .result-count {
  color: #e74c3c;
}

.result-item.conflict .result-count {
  color: #f59e0b;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
  user-select: none;
  min-height: 22px;
}

.tree-node:hover {
  background: #2a2d2e;
}

.tree-node.active {
  background: rgba(46, 204, 113, 0.1);
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.tree-node.orphan {
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.tree-node-dir {
  cursor: pointer;
}

.tree-node-file {
  cursor: pointer;
}

.dir-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dir-toggle-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.chevron {
  width: 0;
  height: 0;
  border-left: 4px solid #6e7681;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  transition: transform 0.1s ease;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.dir-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  position: relative;
}

.dir-icon::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 1px;
  width: 12px;
  height: 8px;
  background: #d29922;
  border-radius: 2px 2px 0 0;
}

.dir-icon::after {
  content: '';
  position: absolute;
  top: 5px;
  left: 0;
  width: 14px;
  height: 9px;
  background: #e3b341;
  border-radius: 0 2px 2px 2px;
}

.file-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  position: relative;
}

.file-icon::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 12px;
  background: #4d9375;
  border-radius: 0 2px 2px 2px;
}

.file-icon::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 4px;
  width: 4px;
  height: 4px;
  background: #1e1e1e;
  border-left: 1px solid #4d9375;
  border-bottom: 1px solid #4d9375;
  transform: skewY(-45deg);
}

.dir-name {
  font-weight: 500;
  color: #e0e0e0;
  font-size: 13px;
}

.script-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.script-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.script-toggle {
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.script-name {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.script-filename {
  font-size: 11px;
  color: #6e7681;
}

.orphan-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  flex-shrink: 0;
}
</style>

<style>
.code-editor .cm-scroller::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.code-editor .cm-scroller::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 5px;
}

.code-editor .cm-scroller::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 5px;
}

.code-editor .cm-scroller::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.code-editor .cm-scroller::-webkit-scrollbar-thumb:active {
  background: #777;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  max-width: 90%;
}

.dialog-title {
  font-size: 20px;
  margin: 0 0 16px 0;
  color: #e0e0e0;
}

.dialog-description {
  color: #aaa;
  margin: 0 0 16px 0;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.conflict-dialog {
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.conflict-content {
  margin: 16px 0;
  background: #2d2d2d;
  border-radius: 8px;
  padding: 12px;
}

.conflict-content h4 {
  margin: 0 0 8px 0;
  color: #aaa;
  font-size: 14px;
}

.conflict-content pre {
  margin: 0;
  color: #e0e0e0;
  white-space: pre-wrap;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
}

.input {
  width: 100%;
  padding: 12px 16px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #2ecc71;
}
</style>
