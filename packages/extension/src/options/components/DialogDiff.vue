<script setup lang="ts">
import { currentLocale, t as translate } from '../../shared/i18n';

const props = defineProps<{
  visible: boolean;
  diffContent: string;
}>();

const emit = defineEmits<{
  'continuePush': [];
  'cancel': [];
}>();

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}
</script>

<template>
  <div v-if="visible" class="dialog-overlay">
    <div class="dialog diff-dialog">
      <h3 class="dialog-title">{{ t('diffDialogTitle') }}</h3>
      <div class="diff-content">
        <div v-html="diffContent" class="diff-text"></div>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="$emit('cancel')">
          {{ t('cancel') }}
        </button>
        <button class="btn btn-primary" @click="$emit('continuePush')">
          {{ t('continuePush') }}
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

.diff-dialog {
  max-width: 900px;
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #f0f0f0;
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
