<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <section id="hero" class="hero section-shell">
    <div class="hero__copy">
      <p class="eyebrow">{{ t('hero.eyebrow') }}</p>
      <h1>{{ t('hero.title') }}</h1>
      <p class="hero__lead">{{ t('hero.lead') }}</p>

      <div class="hero__actions">
        <a class="button button--primary" href="#workflow">
          {{ t('hero.primaryAction') }}
        </a>
        <a class="button button--ghost" href="#faq">
          {{ t('hero.secondaryAction') }}
        </a>
      </div>

      <ul class="hero__signals" :aria-label="t('hero.signalLabel')">
        <li>{{ t('hero.signals.repo') }}</li>
        <li>{{ t('hero.signals.diff') }}</li>
        <li>{{ t('hero.signals.runtime') }}</li>
      </ul>
    </div>

    <div class="hero__visual">
      <article class="glass-panel cockpit-card cockpit-card--primary">
        <p class="cockpit-card__label">{{ t('hero.primaryPanel.label') }}</p>
        <h2>{{ t('hero.primaryPanel.title') }}</h2>
        <p>{{ t('hero.primaryPanel.body') }}</p>
        <div class="terminal-list">
          <span>{{ t('hero.primaryPanel.points.one') }}</span>
          <span>{{ t('hero.primaryPanel.points.two') }}</span>
          <span>{{ t('hero.primaryPanel.points.three') }}</span>
        </div>
      </article>

      <article class="glass-panel cockpit-card cockpit-card--secondary">
        <p class="cockpit-card__label">{{ t('hero.secondaryPanel.label') }}</p>
        <h2>{{ t('hero.secondaryPanel.title') }}</h2>
        <p>{{ t('hero.secondaryPanel.body') }}</p>
      </article>
    </div>
  </section>
</template>
