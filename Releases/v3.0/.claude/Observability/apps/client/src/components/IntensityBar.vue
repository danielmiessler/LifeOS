<template>
  <div class="intensity-bar-wrapper">
    <!-- Events per minute counter -->
    <div class="events-counter" :style="{ color: color }">
      <span class="events-value">{{ eventsPerMinute }}</span>
      <span class="events-label">ev/min</span>
    </div>

    <!-- The intensity bar -->
    <div class="intensity-bar-container">
      <div
        class="intensity-bar"
        :style="{ backgroundColor: color, width: `${Math.max(5, intensity * 100)}%` }"
        :title="`Activity: ${label} (${Math.round(intensity * 100)}%)`"
      >
        <!-- Gradient overlay for depth -->
        <div class="intensity-gradient"></div>
      </div>

      <!-- Optional label tooltip on hover -->
      <div class="intensity-tooltip" v-if="showTooltip">
        <span class="intensity-value">{{ Math.round(intensity * 100) }}%</span>
        <span class="intensity-label">{{ label }}</span>
      </div>
    </div>

    <!-- Time Range Selector -->
    <div v-if="timeRanges && timeRanges.length > 0" class="time-range-selector">
      <button
        v-for="range in timeRanges"
        :key="range"
        @click="$emit('setTimeRange', range)"
        class="time-range-btn"
        :class="{ active: timeRange === range }"
        :style="timeRange === range ? { backgroundColor: color, color: getContrastColor(color) } : {}"
      >
        {{ range }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue';

const props = withDefaults(defineProps<{
  intensity: number;      // 0.0 to 1.0
  color: string;          // Hex color
  label: string;          // "Cold", "Cool", "Warm", "Hot", "Fire", "Inferno"
  eventsPerMinute: number; // Events per minute count
  showTooltip?: boolean;
  timeRange?: string;     // Current time range (e.g., '1M', '2M')
  timeRanges?: string[];  // Available time ranges
}>(), {
  showTooltip: false,
  eventsPerMinute: 0,
  timeRange: '1M',
  timeRanges: () => []
});

defineEmits<{
  (e: 'setTimeRange', range: string): void;
}>();

const { intensity, color, label, eventsPerMinute, timeRange, timeRanges } = toRefs(props);

// Get contrasting text color for readability
function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, dark for light backgrounds
  return luminance > 0.5 ? '#1a1b26' : '#ffffff';
}
</script>

<style scoped>
.intensity-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
}

.events-counter {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  transition: color 2s ease-in-out;
}

.events-value {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.events-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
  text-transform: uppercase;
}

.intensity-bar-container {
  position: relative;
  flex: 1;
  height: 4px;
  background: var(--theme-bg-tertiary, #1a1b26);
  overflow: hidden;
  border-radius: 2px;
}

.intensity-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: background-color 2s ease-in-out, width 0.5s ease-out;
  border-radius: 2px;
}

.intensity-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}

.intensity-tooltip {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--theme-bg-secondary, #24283b);
  border: 1px solid var(--theme-border-primary, #414868);
  border-radius: 4px;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.intensity-bar-container:hover .intensity-tooltip {
  opacity: 1;
}

.intensity-value {
  font-weight: 600;
  color: var(--theme-text-primary, #c0caf5);
}

.intensity-label {
  color: var(--theme-text-secondary, #565f89);
}

.time-range-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.time-range-btn {
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--theme-text-tertiary, #565f89);
  cursor: pointer;
  transition: all 0.2s ease;
}

.time-range-btn:hover {
  color: var(--theme-text-secondary, #9aa5ce);
  background: var(--theme-bg-tertiary, #1a1b26);
}

.time-range-btn.active {
  /* Color set dynamically via :style binding */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
