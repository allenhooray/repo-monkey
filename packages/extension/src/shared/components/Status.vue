<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  type?: 'success' | 'error' | 'loading' | '';
}

const props = withDefaults(defineProps<Props>(), {
  type: '',
});

const statusClass = computed(() => {
  return ['status-line', props.type].filter(Boolean);
});
</script>

<template>
  <div v-if="$slots.default" :class="statusClass">
    <slot />
  </div>
</template>

<style scoped>
.status-line {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.status-line.success {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.status-line.error {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.status-line.loading {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.3);
}
</style>
