import { ref, computed } from 'vue';
import enMessages from '../../public/_locales/en/messages.json';
import zhMessages from '../../public/_locales/zh_CN/messages.json';
import type { Locale } from './types';

type MessagesFile = Record<string, { message: string; description?: string }>;

const dictionaries: Record<Locale, MessagesFile> = {
  en: enMessages as MessagesFile,
  zh_CN: zhMessages as MessagesFile,
};

const DEFAULT_LOCALE: Locale = 'en';

function detectBrowserLocale(): Locale {
  try {
    const uiLang = chrome.i18n.getUILanguage();
    if (uiLang && uiLang.toLowerCase().startsWith('zh')) return 'zh_CN';
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

export const currentLocale = ref<Locale>(detectBrowserLocale());

export function setLocale(locale: Locale): void {
  currentLocale.value = locale;
}

export function t(key: string): string {
  const dict = dictionaries[currentLocale.value] ?? dictionaries[DEFAULT_LOCALE];
  const entry = dict[key];
  if (entry?.message) return entry.message;
  const fallback = dictionaries[DEFAULT_LOCALE][key];
  return fallback?.message ?? key;
}

export const availableLocales: { value: Locale; labelKey: string }[] = [
  { value: 'en', labelKey: 'english' },
  { value: 'zh_CN', labelKey: 'chineseSimplified' },
];

export const tRef = (key: string) => computed(() => t(key));
