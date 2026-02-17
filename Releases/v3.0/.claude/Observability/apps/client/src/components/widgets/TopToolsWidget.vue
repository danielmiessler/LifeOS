<template>
  <div class="mini-widget">
    <div class="widget-header">
      <h3 class="widget-title">Tool Performance</h3>
      <Wrench :size="14" :stroke-width="2.5" class="widget-icon" />
    </div>
    <div class="widget-body">
      <div class="tool-grid">
        <div
          v-for="tool in topTools"
          :key="tool.tool"
          class="tool-item"
          :class="{
            'has-errors': tool.hasErrors,
            'is-slow': tool.isSlow
          }"
          :title="getToolTitle(tool)"
        >
          <component
            :is="getToolIcon(tool.tool)"
            :size="12"
            :stroke-width="2"
            class="tool-icon"
          />
          <div class="tool-info">
            <span class="tool-name">{{ tool.tool }}</span>
            <span v-if="tool.skill" class="tool-skill">{{ tool.skill }}</span>
          </div>
          <component
            v-if="tool.healthIndicator && getHealthIcon(tool.healthIndicator)"
            :is="getHealthIcon(tool.healthIndicator)"
            :size="11"
            :stroke-width="2"
            class="tool-health-icon"
            :class="{
              'health-error': tool.hasErrors,
              'health-slow': tool.isSlow
            }"
          />
          <span class="tool-count">{{ tool.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from '@vue/runtime-core';
import {
  Wrench,
  FileText,
  PenTool,
  Edit3,
  Terminal,
  Search,
  FolderSearch,
  Users,
  Globe,
  Compass,
  Zap,
  Command,
  CheckSquare,
  MessageCircleQuestion,
  BookOpen,
  Settings,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Code,
  FileCode,
  FilePlus,
  Eye,
  Package
} from 'lucide-vue-next';
import type { ToolUsage } from '../../composables/useAdvancedMetrics';

const props = defineProps<{
  topTools: ToolUsage[];
}>();

// Icon mapping for each tool
const toolIcons: Record<string, Component> = {
  'Read': Eye,
  'Write': FilePlus,
  'Edit': Edit3,
  'Bash': Terminal,
  'Grep': Search,
  'Glob': FolderSearch,
  'Task': Users,
  'WebFetch': Globe,
  'WebSearch': Compass,
  'Skill': Zap,
  'SlashCommand': Command,
  'TodoWrite': CheckSquare,
  'AskUserQuestion': MessageCircleQuestion,
  'NotebookEdit': BookOpen,
  'NotebookRead': FileText,
  'BashOutput': Terminal,
  'KillShell': Terminal,
  'ExitPlanMode': CheckCircle2,
  'mcp__Chrome__take_snapshot': Eye,
  'mcp__Chrome__click': Package,
  'mcp__Chrome__navigate_page': Globe,
  'mcp__Apify__search-actors': Search,
  'mcp__content__find_post': FileText,
  'default': Code
};

// Health indicator icons
const healthIcons = {
  '✅': CheckCircle2,
  '⚠️': AlertTriangle,
  '🐌': Clock
};

const maxToolCount = computed(() =>
  Math.max(...props.topTools.map(t => t.count), 1)
);

// Get icon component for a tool
function getToolIcon(toolName: string): Component {
  return toolIcons[toolName] || toolIcons['default'];
}

// Get health icon component
function getHealthIcon(indicator: string): Component | null {
  return healthIcons[indicator] || null;
}

// Generate detailed tooltip for each tool
function getToolTitle(tool: ToolUsage): string {
  const parts = [tool.tool];

  if (tool.skill) {
    parts.push(`Skill: ${tool.skill}`);
  }

  parts.push(`Count: ${tool.count}`);

  if (tool.successRate !== undefined) {
    parts.push(`Success: ${tool.successRate}%`);
  }

  if (tool.hasErrors) {
    parts.push('Has errors');
  }

  if (tool.isSlow) {
    parts.push('Slow performance');
  }

  return parts.join(' • ');
}
</script>

<style scoped>
@import './widget-base.css';

.tool-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px 6px;
  height: 100%;
  align-content: start;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.tool-item:hover {
  background: var(--theme-bg-tertiary);
}

.tool-item.has-errors {
  background: rgba(247, 118, 142, 0.1);
  border: 1px solid rgba(247, 118, 142, 0.2);
}

.tool-item.is-slow {
  background: rgba(224, 175, 104, 0.1);
  border: 1px solid rgba(224, 175, 104, 0.2);
}

.tool-icon {
  flex-shrink: 0;
  color: var(--theme-text-tertiary);
  opacity: 0.8;
}

.tool-health-icon {
  flex-shrink: 0;
  margin-left: auto;
}

.tool-health-icon.health-error {
  color: rgba(247, 118, 142, 1);
}

.tool-health-icon.health-slow {
  color: rgba(224, 175, 104, 1);
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: 9px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-skill {
  font-size: 7px;
  font-weight: 500;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-count {
  font-size: 10px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-primary);
  flex-shrink: 0;
}
</style>
