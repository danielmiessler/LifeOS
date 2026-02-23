<template>
  <div class="mini-widget">
    <div class="widget-header">
      <h3 class="widget-title">Agent Activity</h3>
      <Users :size="14" :stroke-width="2.5" class="widget-icon" />
    </div>
    <div class="widget-body">
      <div class="agent-list">
        <div
          v-for="(agent, index) in agentActivity.slice(0, 6)"
          :key="agent.agent"
          class="agent-col"
        >
          <div class="agent-header">
            <div class="agent-label">{{ agent.agent }}</div>
            <div class="agent-count">{{ agent.count }}</div>
          </div>
          <div class="agent-bar">
            <div
              class="agent-bar-fill"
              :class="`bar-color-${index % 5}`"
              :style="{ width: `${agent.percentage}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users } from 'lucide-vue-next';
import type { AgentActivity } from '../../composables/useAdvancedMetrics';

const props = defineProps<{
  agentActivity: AgentActivity[];
}>();
</script>

<style scoped>
@import './widget-base.css';

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  justify-content: space-around;
}

.agent-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}

.agent-label {
  font-size: 9px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.agent-bar {
  height: 10px;
  background: var(--theme-bg-tertiary);
  border-radius: 5px;
  overflow: hidden;
}

.agent-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  animation: shimmer 2s ease-in-out infinite;
}

.bar-color-0 {
  background: linear-gradient(90deg, rgba(122, 162, 247, 0.6) 0%, rgba(187, 154, 247, 0.5) 100%);
  box-shadow: 0 0 4px rgba(122, 162, 247, 0.2);
}

.bar-color-1 {
  background: linear-gradient(90deg, rgba(158, 206, 106, 0.6) 0%, rgba(115, 218, 202, 0.5) 100%);
  box-shadow: 0 0 4px rgba(158, 206, 106, 0.2);
}

.bar-color-2 {
  background: linear-gradient(90deg, rgba(247, 118, 142, 0.6) 0%, rgba(255, 158, 100, 0.5) 100%);
  box-shadow: 0 0 4px rgba(247, 118, 142, 0.2);
}

.bar-color-3 {
  background: linear-gradient(90deg, rgba(224, 175, 104, 0.6) 0%, rgba(255, 158, 100, 0.5) 100%);
  box-shadow: 0 0 4px rgba(224, 175, 104, 0.2);
}

.bar-color-4 {
  background: linear-gradient(90deg, rgba(187, 154, 247, 0.6) 0%, rgba(192, 202, 245, 0.5) 100%);
  box-shadow: 0 0 4px rgba(187, 154, 247, 0.2);
}

@keyframes shimmer {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.1);
  }
}

.agent-count {
  font-size: 10px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-primary);
  flex-shrink: 0;
}
</style>
