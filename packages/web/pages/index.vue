<script setup lang="ts">
const { locale, t } = useI18n();

const seoTitle = computed(() => t('seo.title'));
const seoDescription = computed(() => t('seo.description'));

useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
  },
}));

useSeoMeta({
  title: seoTitle,
  ogTitle: seoTitle,
  description: seoDescription,
  ogDescription: seoDescription,
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
});
</script>

<template>
  <main>
    <SiteHeader />
    <HeroSection />
    <FeatureSection />
    <ScenarioSection />
    <CtaSection />
    <SiteFooter />
  </main>
</template>
