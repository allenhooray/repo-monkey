const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;
const FALLBACK_LOCALE = 'en';
const MANUAL_LOCALE_STORAGE_KEY = 'repo-monkey-manual-locale';
const LEGACY_LOCALE_STORAGE_KEY = 'repo-monkey-locale';

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Narrows an arbitrary locale string to the locales supported by the website.
 */
function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  if (!locale) {
    return FALLBACK_LOCALE;
  }

  const loweredLocale = locale.toLowerCase();

  // Treat every Chinese variant as Simplified Chinese for the marketing site.
  if (loweredLocale.startsWith('zh')) {
    return 'zh-CN';
  }

  if (loweredLocale.startsWith('en')) {
    return 'en';
  }

  return FALLBACK_LOCALE;
}

/**
 * Checks whether a stored locale maps directly to a supported site locale.
 */
function isSupportedStoredLocale(locale: string | null): locale is SupportedLocale {
  return locale === 'en' || locale === 'zh-CN';
}

/**
 * Picks the first supported locale from the browser language preference list.
 */
function detectBrowserLocale(locales: readonly string[]): SupportedLocale {
  for (const locale of locales) {
    const normalizedLocale = normalizeLocale(locale);
    if (normalizedLocale !== FALLBACK_LOCALE || locale.toLowerCase().startsWith('en')) {
      return normalizedLocale;
    }
  }

  return FALLBACK_LOCALE;
}

/**
 * Resolves the locale chosen manually or inferred from browser preferences.
 */
function resolvePreferredLocale(): SupportedLocale {
  let storedLocale = window.localStorage.getItem(MANUAL_LOCALE_STORAGE_KEY);

  if (!isSupportedStoredLocale(storedLocale)) {
    const legacyLocale = window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    if (isSupportedStoredLocale(legacyLocale)) {
      storedLocale = legacyLocale;
      window.localStorage.setItem(MANUAL_LOCALE_STORAGE_KEY, legacyLocale);
    }
  }

  const browserLocales = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];

  return storedLocale
    ? normalizeLocale(storedLocale)
    : detectBrowserLocale(browserLocales);
}

/**
 * Detects the preferred locale after Nuxt i18n finishes its own setup.
 */
export default defineNuxtPlugin({
  name: 'repo-monkey:locale-detect',
  dependsOn: ['i18n:plugin', 'i18n:plugin:ssg-detect'],
  enforce: 'post',
  async setup(nuxtApp) {
    const { locale, setLocale } = useI18n();

    async function applyPreferredLocale(): Promise<void> {
      const nextLocale = resolvePreferredLocale();
      if (locale.value !== nextLocale) {
        await setLocale(nextLocale);
      }
    }

    await applyPreferredLocale();
    nuxtApp.hook('app:mounted', applyPreferredLocale);
  },
});
