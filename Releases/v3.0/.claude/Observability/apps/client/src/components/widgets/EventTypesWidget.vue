<template>
  <div class="mini-widget">
    <div class="widget-header">
      <h3 class="widget-title">Active Skills</h3>
      <Layers :size="14" :stroke-width="2.5" class="widget-icon" />
    </div>
    <div class="widget-body">
      <div class="skills-list">
        <div
          v-for="skill in activeSkills"
          :key="skill.name"
          class="skill-item"
        >
          <div class="skill-icon">{{ skill.icon }}</div>
          <span class="skill-name">{{ skill.name }}</span>
          <span class="skill-count">{{ skill.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Layers } from 'lucide-vue-next';

const props = defineProps<{
  events: any[];
}>();

// Skill icons mapping
const skillIcons: Record<string, string> = {
  'system': '⚙️',
  'research': '🔍',
  'writing': '✍️',
  'blogging': '📝',
  'social': '📱',
  'development': '💻',
  'media': '🎨',
  'business': '💼',
  'be-creative': '✨',
  'personal': '👤',
  'telos': '🎯',
  'security': '🔒',
  'default': '🔧'
};

// Extract active skills from events
const activeSkills = computed(() => {
  const skillCounts = new Map<string, number>();

  // Count events per skill
  props.events.forEach(event => {
    // Try multiple ways to extract skill information
    const skill =
      event.payload?.skill ||
      'core';

    if (skill && skill !== 'unknown') {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    }
  });

  // Convert to array and sort by count
  return Array.from(skillCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      icon: skillIcons[name] || skillIcons['default']
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
});
</script>

<style scoped>
@import './widget-base.css';

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  height: 100%;
  overflow-y: auto;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-primary);
  transition: all 0.2s ease;
}

.skill-item:hover {
  background: var(--theme-bg-tertiary);
  border-color: color-mix(in srgb, var(--theme-primary) 50%, transparent);
  transform: translateX(2px);
}

.skill-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.skill-name {
  font-size: 10px;
  font-weight: 600;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.skill-count {
  font-size: 10px;
  font-weight: 700;
  font-family: 'concourse-c3', monospace;
  color: var(--theme-primary);
  flex-shrink: 0;
}
</style>
