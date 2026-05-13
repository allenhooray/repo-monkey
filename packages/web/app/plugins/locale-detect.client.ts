const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;
const FALLBACK_LOCALE = 'en';
const LOCALE_STORAGE_KEY = 'repo-monkey-locale';

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
 * Detects and persists the preferred locale on the client after hydration.
 */
export default defineNuxtPlugin(async () => {
  const { locale, setLocale } = useI18n();
  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const nextLocale = normalizeLocale(storedLocale ?? window.navigator.language);

  if (locale.value !== nextLocale) {
    await setLocale(nextLocale);
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
});
