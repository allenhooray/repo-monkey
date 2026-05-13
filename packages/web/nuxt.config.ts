/**
 * Nuxt configuration for the Repo Monkey marketing website.
 */
export default defineNuxtConfig({
  compatibilityDate: '2026-05-13',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  modules: ['@nuxtjs/i18n'],
  app: {
    head: {
      title: 'Repo Monkey',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
      ],
    },
  },
  nitro: {
    prerender: {
      routes: ['/'],
    },
  },
  i18n: {
    defaultLocale: 'en',
    detectBrowserLanguage: false,
    lazy: true,
    langDir: 'locales',
    strategy: 'no_prefix',
    bundle: {
      optimizeTranslationDirective: false,
    },
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
      { code: 'zh-CN', language: 'zh-CN', file: 'zh-CN.json', name: '简体中文' },
    ],
    vueI18n: './i18n.config.ts',
  },
});
