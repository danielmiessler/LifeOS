<template>
  <div class="mini-widget">
    <div class="widget-header">
      <h3 class="widget-title">Buffer Stats</h3>
      <Activity :size="14" :stroke-width="2.5" class="widget-icon" />
    </div>
    <div class="widget-body">
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Events</span>
          <span class="stat-value">{{ bufferStats.totalEvents }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Time Span</span>
          <span class="stat-value">{{ bufferStats.timeSpan }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Oldest</span>
          <span class="stat-value">{{ bufferStats.oldestAge }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Rate</span>
          <span class="stat-value">{{ bufferStats.eventRate }}/min</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Sessions</span>
          <span class="stat-value">{{ bufferStats.sessionCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Buffer</span>
          <span class="stat-value" :class="bufferStats.bufferHealthClass">{{ bufferStats.bufferHealth }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Activity } from 'lucide-vue-next';

const props = defineProps<{
  activeSessions: number;
  events: any[];
}>();

// Format duration string
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Calculate buffer statistics
const bufferStats = computed(() => {
  const totalEvents = props.events.length;

  if (totalEvents === 0) {
    return {
      totalEvents: 0,
      timeSpan: '-',
      oldestAge: '-',
      eventRate: '0.0',
      sessionCount: 0,
      bufferHealth: 'Empty',
      bufferHealthClass: 'health-warning'
    };
  }

  // Get oldest and newest timestamps
  const timestamps = props.events.map(e => e.timestamp).filter(Boolean);
  const oldestTimestamp = Math.min(...timestamps);
  const newestTimestamp = Math.max(...timestamps);

  const timeSpanMs = newestTimestamp - oldestTimestamp;
  const oldestAgeMs = Date.now() - oldestTimestamp;

  // Calculate event rate (events per minute over the time span)
  const timeSpanMinutes = timeSpanMs / (60 * 1000);
  const eventRate = timeSpanMinutes > 0
    ? (totalEvents / timeSpanMinutes).toFixed(1)
    : '0.0';

  // Count unique sessions
  const uniqueSessions = new Set(
    props.events.map(e => e.session_id).filter(Boolean)
  );

  // Determine buffer health
  let bufferHealth = 'Good';
  let bufferHealthClass = 'health-good';

  if (totalEvents > 8000) {
    bufferHealth = 'Full';
    bufferHealthClass = 'health-critical';
  } else if (totalEvents > 5000) {
    bufferHealth = 'High';
    bufferHealthClass = 'health-warning';
  }

  return {
    totalEvents: totalEvents.toLocaleString(),
    timeSpan: formatDuration(timeSpanMs),
    oldestAge: formatDuration(oldestAgeMs),
    eventRate,
    sessionCount: uniqueSessions.size,
    bufferHealth,
    bufferHealthClass
  };
});
</script>

<style scoped>
@import './widget-base.css';

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  height: 100%;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--theme-bg-secondary);
  transition: background 0.2s ease;
}

.stat-item:hover {
  background: var(--theme-bg-tertiary);
}

.stat-label {
  font-size: 7px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stat-value {
  font-size: 11px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-primary);
  line-height: 1;
}

.health-good {
  color: rgba(158, 206, 106, 1);
}

.health-warning {
  color: rgba(224, 175, 104, 1);
}

.health-critical {
  color: rgba(247, 118, 142, 1);
}
</style>
