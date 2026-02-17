<template>
  <div
    class="stat-badge-enhanced"
    :class="[
      `variant-${variant}`,
      health && `health-${health}`
    ]"
    :data-health="health"
    role="status"
    :aria-label="ariaLabel"
  >
    <component
      :is="icon"
      class="badge-icon"
      :size="12"
      :stroke-width="2.5"
      aria-hidden="true"
    />
    <span class="badge-value">{{ formattedValue }}</span>
    <span class="badge-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from '@vue/runtime-core';

export interface StatBadgeProps {
  icon: Component;
  value: number | string;
  label: string;
  delta?: {
    value: string;
    state: 'positive' | 'negative' | 'neutral';
  };
  sparklineData?: number[];
  health?: 'excellent' | 'good' | 'warning' | 'critical';
  variant?: 'primary' | 'secondary';
}

const props = withDefaults(defineProps<StatBadgeProps>(), {
  variant: 'secondary'
});

const sparklineWidth = 40;
const sparklineHeight = 16;

// Format number with appropriate suffix
const formatNumber = (value: number | string): string => {
  if (typeof value === 'string') return value;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

const formattedValue = computed(() => formatNumber(props.value));

// Generate smooth bezier curve path for sparkline
const generateSparklinePath = (
  data: number[],
  width: number = sparklineWidth,
  height: number = sparklineHeight
): string => {
  if (!data || data.length < 2) return '';

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - ((value - minValue) / range) * height
  }));

  // Create smooth bezier curve
  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` Q ${cpx},${prev.y} ${cpx},${(prev.y + curr.y) / 2}`;
    path += ` Q ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }

  return path;
};

const sparklinePath = computed(() => {
  if (!props.sparklineData || props.sparklineData.length === 0) {
    return '';
  }
  return generateSparklinePath(props.sparklineData, sparklineWidth, sparklineHeight);
});

// Describe trend for accessibility
const trendDescription = computed(() => {
  if (!props.sparklineData || props.sparklineData.length < 2) {
    return 'no data';
  }

  const firstValue = props.sparklineData[0];
  const lastValue = props.sparklineData[props.sparklineData.length - 1];

  if (lastValue > firstValue) {
    return 'upward trend';
  } else if (lastValue < firstValue) {
    return 'downward trend';
  }
  return 'stable trend';
});

// ARIA label for screen readers
const ariaLabel = computed(() => {
  let description = `${props.label}: ${formattedValue.value}`;

  if (props.delta) {
    description += `, ${props.delta.state} change of ${props.delta.value}`;
  }

  if (props.health) {
    description += `, health status: ${props.health}`;
  }

  if (props.sparklineData && props.sparklineData.length > 0) {
    description += `, ${trendDescription.value}`;
  }

  return description;
});
</script>

<style scoped>
.stat-badge-enhanced {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  min-height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg,
    var(--theme-bg-tertiary),
    var(--theme-bg-quaternary)
  );
  border: 1px solid var(--theme-border-primary);
  box-shadow: 0 1px 3px var(--theme-shadow);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
  user-select: none;
  will-change: transform, opacity;
}

.stat-badge-enhanced:hover {
  border-color: var(--theme-primary);
  box-shadow: 0 4px 12px var(--theme-shadow-lg);
  transform: translateY(-1px);
}

.stat-badge-enhanced:focus-visible {
  outline: 2px solid var(--theme-primary);
  outline-offset: 2px;
}

/* Primary variant (existing metrics) */
.variant-primary {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--theme-primary) 10%, transparent),
    color-mix(in srgb, var(--theme-primary-light) 10%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--theme-primary) 30%, transparent);
}

.variant-primary:hover {
  border-color: var(--theme-primary);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-primary) 20%, transparent);
}

/* Secondary variant (default) */
.variant-secondary {
  background: linear-gradient(135deg,
    var(--theme-bg-tertiary),
    var(--theme-bg-quaternary)
  );
}

/* Health states */
.health-excellent {
  border-color: var(--theme-accent-success);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent-success) 20%, transparent),
              0 1px 3px var(--theme-shadow);
}

.health-excellent:hover {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent-success) 30%, transparent),
              0 4px 12px var(--theme-shadow-lg);
}

.health-good {
  border-color: color-mix(in srgb, var(--theme-accent-success) 60%, transparent);
}

.health-warning {
  border-color: var(--theme-accent-warning);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent-warning) 20%, transparent),
              0 1px 3px var(--theme-shadow);
}

.health-warning:hover {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent-warning) 30%, transparent),
              0 4px 12px var(--theme-shadow-lg);
}

.health-critical {
  border-color: var(--theme-accent-error);
  animation: badge-pulse-warning 2s infinite;
}

@keyframes badge-pulse-warning {
  0%, 100% {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent-error) 20%, transparent),
                0 1px 3px var(--theme-shadow);
  }
  50% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent-error) 30%, transparent),
                0 2px 8px var(--theme-shadow-lg);
  }
}

.badge-icon {
  flex-shrink: 0;
  color: var(--theme-primary);
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.stat-badge-enhanced:hover .badge-icon {
  opacity: 1;
}

.badge-value {
  font-family: 'concourse-c3', monospace;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  color: var(--theme-text-primary);
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.badge-label {
  font-family: 'concourse-t3', sans-serif;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  color: var(--theme-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Mobile responsive adjustments */
@media (max-width: 640px) {
  .stat-badge-enhanced {
    padding: 3px 6px;
    gap: 3px;
  }

  .badge-value {
    font-size: 11px;
  }

  .badge-label {
    font-size: 8px;
  }
}

/* Touch-friendly hover states */
@media (hover: none) and (pointer: coarse) {
  .stat-badge-enhanced:hover {
    transform: none;
  }

  .stat-badge-enhanced:active {
    transform: scale(0.98);
    opacity: 0.9;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .stat-badge-enhanced {
    transition: none;
  }

  .health-critical {
    animation: none;
  }

  .badge-icon,
  .badge-delta,
  .badge-sparkline {
    transition: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .stat-badge-enhanced {
    border-width: 2px;
  }

  .badge-value {
    font-weight: 800;
  }
}
</style>
