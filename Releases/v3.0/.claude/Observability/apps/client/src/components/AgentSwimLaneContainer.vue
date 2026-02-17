<template>
  <div v-if="selectedAgents.length > 0" class="swim-lane-container">
    <div class="lanes-wrapper">
      <AgentSwimLane
        v-for="agent in selectedAgents"
        :key="agent"
        :agent-name="agent"
        :events="events"
        :time-range="timeRange"
        @close="removeAgent(agent)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HookEvent, TimeRange } from '../types';
import AgentSwimLane from './AgentSwimLane.vue';

const props = defineProps<{
  selectedAgents: string[];
  events: HookEvent[];
  timeRange: TimeRange;
}>();

const emit = defineEmits<{
  'update:selectedAgents': [agents: string[]];
}>();

function removeAgent(agent: string) {
  const updated = props.selectedAgents.filter(a => a !== agent);
  emit('update:selectedAgents', updated);
}
</script>

<style scoped>
.swim-lane-container {
  width: 100%;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lanes-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
</style>
