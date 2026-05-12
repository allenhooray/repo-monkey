<script setup lang="ts">
import { currentLocale, t as translate } from '../../shared/i18n';
import type { BatchPushResult } from '../../shared/types';

const props = defineProps<{
  showProgress: boolean;
  showResult: boolean;
  batchResult: BatchPushResult | null;
}>();

const emit = defineEmits<{
  'close': [];
}>();

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}
</script>

<template>
  <!-- Progress Dialog -->
  <div v-if="showProgress" class="dialog-overlay">
    <div class="dialog">
      <h3 class="dialog-title">{{ t('batchPushProgress') }}</h3>
      <div class="batch-progress-indicator">
        <div class="progress-spinner"></div>
      </div>
    </div>
  </div>

  <!-- Result Dialog -->
  <div v-if="showResult" class="dialog-overlay">
    <div class="dialog">
      <h3 class="dialog-title">Push Complete</h3>
      <div class="batch-result-summary">
        <div class="result-item success">
          <span class="result-count">{{ batchResult?.success }}</span>
          <span class="result-label">Succeeded</span>
        </div>
        <div class="result-item failed">
          <span class="result-count">{{ batchResult?.failed }}</span>
          <span class="result-label">Failed</span>
        </div>
        <div class="result-item conflict">
          <span class="result-count">{{ batchResult?.conflict }}</span>
          <span class="result-label">Conflicts</span>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-primary" @click="$emit('close')">
          OK
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

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #f0f0f0;
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
</style>
