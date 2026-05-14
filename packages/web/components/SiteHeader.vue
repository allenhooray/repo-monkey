<script setup lang="ts">
interface NavigationLink {
  id: string;
  labelKey: string;
}

const { locale, setLocale, t } = useI18n();
const MANUAL_LOCALE_STORAGE_KEY = 'repo-monkey-manual-locale';

const navigationLinks: NavigationLink[] = [
  { id: 'capabilities', labelKey: 'nav.capabilities' },
  { id: 'scenarios', labelKey: 'nav.scenarios' },
];

/**
 * Switches the active locale and persists the manual choice for later visits.
 */
async function handleLocaleChange(nextLocale: string): Promise<void> {
  window.localStorage.setItem(MANUAL_LOCALE_STORAGE_KEY, nextLocale);
  await setLocale(nextLocale);
}
</script>

<template>
  <header class="topbar glass-panel section-shell">
    <a class="brand" href="#hero" :aria-label="t('brand.ariaLabel')">
      <span class="brand__mark">
        <img src="/icon.png" alt="" width="48" height="48">
      </span>
      <span>
        <strong class="brand__name">{{ t('brand.name') }}</strong>
        <span class="brand__tag">{{ t('brand.tagline') }}</span>
      </span>
    </a>

    <nav class="topbar__nav" :aria-label="t('nav.ariaLabel')">
      <a
        v-for="link in navigationLinks"
        :key="link.id"
        class="topbar__link"
        :href="`#${link.id}`"
      >
        {{ t(link.labelKey) }}
      </a>
    </nav>

    <div class="locale-switch" :aria-label="t('language.label')">
      <button
        class="locale-switch__button"
        :class="{ 'locale-switch__button--active': locale === 'en' }"
        type="button"
        @click="handleLocaleChange('en')"
      >
        EN
      </button>
      <button
        class="locale-switch__button"
        :class="{ 'locale-switch__button--active': locale === 'zh-CN' }"
        type="button"
        @click="handleLocaleChange('zh-CN')"
      >
        中文
      </button>
    </div>
  </header>
</template>
