<script setup lang="ts">
interface ScenarioItem {
  id: string;
}

const { t } = useI18n();

const scenarioItems: ScenarioItem[] = [
  { id: 'solo' },
  { id: 'team' },
  { id: 'ops' },
];
</script>

<template>
  <section id="scenarios" class="section-shell scenario-layout">
    <article class="glass-panel story-card">
      <p class="eyebrow">{{ t('scenarios.eyebrow') }}</p>
      <h2>{{ t('scenarios.title') }}</h2>
      <p>{{ t('scenarios.lead') }}</p>
      <div class="story-card__metrics">
        <div>
          <strong>{{ t('scenarios.metrics.traceable.value') }}</strong>
          <span>{{ t('scenarios.metrics.traceable.label') }}</span>
        </div>
        <div>
          <strong>{{ t('scenarios.metrics.clean.value') }}</strong>
          <span>{{ t('scenarios.metrics.clean.label') }}</span>
        </div>
      </div>
    </article>

    <div class="scenario-grid">
      <article
        v-for="item in scenarioItems"
        :key="item.id"
        class="glass-panel scenario-card"
      >
        <h3>{{ t(`scenarios.items.${item.id}.title`) }}</h3>
        <p>{{ t(`scenarios.items.${item.id}.body`) }}</p>
      </article>
    </div>
  </section>
</template>
