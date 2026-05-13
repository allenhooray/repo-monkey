<script setup lang="ts">
const { t } = useI18n();

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="section-shell footer">
    <p>{{ t('footer.copy') }}</p>
    <p>{{ t('footer.meta', { year: currentYear }) }}</p>
  </footer>
</template>
