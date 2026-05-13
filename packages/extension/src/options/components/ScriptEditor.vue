<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { lineNumbers } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { currentLocale, t as translate } from '../../shared/i18n';
import { ScriptSource } from '../../shared/constants';
import type { Script } from '../../runtime';

const props = defineProps<{
  script: Script | null;
  canPush: boolean;
  pushStatus: string;
  isModified: boolean;
  isLocal: boolean;
  isRemote: boolean;
}>();

const emit = defineEmits<{
  'update:fileName': [fileName: string];
  'update:content': [content: string];
  'saveScript': [];
  'deleteScript': [];
  'deleteFromRepo': [];
  'pushScript': [skipDiff: boolean];
  'viewDiff': [];
  'pullFromGitHub': [];
  'fullscreen': [];
}>();

const editorContainer = ref<HTMLElement | null>(null);
const showDeleteMenu = ref(false);
const isFullscreen = ref(false);
let editorView: EditorView | null = null;

const editorContent = computed({
  get: () => props.script?.content || '',
  set: (val) => {
    emit('update:content', val);
  }
});

const editorFileName = computed({
  get: () => props.script?.fileName || '',
  set: (val) => {
    emit('update:fileName', val);
  }
});

const fileNameDisabled = computed(() => {
  return props.isRemote && !props.script?.dirty;
});

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}

function initEditor() {
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
            emit('saveScript');
            return true;
          },
          preventDefault: true,
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && props.script) {
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

function destroyEditor() {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
}

watch(() => props.script, () => {
  if (props.script) {
    initEditor();
  }
}, { immediate: true });

onMounted(() => {
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
</script>

<template>
  <div class="editor-container" :class="{ fullscreen: isFullscreen }">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <div class="form-group">
          <label>{{ t('fileName') }}</label>
          <input
            type="text"
            v-model="editorFileName"
            class="file-name-input"
            :disabled="fileNameDisabled"
          />
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-secondary" @click="$emit('fullscreen')">
          {{ isFullscreen ? t('exitFullscreen') : t('fullscreen') }}
        </button>
        <button
          v-if="isModified"
          class="btn btn-secondary"
          @click="$emit('viewDiff')"
        >
          {{ t('viewDiff') }}
        </button>
        <button
          v-if="isModified"
          class="btn btn-secondary"
          @click="$emit('pullFromGitHub')"
        >
          {{ t('pullFromGitHub') }}
        </button>
        <button
          v-if="canPush"
          class="btn btn-primary"
          :disabled="pushStatus === 'pushing'"
          @click="$emit('pushScript', false)"
        >
          {{ pushStatus === 'pushing' ? 'Pushing...' : 'Push to GitHub' }}
        </button>
        <div v-if="script" class="delete-menu-container">
          <button
            class="btn btn-danger delete-menu-trigger"
            @click.stop="showDeleteMenu = !showDeleteMenu"
          >
            {{ t('delete') }}
          </button>
          <div v-if="showDeleteMenu" class="delete-menu">
            <button class="delete-menu-item" @click="$emit('deleteScript')">
              {{ t('deleteLocal') }}
            </button>
            <button
              v-if="!isLocal"
              class="delete-menu-item danger"
              @click="$emit('deleteFromRepo')"
            >
              {{ t('deleteFromRepo') }}
            </button>
          </div>
        </div>
        <button class="btn btn-primary" @click="$emit('saveScript')">
          {{ t('save') }}
        </button>
      </div>
    </div>

    <div ref="editorContainer" class="code-editor"></div>
  </div>
</template>

<style scoped>
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

.form-group {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #aaa;
  margin-bottom: 8px;
}

.file-name-input {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  transition: border-color 0.2s;
}

.file-name-input:focus {
  outline: none;
  border-color: #2ecc71;
}

.file-name-input:disabled {
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

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.code-editor {
  flex: 1;
  min-height: 300px;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
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
</style>
