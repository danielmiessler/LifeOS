<template>
  <div class="mx-4 mt-4 mobile:mx-2 mobile:mt-2">
    <div class="glass-panel rounded-2xl p-2 flex gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('set-tab', tab.id)"
        class="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
        :class="[
          activeTab === tab.id
            ? 'bg-[var(--theme-accent-primary)] text-white shadow-lg'
            : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-secondary)]'
        ]"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.count !== undefined"
          class="ml-1 px-1.5 py-0.5 text-xs rounded-full"
          :class="[
            activeTab === tab.id
              ? 'bg-white/20'
              : 'bg-[var(--theme-bg-tertiary)]'
          ]"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Monitor, Cloud, ClipboardList } from 'lucide-vue-next';

type TabId = 'local' | 'remote' | 'ulwork';

interface Tab {
  id: TabId;
  label: string;
  icon: any;
  count?: number;
}

const props = defineProps<{
  activeTab: TabId;
  localCount?: number;
  remoteCount?: number;
  ulworkCount?: number;
}>();

defineEmits<{
  'set-tab': [TabId];
}>();

const tabs = computed<Tab[]>(() => [
  { id: 'ulwork', label: 'UL Work', icon: ClipboardList, count: props.ulworkCount },
  { id: 'local', label: 'Local', icon: Monitor, count: props.localCount },
  { id: 'remote', label: 'Remote', icon: Cloud, count: props.remoteCount },
]);
</script>
