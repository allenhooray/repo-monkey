<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { currentLocale, t as translate } from '../shared/i18n';
import { useSyncedSettings } from '../shared/composables/useSyncedState';
import TabGeneral from './components/TabGeneral.vue';
import TabRepository from './components/TabRepository.vue';
import TabScripts from './components/TabScripts.vue';

type TabKey = 'general' | 'repository' | 'scripts';

const { settings } = useSyncedSettings();
const loading = ref(true);
const activeTab = ref<TabKey>('general');
const statusType = ref<string>('');
const statusMessage = ref<string>('');

const navItems = computed<{ key: TabKey; label: string }[]>(() => [
  { key: 'general', label: t('generalSettings') },
  { key: 'repository', label: t('repositorySettings') },
  { key: 'scripts', label: t('scriptManagement') },
]);

function t(key: string): string {
  void currentLocale.value;
  return translate(key);
}

function setStatus(type: string, message: string): void {
  statusType.value = type;
  statusMessage.value = message;
}

function clearStatus(): void {
  statusType.value = '';
  statusMessage.value = '';
}

watch(settings, (newSettings) => {
  if (newSettings !== null) {
    loading.value = false;
  }
}, { immediate: true });

watch(activeTab, () => {
  clearStatus();
});
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
        <TabGeneral v-if="activeTab === 'general'" />

        <TabRepository
          v-else-if="activeTab === 'repository'"
          :on-status="setStatus"
          :on-clear-status="clearStatus"
        />

        <TabScripts
          v-else-if="activeTab === 'scripts'"
          :on-status="setStatus"
          :on-clear-status="clearStatus"
        />
      </template>

      <div v-if="statusMessage" :class="['status-line', statusType]">
        {{ statusMessage }}
      </div>
    </main>
  </div>
</template>

<style scoped>
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
  display: flex;
  flex-direction: column;
}

.loading {
  text-align: center;
  padding: 48px;
  color: #666;
}

.status-line {
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 14px;
  flex-shrink: 0;
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
</style>
