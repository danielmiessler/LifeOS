<template>
  <div class="mini-widget">
    <div class="widget-header">
      <h3 class="widget-title">Token Usage</h3>
      <div class="header-controls">
        <select v-model="selectedTimeRange" class="time-range-selector">
          <option value="1h">1h</option>
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
          <option value="all">All</option>
        </select>
        <Coins :size="14" :stroke-width="2.5" class="widget-icon" />
      </div>
    </div>

    <div class="widget-body">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <Loader2 :size="16" class="spinner" />
        <span>Loading...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="isEmpty" class="empty-state">
        <Info :size="16" />
        <span>No token usage data yet</span>
      </div>

      <!-- Stats Display -->
      <div v-else class="stats-container">
        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-label">Total Tokens</div>
            <div class="summary-value">{{ formatNumber(stats.totalTokens) }}</div>
            <div class="summary-breakdown">
              <span class="breakdown-item">
                <ArrowDown :size="10" />
                {{ formatNumber(stats.totalInputTokens) }}
              </span>
              <span class="breakdown-item">
                <ArrowUp :size="10" />
                {{ formatNumber(stats.totalOutputTokens) }}
              </span>
            </div>
          </div>

          <div class="summary-card cost-card">
            <div class="summary-label">Total Cost</div>
            <div class="summary-value cost-value">${{ formatCost(stats.totalCost) }}</div>
            <div class="summary-breakdown">
              <span class="breakdown-item">
                {{ stats.entryCount }} request{{ stats.entryCount !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>
        </div>

        <!-- By Service -->
        <div class="section">
          <div class="section-header">
            <Server :size="10" />
            <span>By Service</span>
          </div>
          <div class="service-list">
            <div
              v-for="([service, data], index) in sortedServices"
              :key="service"
              class="service-item"
            >
              <div class="service-header">
                <span class="service-name">{{ service }}</span>
                <span class="service-cost">${{ formatCost(data.cost) }}</span>
              </div>
              <div class="service-bar">
                <div
                  class="service-bar-fill"
                  :style="{
                    width: `${(data.cost / stats.totalCost) * 100}%`,
                    backgroundColor: getServiceColor(service, index)
                  }"
                ></div>
              </div>
              <div class="service-meta">
                <span class="service-tokens">{{ formatNumber(data.tokens) }} tokens</span>
                <span class="service-count">{{ data.count }} calls</span>
              </div>
            </div>
          </div>
        </div>

        <!-- By Agent -->
        <div v-if="hasAgentData" class="section">
          <div class="section-header">
            <Bot :size="10" />
            <span>By Agent</span>
          </div>
          <div class="agent-list">
            <div
              v-for="([agent, data], index) in sortedAgents"
              :key="agent"
              class="agent-item"
            >
              <div class="agent-header">
                <span class="agent-name">{{ agent }}</span>
                <span class="agent-cost">${{ formatCost(data.cost) }}</span>
              </div>
              <div class="agent-meta">
                <span class="agent-tokens">{{ formatNumber(data.tokens) }} tokens</span>
                <span class="agent-count">{{ data.count }} calls</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Models -->
        <div class="section">
          <div class="section-header">
            <Cpu :size="10" />
            <span>Top Models</span>
          </div>
          <div class="model-list">
            <div
              v-for="[model, data] in sortedModels.slice(0, 5)"
              :key="model"
              class="model-item"
            >
              <span class="model-name">{{ model }}</span>
              <span class="model-count">{{ data.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Coins,
  Loader2,
  AlertCircle,
  Info,
  ArrowDown,
  ArrowUp,
  Server,
  Bot,
  Cpu
} from 'lucide-vue-next';

// Time range selection
const selectedTimeRange = ref<string>('24h');
const loading = ref(false);
const error = ref<string | null>(null);

// Stats data
interface Stats {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byService: Record<string, { tokens: number; cost: number; count: number }>;
  byModel: Record<string, { tokens: number; cost: number; count: number }>;
  byAgent: Record<string, { tokens: number; cost: number; count: number }>;
  entryCount: number;
}

const stats = ref<Stats>({
  totalTokens: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
  byService: {},
  byModel: {},
  byAgent: {},
  entryCount: 0
});

// Service colors
const serviceColors = [
  '#7aa2f7', // Blue
  '#9ece6a', // Green
  '#e0af68', // Yellow
  '#bb9af7', // Purple
  '#f7768e', // Red
  '#73daca', // Teal
  '#ff9e64', // Orange
];

function getServiceColor(service: string, index: number): string {
  return serviceColors[index % serviceColors.length];
}

// Computed properties
const isEmpty = computed(() => stats.value.entryCount === 0);

const hasAgentData = computed(() => Object.keys(stats.value.byAgent).length > 0);

const sortedServices = computed(() => {
  return Object.entries(stats.value.byService)
    .sort(([, a], [, b]) => b.cost - a.cost);
});

const sortedAgents = computed(() => {
  return Object.entries(stats.value.byAgent)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 5); // Top 5 agents
});

const sortedModels = computed(() => {
  return Object.entries(stats.value.byModel)
    .sort(([, a], [, b]) => b.count - a.count);
});

// Format numbers
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Format cost
function formatCost(cost: number): string {
  if (cost === 0) return '0.00';
  if (cost < 0.01) return cost.toFixed(4);
  if (cost < 1) return cost.toFixed(3);
  return cost.toFixed(2);
}

// Fetch stats from API
async function fetchStats() {
  loading.value = true;
  error.value = null;

  try {
    const timeRangeParam = selectedTimeRange.value === 'all'
      ? ''
      : `?timeRange=${selectedTimeRange.value}`;

    const response = await fetch(`http://localhost:4000/api/token-usage/stats${timeRangeParam}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      stats.value = result.data;
    } else {
      error.value = result.error || 'Failed to fetch stats';
    }
  } catch (err) {
    console.error('Error fetching token usage stats:', err);
    error.value = 'Failed to connect to server';
  } finally {
    loading.value = false;
  }
}

// Watch time range changes
watch(selectedTimeRange, () => {
  fetchStats();
});

// Initial load
onMounted(() => {
  fetchStats();

  // Refresh every 30 seconds
  const interval = setInterval(fetchStats, 30000);

  // Cleanup on unmount
  return () => clearInterval(interval);
});
</script>

<style scoped>
@import './widget-base.css';

.header-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-range-selector {
  font-size: 9px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  color: var(--theme-text-primary);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.time-range-selector:hover {
  background: var(--theme-bg-quaternary);
  border-color: var(--theme-primary);
}

.time-range-selector:focus {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.1);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  font-size: 10px;
  color: var(--theme-text-tertiary);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-state {
  color: rgba(247, 118, 142, 1);
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.summary-card {
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-card.cost-card {
  background: linear-gradient(135deg, rgba(122, 162, 247, 0.05) 0%, rgba(158, 206, 106, 0.05) 100%);
  border-color: rgba(122, 162, 247, 0.3);
}

.summary-label {
  font-size: 8px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-primary);
  line-height: 1;
}

.summary-value.cost-value {
  color: var(--theme-primary);
}

.summary-breakdown {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 8px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-tertiary);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--theme-border-secondary);
}

.service-list,
.agent-list,
.model-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-item,
.agent-item,
.model-item {
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.service-item:hover,
.agent-item:hover,
.model-item:hover {
  background: var(--theme-bg-tertiary);
}

.service-header,
.agent-header,
.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.service-name,
.agent-name,
.model-name {
  font-size: 9px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-primary);
  text-transform: capitalize;
}

.service-cost,
.agent-cost {
  font-size: 9px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-primary);
}

.service-bar {
  height: 3px;
  background: var(--theme-bg-quaternary);
  border-radius: 2px;
  overflow: hidden;
  margin: 2px 0;
}

.service-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.service-meta,
.agent-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 7px;
  font-weight: 500;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-tertiary);
}

.model-count {
  font-size: 9px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-secondary);
  background: var(--theme-bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
