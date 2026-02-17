import { computed, type Ref } from 'vue';

/**
 * Heat level intensity indicator composable
 *
 * Provides a 0-1 intensity value based on real-time activity metrics.
 * Uses events per minute with logarithmic thresholds: 4, 8, 16, 32, 64, 128
 *
 * Color scale (Tokyo Night compatible, accessible):
 * - Cold:   #565f89 (storm gray) - 0-4 ev/min
 * - Cool:   #7aa2f7 (blue) - 4-8 ev/min
 * - Warm:   #9d7cd8 (purple) - 8-16 ev/min
 * - Hot:    #e0af68 (amber) - 16-32 ev/min
 * - Fire:   #f7768e (red) - 32-64 ev/min
 * - Inferno:#ff5555 (bright red) - 64-128+ ev/min
 */

export interface HeatLevelConfig {
  // Thresholds for active agents
  activeAgentsLow: number;
  activeAgentsHigh: number;
}

export interface HeatLevel {
  intensity: Ref<number>;        // 0.0 to 1.0
  color: Ref<string>;            // Current hex color
  label: Ref<string>;            // Human readable label
  eventsContribution: Ref<number>; // How much events/min contributes (0-1)
  agentsContribution: Ref<number>; // How much active agents contributes (0-1)
}

const DEFAULT_CONFIG: HeatLevelConfig = {
  activeAgentsLow: 1,
  activeAgentsHigh: 5,
};

// Logarithmic thresholds: 4, 8, 16, 32, 64, 128
const HEAT_THRESHOLDS = [4, 8, 16, 32, 64, 128];

// Tokyo Night color scale for heat levels
const HEAT_COLORS = {
  cold: '#565f89',     // Storm gray (0-4)
  cool: '#7aa2f7',     // Blue (4-8)
  warm: '#9d7cd8',     // Purple (8-16)
  hot: '#e0af68',      // Amber (16-32)
  fire: '#f7768e',     // Red (32-64)
  inferno: '#ff5555',  // Bright red (64-128+)
};

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);

  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Get heat level index based on events per minute
 * Thresholds: 4, 8, 16, 32, 64, 128
 */
function getHeatIndex(epm: number): number {
  for (let i = 0; i < HEAT_THRESHOLDS.length; i++) {
    if (epm < HEAT_THRESHOLDS[i]) return i;
  }
  return HEAT_THRESHOLDS.length; // Above 128
}

/**
 * Get color array for interpolation
 */
const COLOR_ARRAY = [
  HEAT_COLORS.cold,    // 0-4
  HEAT_COLORS.cool,    // 4-8
  HEAT_COLORS.warm,    // 8-16
  HEAT_COLORS.hot,     // 16-32
  HEAT_COLORS.fire,    // 32-64
  HEAT_COLORS.inferno, // 64-128+
];

/**
 * Calculate heat level based on activity metrics
 *
 * @param eventsPerMinute - Current events per minute (from useAdvancedMetrics)
 * @param activeAgentCount - Number of active agents (from agentActivity.length)
 * @param config - Optional threshold configuration
 */
export function useHeatLevel(
  eventsPerMinute: Ref<number>,
  activeAgentCount: Ref<number>,
  config: Partial<HeatLevelConfig> = {}
): HeatLevel {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Calculate events contribution based on logarithmic thresholds
  const eventsContribution = computed(() => {
    const epm = eventsPerMinute.value;
    if (epm <= 0) return 0;
    if (epm >= 128) return 1;
    // Logarithmic scale: 4, 8, 16, 32, 64, 128
    return Math.log2(Math.max(1, epm)) / Math.log2(128);
  });

  // Calculate agents contribution (0-1)
  const agentsContribution = computed(() => {
    const agents = activeAgentCount.value;
    if (agents <= cfg.activeAgentsLow) return 0;
    if (agents >= cfg.activeAgentsHigh) return 1;
    return (agents - cfg.activeAgentsLow) / (cfg.activeAgentsHigh - cfg.activeAgentsLow);
  });

  // Combined intensity (weighted: 85% events, 15% agents for faster color change)
  const intensity = computed(() => {
    const combined = (eventsContribution.value * 0.85) + (agentsContribution.value * 0.15);
    return Math.min(1, Math.max(0, combined));
  });

  // Map events per minute to color using thresholds
  const color = computed(() => {
    const epm = eventsPerMinute.value;
    const idx = getHeatIndex(epm);

    if (idx === 0) {
      // Below first threshold - cold
      const factor = epm / HEAT_THRESHOLDS[0];
      return interpolateColor(HEAT_COLORS.cold, HEAT_COLORS.cool, factor);
    } else if (idx >= COLOR_ARRAY.length) {
      // Above max threshold - inferno
      return HEAT_COLORS.inferno;
    } else {
      // Interpolate between thresholds
      const lowerThreshold = HEAT_THRESHOLDS[idx - 1];
      const upperThreshold = HEAT_THRESHOLDS[idx];
      const factor = (epm - lowerThreshold) / (upperThreshold - lowerThreshold);
      return interpolateColor(COLOR_ARRAY[idx - 1], COLOR_ARRAY[idx], factor);
    }
  });

  // Human readable label based on thresholds
  const label = computed(() => {
    const epm = eventsPerMinute.value;
    if (epm < 4) return 'Cold';
    if (epm < 8) return 'Cool';
    if (epm < 16) return 'Warm';
    if (epm < 32) return 'Hot';
    if (epm < 64) return 'Fire';
    return 'Inferno';
  });

  return {
    intensity,
    color,
    label,
    eventsContribution,
    agentsContribution,
  };
}
