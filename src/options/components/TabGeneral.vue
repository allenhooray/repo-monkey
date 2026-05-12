<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { availableLocales, currentLocale, setLocale, t as translate } from '../../shared/i18n';
import { useSyncedSettings } from '../../shared/composables/useSyncedState';
import { Select } from '../../shared';

const { settings } = useSyncedSettings();

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}

const languageOptions = computed(() => {
  return availableLocales.map(locale => ({
    value: locale.value,
    label: t(locale.labelKey)
  }));
});

const selectedLocale = ref(currentLocale.value);

watch(selectedLocale, async (value) => {
  setLocale(value);
  
  // Update settings
  if (settings.value) {
    const response = await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { ...settings.value, language: value }
    });
  }
});
</script>

<template>
  <section class="page">
    <h2 class="page-title">{{ t('generalSettings') }}</h2>
    <div class="card">
      <div class="form-group">
        <label for="languageSelect">{{ t('language') }}</label>
        <Select
          id="languageSelect"
          :options="languageOptions"
          v-model="selectedLocale"
        />
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

.hint {
  color: #666;
  font-size: 12px;
  margin-top: 8px;
  display: block;
}
</style>
