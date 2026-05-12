<script setup lang="ts">
import { computed } from 'vue';
import type { Script } from '../../runtime';
import { buildTree, flattenTree, type TreeNode } from '../../shared';
import { ScriptSource } from '../../shared/constants';

const props = defineProps<{
  scripts: Script[];
  expandedDirs: Set<string>;
  searchQuery?: string;
  showStatusTags?: boolean;
  selectedScriptId?: string | null;
  t?: (key: string) => string;
}>();

const emit = defineEmits<{
  'update:expandedDirs': [dirs: Set<string>];
  'toggleScript': [scriptId: string];
  'selectScript': [scriptId: string];
}>();

const scriptTree = computed(() => {
  return buildTree<Script>(props.scripts, 'remotePath');
});

const flattenedTree = computed(() => {
  return flattenTree(scriptTree.value);
});

const filteredTree = computed(() => {
  if (!props.searchQuery) {
    return flattenedTree.value;
  }
  
  const query = props.searchQuery.toLowerCase();
  const matchingPaths = new Set<string>();
  
  for (const node of flattenedTree.value) {
    if (node.type === 'file' && node.file) {
      const name = node.file.name.toLowerCase();
      const fileName = node.file.fileName.toLowerCase();
      if (name.includes(query) || fileName.includes(query)) {
        matchingPaths.add(node.path);
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

function formatDate(script: Script): string {
  return new Date(script.updatedAt || script.createdAt).toLocaleDateString();
}

function toggleDir(dirId: string): void {
  const newDirs = new Set(props.expandedDirs);
  if (newDirs.has(dirId)) {
    newDirs.delete(dirId);
  } else {
    newDirs.add(dirId);
  }
  emit('update:expandedDirs', newDirs);
}

function isDirExpanded(dirId: string): boolean {
  return props.expandedDirs.has(dirId);
}

function shouldShowNode(node: TreeNode<Script> & { depth: number }): boolean {
  if (node.id === 'root') return false;
  
  if (props.searchQuery) {
    return true;
  }
  
  const pathParts = node.path.split('/').filter(Boolean);
  for (let i = 0; i < pathParts.length - 1; i++) {
    const parentPath = pathParts.slice(0, i + 1).join('/');
    if (!props.expandedDirs.has(parentPath)) {
      return false;
    }
  }
  return true;
}

function handleToggleScript(scriptId: string, event: Event): void {
  event.stopPropagation();
  emit('toggleScript', scriptId);
}

function handleSelectScript(scriptId: string): void {
  emit('selectScript', scriptId);
}

function getSourceLabel(source: string): string {
  if (!props.t) {
    return source === ScriptSource.LOCAL ? 'Local' : source === ScriptSource.MODIFIED ? 'Modified' : 'Remote';
  }
  return source === ScriptSource.LOCAL ? props.t('labelLocal') : source === ScriptSource.MODIFIED ? props.t('labelModified') : props.t('labelRemote');
}
</script>

<template>
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
            <span class="chevron" :class="{ expanded: isDirExpanded(node.id) || searchQuery }"></span>
          </span>
          <span class="dir-icon"></span>
          <span class="dir-name">{{ node.name }}</span>
        </template>
        <template v-else-if="node.file">
          <span class="dir-toggle-placeholder"></span>
          <span class="file-icon"></span>
          <div v-if="showStatusTags" class="script-item-content">
            <div class="script-item-header">
              <span class="script-name">{{ node.file.name }}</span>
              <span v-if="node.file.orphan" class="orphan-badge">Orphan</span>
            </div>
            <div class="script-item-meta">
              <span class="source-tag" v-if="showStatusTags" :class="{
                'source-tag-local': node.file.source === ScriptSource.LOCAL,
                'source-tag-remote': node.file.source === ScriptSource.REMOTE,
                'source-tag-modified': node.file.source === ScriptSource.MODIFIED,
              }">
                {{ getSourceLabel(node.file.source) }}
              </span>
              <span class="script-filename">{{ node.file.fileName }}</span>
            </div>
          </div>
          <div v-else class="script-info">
            <div class="script-name">{{ node.file.name }}</div>
            <div class="script-meta">
              {{ node.file.fileName }} • {{ formatDate(node.file) }}
            </div>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="node.file.enabled"
              @change="handleToggleScript(node.file.id, $event)"
            />
            <span class="slider"></span>
          </label>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  min-height: 22px;
}

.tree-node:hover {
  background: #2a2d2e;
}

.tree-node.active {
  background: rgba(46, 204, 113, 0.1);
}

.tree-node-dir {
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

.script-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.script-name {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.script-meta {
  font-size: 11px;
  color: #6e7681;
}

.switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
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
  background-color: #373e47;
  transition: 0.2s;
  border-radius: 9px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: #adbac7;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #2ecc71;
}

input:checked + .slider:before {
  transform: translateX(14px);
  background-color: white;
}

.script-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.script-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.script-toggle {
  cursor: pointer;
  margin: 0;
}

.orphan-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #e74c3c;
  color: white;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 500;
}

.script-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #6e7681;
}

.source-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 500;
}

.source-tag-local {
  background: #3498db;
  color: white;
}

.source-tag-remote {
  background: #373e47;
  color: #adbac7;
}

.source-tag-modified {
  background: #e67e22;
  color: white;
}

.script-filename {
  font-size: 11px;
  color: #6e7681;
}
</style>
