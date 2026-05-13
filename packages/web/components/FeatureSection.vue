<script setup lang="ts">
interface FeatureItem {
  id: string;
  number: string;
}

const { t } = useI18n();

const featureItems: FeatureItem[] = [
  { id: 'repo', number: '01' },
  { id: 'sync', number: '02' },
  { id: 'edit', number: '03' },
  { id: 'ship', number: '04' },
];
</script>

<template>
  <section id="capabilities" class="section-shell section-grid">
    <div class="section-heading">
      <p class="eyebrow">{{ t('features.eyebrow') }}</p>
      <h2>{{ t('features.title') }}</h2>
      <p>{{ t('features.lead') }}</p>
    </div>

    <div class="feature-grid">
      <article
        v-for="item in featureItems"
        :key="item.id"
        class="feature-card glass-panel"
      >
        <span class="feature-card__number">{{ item.number }}</span>
        <h3>{{ t(`features.items.${item.id}.title`) }}</h3>
        <p>{{ t(`features.items.${item.id}.body`) }}</p>
      </article>
    </div>
  </section>
</template>
