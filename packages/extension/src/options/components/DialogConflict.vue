<script setup lang="ts">
import { currentLocale, t as translate } from '../../shared/i18n';

const props = defineProps<{
  visible: boolean;
  remoteContent: string;
}>();

const emit = defineEmits<{
  'viewRemote': [];
  'overwrite': [];
  'cancel': [];
}>();

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}
</script>

<template>
  <div v-if="visible" class="dialog-overlay">
    <div class="dialog conflict-dialog">
      <h3 class="dialog-title">Conflict Detected</h3>
      <p class="dialog-description">
        The remote file has changed since your last sync. What would you like to do?
      </p>
      <div v-if="remoteContent" class="conflict-content">
        <h4>Remote Content:</h4>
        <pre>{{ remoteContent }}</pre>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="$emit('cancel')">
          {{ t('cancel') }}
        </button>
        <button class="btn btn-secondary" @click="$emit('viewRemote')">
          View Remote
        </button>
        <button class="btn btn-primary" @click="$emit('overwrite')">
          Overwrite Remote
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.conflict-dialog {
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
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

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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

.btn-secondary {
  background: #404040;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background: #505050;
}
</style>
