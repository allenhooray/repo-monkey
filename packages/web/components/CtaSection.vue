<script setup lang="ts">
const { t } = useI18n();

const githubRepositoryUrl = 'https://github.com/allenhooray/repo-monkey';
const githubReleasesUrl = `${githubRepositoryUrl}/releases`;
</script>

<template>
  <section class="section-shell">
    <article class="glass-panel cta-card">
      <p class="eyebrow">{{ t('cta.eyebrow') }}</p>
      <h2>{{ t('cta.title') }}</h2>
      <p>{{ t('cta.body') }}</p>
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
    </article>
  </section>
</template>
