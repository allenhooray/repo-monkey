<script setup lang="ts">
import { availableLocales, currentLocale, setLocale } from '../../shared/i18n';
import { useSyncedSettings } from '../../shared/composables/useSyncedState';

const { settings } = useSyncedSettings();

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}

// Fix: Need to import translate here
import { t as translate } from '../../shared/i18n';

async function handleLanguageChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as any;
  setLocale(value);
  
  // Update settings
  if (settings.value) {
    const response = await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { ...settings.value, language: value }
    });
  }
}
</script>

<template>
  <section class="page">
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

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #aaa;
  margin-bottom: 8px;
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

.hint {
  color: #666;
  font-size: 12px;
  margin-top: 8px;
  display: block;
}
</style>
