<script setup lang="ts">
const { t } = useI18n();

const githubRepositoryUrl = 'https://github.com/allenhooray/repo-monkey';
const githubReleasesUrl = `${githubRepositoryUrl}/releases`;
</script>

<template>
  <section id="hero" class="hero section-shell">
    <div class="hero__copy">
      <p class="eyebrow">{{ t('hero.eyebrow') }}</p>
      <h1>{{ t('hero.title') }}</h1>
      <p class="hero__lead">{{ t('hero.lead') }}</p>

      <div class="hero__actions">
        <span class="button button--disabled" role="link" aria-disabled="true">
          {{ t('downloads.storeAction') }}
        </span>
        <a class="button button--primary" :href="githubReleasesUrl" target="_blank" rel="noreferrer">
          {{ t('downloads.releasesAction') }}
        </a>
        <a class="button button--ghost" :href="githubRepositoryUrl" target="_blank" rel="noreferrer">
          {{ t('downloads.repositoryAction') }}
        </a>
      </div>
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
