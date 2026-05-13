<script setup lang="ts">
interface WorkflowStep {
  id: string;
  step: string;
}

const { t } = useI18n();

const workflowSteps: WorkflowStep[] = [
  { id: 'connect', step: '01' },
  { id: 'sync', step: '02' },
  { id: 'edit', step: '03' },
  { id: 'release', step: '04' },
];
</script>

<template>
  <section id="workflow" class="section-shell workflow">
    <div class="section-heading">
      <p class="eyebrow">{{ t('workflow.eyebrow') }}</p>
      <h2>{{ t('workflow.title') }}</h2>
      <p>{{ t('workflow.lead') }}</p>
    </div>

    <div class="workflow__rail">
      <article
        v-for="step in workflowSteps"
        :key="step.id"
        class="workflow-step glass-panel"
      >
        <span class="workflow-step__id">{{ step.step }}</span>
        <h3>{{ t(`workflow.steps.${step.id}.title`) }}</h3>
        <p>{{ t(`workflow.steps.${step.id}.body`) }}</p>
      </article>
    </div>
  </section>
</template>
