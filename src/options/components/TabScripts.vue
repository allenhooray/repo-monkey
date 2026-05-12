<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { currentLocale, t as translate } from '../../shared/i18n';
import { ScriptSource } from '../../shared/constants';
import { diffLines } from 'diff';
import { useSyncedSettings, useSyncedScripts } from '../../shared/composables/useSyncedState';
import { Button, Input } from '../../shared';
import ScriptTree from '../../shared/components/ScriptTree.vue';
import ScriptEditor from './ScriptEditor.vue';
import DialogCommitMessage from './DialogCommitMessage.vue';
import DialogConflict from './DialogConflict.vue';
import DialogDiff from './DialogDiff.vue';
import DialogNewScript from './DialogNewScript.vue';
import DialogBatchPush from './DialogBatchPush.vue';
import type { Script } from '../../runtime';
import type { BatchPushResult } from '../../shared/types';

const props = defineProps<{
  onStatus: (type: string, message: string) => void;
  onClearStatus: () => void;
}>();

const { settings } = useSyncedSettings();
const { scripts } = useSyncedScripts();

const selectedScriptId = ref<string | null>(null);
const searchQuery = ref('');
const expandedDirs = ref<Set<string>>(new Set());

const pushStatus = ref<string>('idle');
const commitMessageInput = ref('');
const showCommitMessageDialog = ref(false);
const showConflictDialog = ref(false);
const conflictRemoteContent = ref('');
const showDiffDialog = ref(false);
const diffRemoteContent = ref('');
const diffLocalContent = ref('');
const diffContent = ref('');
const showNewScriptDialog = ref(false);
const showBatchPushProgress = ref(false);
const showBatchPushResult = ref(false);
const batchPushResult = ref<BatchPushResult | null>(null);
const isBatchPushing = ref(false);

const DEFAULT_SCRIPT_TEMPLATE = `// ==UserScript==
// @name New Script
// @description My new user script
// @version 1.0
// @author Me
// @match *://*/*
// ==/UserScript==

console.log('Hello, world!');
`;

const selectedScript = computed(() => {
  return scripts.value.find((s: Script) => s.id === selectedScriptId.value) || null;
});

const isLocalScript = computed(() => {
  return selectedScript.value?.source === ScriptSource.LOCAL || false;
});

const isRemoteScript = computed(() => {
  return selectedScript.value?.source === ScriptSource.REMOTE || false;
});

const isModifiedScript = computed(() => {
  const script = selectedScript.value;
  if (!script || script.id === 'new') return false;
  return script.source === ScriptSource.MODIFIED || !!script.dirty;
});

const isBound = computed(() => {
  return !!(
    settings.value?.accessToken &&
    settings.value?.repoOwner &&
    settings.value?.repoName
  );
});

const canPush = computed((): boolean => {
  return !!(
    isBound.value &&
    selectedScript.value &&
    (selectedScript.value.source === ScriptSource.LOCAL ||
      selectedScript.value.source === ScriptSource.MODIFIED ||
      !!selectedScript.value.dirty) &&
    pushStatus.value !== 'pushing'
  );
});

const dirtyScriptsCount = computed(() => {
  return scripts.value.filter((s: Script) =>
    s.source === ScriptSource.LOCAL || s.source === ScriptSource.MODIFIED || !!s.dirty
  ).length;
});

const hasDirtyScripts = computed(() => dirtyScriptsCount.value > 0);

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}

async function handleToggleScript(scriptId: string) {
  const response = await chrome.runtime.sendMessage({
    action: 'toggleScript',
    scriptId,
  });
  scripts.value = response.scripts as Script[];
}

function handleSelectScript(scriptId: string) {
  selectedScriptId.value = scriptId;
}

function handleUpdateExpandedDirs(newDirs: Set<string>) {
  expandedDirs.value = newDirs;
}

function handleNewScript() {
  showNewScriptDialog.value = true;
}

async function handleConfirmNewScript(fileName: string) {
  if (!fileName) {
    props.onStatus('error', t('fileNameRequired'));
    return;
  }

  if (!fileName.endsWith('.js')) {
    props.onStatus('error', t('fileNameInvalid'));
    return;
  }

  const validNameRegex = /^[a-zA-Z0-9-_./]+$/;
  if (!validNameRegex.test(fileName)) {
    props.onStatus('error', t('fileNameInvalid'));
    return;
  }

  const duplicate = scripts.value.some((s: Script) =>
    s.fileName === fileName || s.remotePath === fileName
  );

  if (duplicate) {
    props.onStatus('error', t('fileNameDuplicate'));
    return;
  }

  try {
    const newScriptData = {
      fileName,
      content: DEFAULT_SCRIPT_TEMPLATE,
      name: '',
      metadata: {},
    };

    const response = await chrome.runtime.sendMessage({
      action: 'createScript',
      script: newScriptData,
    });

    if (response.success) {
      showNewScriptDialog.value = false;
      scripts.value = response.scripts as Script[];
      const newScript = scripts.value[scripts.value.length - 1];
      selectedScriptId.value = newScript.id;
      props.onStatus('success', t('saveSuccess'));
      setTimeout(props.onClearStatus, 2000);
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
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

  const duplicate = scripts.value.some((s: Script) =>
    s.id !== selectedScriptId.value &&
    (s.fileName === fileName || s.remotePath === fileName)
  );

  if (duplicate) {
    return { valid: false, message: t('fileNameDuplicate') };
  }

  return { valid: true };
}

async function handleSaveScript() {
  if (!selectedScript.value && selectedScriptId.value !== 'new') return;

  const fileNameValidation = validateFileName(selectedScript.value?.fileName || '');
  if (!fileNameValidation.valid) {
    props.onStatus('error', fileNameValidation.message as string);
    return;
  }

  try {
    let response;

    if (selectedScriptId.value === 'new') {
      // This case shouldn't happen here anymore since we handle new script creation separately
    } else {
      const updatedScript = {
        ...selectedScript.value,
        fileName: selectedScript.value?.fileName,
        content: selectedScript.value?.content,
      };

      response = await chrome.runtime.sendMessage({
        action: 'updateScript',
        script: updatedScript,
      });
    }

    if (response?.success) {
      scripts.value = response.scripts as Script[];
      props.onStatus('success', t('saveSuccess'));
      setTimeout(props.onClearStatus, 2000);
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

function handleEditorUpdateContent(content: string) {
  if (selectedScript.value) {
    selectedScript.value.content = content;
  }
}

function handleEditorUpdateFileName(fileName: string) {
  if (selectedScript.value) {
    selectedScript.value.fileName = fileName;
  }
}

async function handleDeleteScript() {
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
      props.onStatus('success', t('deleteSuccess'));
      setTimeout(props.onClearStatus, 2000);
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

async function handleDeleteFromRepo() {
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
      props.onStatus('success', t('deleteSuccess'));
      setTimeout(props.onClearStatus, 2000);
    } else {
      props.onStatus('error', response.error || 'Delete failed');
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

function handlePushScript(skipDiff: boolean) {
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

async function confirmPush() {
  showCommitMessageDialog.value = false;
  await doPush(false);
}

async function doPush(forceOverwrite: boolean) {
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
      props.onStatus('success', 'Successfully pushed to GitHub');
      setTimeout(() => {
        pushStatus.value = 'idle';
        props.onClearStatus();
      }, 2000);
    } else {
      if (response.errorCode === 'CONFLICT') {
        pushStatus.value = 'conflict';
        showConflictDialog.value = true;
      } else {
        pushStatus.value = 'idle';
        props.onStatus('error', response.error || 'Push failed');
      }
    }
  } catch (error) {
    pushStatus.value = 'idle';
    props.onStatus('error', `${(error as Error).message}`);
  }
}

async function handleConflictView() {
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

async function handleConflictOverwrite() {
  showConflictDialog.value = false;
  await doPush(true);
}

function handleConflictCancel() {
  showConflictDialog.value = false;
  pushStatus.value = 'idle';
}

async function handleViewDiff() {
  if (!selectedScriptId.value || selectedScriptId.value === 'new') return;

  const script = scripts.value.find((s: Script) => s.id === selectedScriptId.value);
  if (!script || script.source === ScriptSource.LOCAL) return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getRemoteContent',
      scriptId: selectedScriptId.value,
    });

    if (response.success) {
      diffRemoteContent.value = response.content as string;
      diffLocalContent.value = script.content || '';

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
      props.onStatus('error', response.error || 'Failed to fetch remote content');
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

function handleContinuePush() {
  showDiffDialog.value = false;
  handlePushScript(true);
}

async function handlePullFromGitHub() {
  if (!selectedScriptId.value || selectedScriptId.value === 'new') return;

  if (!confirm(t('confirmPull'))) return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pullScript',
      scriptId: selectedScriptId.value,
    });

    if (response.success) {
      scripts.value = response.scripts as Script[];
      props.onStatus('success', t('pullSuccess'));
      setTimeout(props.onClearStatus, 2000);
    } else {
      props.onStatus('error', response.error || 'Pull failed');
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
  }
}

async function handleBatchPush() {
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
      props.onStatus('error', response.error || 'Batch push failed');
      isBatchPushing.value = false;
      showBatchPushProgress.value = false;
    }
  } catch (error) {
    props.onStatus('error', `${t('error')} ${(error as Error).message}`);
    isBatchPushing.value = false;
    showBatchPushProgress.value = false;
  }
}

function closeBatchPushResult() {
  showBatchPushResult.value = false;
  batchPushResult.value = null;
  isBatchPushing.value = false;
}

function handleFullscreen() {
  // This is now handled in the ScriptEditor component
}
</script>

<template>
  <section class="page scripts-page">
    <h2 class="page-title">{{ t('scriptManagement') }}</h2>
    <div v-if="settings?.branch" class="branch-info">
      <span class="branch-label">{{ t('currentBranch') }}</span>
      <span class="branch-name">{{ settings.branch }}</span>
    </div>

    <div class="scripts-layout">
      <div class="script-list-panel">
        <div class="script-list-header">
          <div class="search-box">
            <Input
              type="text"
              :placeholder="t('searchScripts')"
              v-model="searchQuery"
            />
          </div>
          <div class="btn-group">
            <Button
              v-if="hasDirtyScripts"
              variant="primary"
              :disabled="isBatchPushing"
              @click="handleBatchPush"
            >
              {{ t('pushAllChanges') }}
              <span class="dirty-count-badge">{{ dirtyScriptsCount }}</span>
            </Button>
            <Button variant="primary" class="btn-new-script" @click="handleNewScript">
              {{ t('newScript') }}
            </Button>
          </div>
        </div>

        <ScriptTree
          :scripts="scripts"
          v-model:expanded-dirs="expandedDirs"
          :search-query="searchQuery"
          :show-status-tags="true"
          :selected-script-id="selectedScriptId"
          :t="t"
          @toggle-script="handleToggleScript"
          @select-script="handleSelectScript"
          @update:expanded-dirs="handleUpdateExpandedDirs"
        />
      </div>

      <div class="editor-panel">
        <div v-if="!selectedScriptId" class="editor-empty">
          <p>{{ t('selectScriptToEdit') }}</p>
        </div>

        <ScriptEditor
          v-else
          :script="selectedScript"
          :can-push="canPush"
          :push-status="pushStatus"
          :is-modified="isModifiedScript"
          :is-local="isLocalScript"
          :is-remote="isRemoteScript"
          @update:fileName="handleEditorUpdateFileName"
          @update:content="handleEditorUpdateContent"
          @saveScript="handleSaveScript"
          @deleteScript="handleDeleteScript"
          @deleteFromRepo="handleDeleteFromRepo"
          @pushScript="handlePushScript"
          @viewDiff="handleViewDiff"
          @pullFromGitHub="handlePullFromGitHub"
          @fullscreen="handleFullscreen"
        />
      </div>
    </div>
  </section>

  <DialogCommitMessage
    :visible="showCommitMessageDialog"
    :commit-message="commitMessageInput"
    @update:commitMessage="commitMessageInput = $event"
    @confirm="confirmPush"
    @cancel="showCommitMessageDialog = false"
  />

  <DialogConflict
    :visible="showConflictDialog"
    :remote-content="conflictRemoteContent"
    @viewRemote="handleConflictView"
    @overwrite="handleConflictOverwrite"
    @cancel="handleConflictCancel"
  />

  <DialogDiff
    :visible="showDiffDialog"
    :diff-content="diffContent"
    @continuePush="handleContinuePush"
    @cancel="showDiffDialog = false"
  />

  <DialogNewScript
    :visible="showNewScriptDialog"
    @create="handleConfirmNewScript"
    @cancel="showNewScriptDialog = false; props.onClearStatus()"
  />

  <DialogBatchPush
    :show-progress="showBatchPushProgress"
    :show-result="showBatchPushResult"
    :batch-result="batchPushResult"
    @close="closeBatchPushResult"
  />
</template>

<style scoped>
.page {
  max-width: 100%;
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

.branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background-color: rgba(46, 204, 113, 0.1);
  border: 1px solid rgba(46, 204, 113, 0.3);
  border-radius: 8px;
  margin-bottom: 20px;
}

.branch-label {
  color: #aaa;
  font-size: 14px;
}

.branch-name {
  color: #2ecc71;
  font-weight: 600;
  font-size: 16px;
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

.btn-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-new-script {
  width: 100%;
  padding: 10px 16px;
}

.dirty-count-badge {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-left: 8px;
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
</style>
