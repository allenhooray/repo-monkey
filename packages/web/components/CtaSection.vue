<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <section class="section-shell">
    <article class="glass-panel cta-card">
      <p class="eyebrow">{{ t('cta.eyebrow') }}</p>
      <h2>{{ t('cta.title') }}</h2>
      <p>{{ t('cta.body') }}</p>
      <div class="hero__actions">
        <a class="button button--primary" href="https://github.com" target="_blank" rel="noreferrer">
          {{ t('cta.primaryAction') }}
        </a>
        <a class="button button--ghost" href="#hero">
          {{ t('cta.secondaryAction') }}
        </a>
      </div>
    </article>
  </section>
</template>
