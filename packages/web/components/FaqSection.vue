<script setup lang="ts">
interface FaqItem {
  id: string;
}

const { t } = useI18n();

const faqItems: FaqItem[] = [
  { id: 'what' },
  { id: 'where' },
  { id: 'permission' },
  { id: 'who' },
];
</script>

<template>
  <section id="faq" class="section-shell faq-layout">
    <div class="section-heading">
      <p class="eyebrow">{{ t('faq.eyebrow') }}</p>
      <h2>{{ t('faq.title') }}</h2>
      <p>{{ t('faq.lead') }}</p>
    </div>

    <div class="faq-grid">
      <article v-for="item in faqItems" :key="item.id" class="glass-panel faq-card">
        <h3>{{ t(`faq.items.${item.id}.question`) }}</h3>
        <p>{{ t(`faq.items.${item.id}.answer`) }}</p>
      </article>
    </div>
  </section>
</template>
