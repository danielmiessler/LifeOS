<template>
  <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-4">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white">Live Preview</h4>
      <button
        @click="$emit('apply')"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
      >
        Apply Preview
      </button>
    </div>
    
    <!-- Preview Window -->
    <div class="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <!-- Mini header simulation -->
      <div 
        class="px-4 py-3 border-b"
        :style="{ 
          backgroundColor: theme.colors?.bgPrimary || '#ffffff',
          borderColor: theme.colors?.borderPrimary || '#e5e7eb'
        }"
      >
        <div class="flex items-center justify-between">
          <h3 
            class="font-semibold"
            :style="{ color: theme.colors?.textPrimary || '#111827' }"
          >
            {{ theme.displayName || 'Theme Preview' }}
          </h3>
          <div class="flex items-center space-x-2">
            <div 
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: theme.colors?.accentSuccess || '#10b981' }"
            ></div>
            <span 
              class="text-sm"
              :style="{ color: theme.colors?.textTertiary || '#6b7280' }"
            >
              Connected
            </span>
          </div>
        </div>
      </div>

      <!-- Content area simulation -->
      <div 
        class="p-4 space-y-4"
        :style="{ backgroundColor: theme.colors?.bgSecondary || '#f9fafb' }"
      >
        <!-- Simulated event card -->
        <div 
          class="rounded-lg p-4 border shadow-sm"
          :style="{ 
            backgroundColor: theme.colors?.bgPrimary || '#ffffff',
            borderColor: theme.colors?.borderPrimary || '#e5e7eb'
          }"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-3">
              <span 
                class="px-3 py-1 rounded-full text-sm font-medium border-2"
                :style="{ 
                  backgroundColor: (theme.colors?.primary || '#3b82f6') + '20',
                  color: theme.colors?.primary || '#3b82f6',
                  borderColor: theme.colors?.primary || '#3b82f6'
                }"
              >
                demo-app
              </span>
              <span 
                class="px-2 py-1 rounded-full text-sm border"
                :style="{ 
                  color: theme.colors?.textSecondary || '#374151',
                  borderColor: theme.colors?.borderSecondary || '#d1d5db'
                }"
              >
                abc123
              </span>
              <span
                class="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                :style="{
                  backgroundColor: (theme.colors?.accentInfo || '#3b82f6') + '20',
                  color: theme.colors?.accentInfo || '#3b82f6'
                }"
              >
                <Wrench :size="14" :stroke-width="2.5" />
                PreToolUse
              </span>
            </div>
            <span 
              class="text-sm"
              :style="{ color: theme.colors?.textQuaternary || '#9ca3af' }"
            >
              2:34 PM
            </span>
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <span 
                class="font-medium"
                :style="{ color: theme.colors?.textSecondary || '#374151' }"
              >
                Bash
              </span>
              <span 
                class="ml-2"
                :style="{ color: theme.colors?.textTertiary || '#6b7280' }"
              >
                ls -la
              </span>
            </div>
            <div
              class="flex items-center gap-1.5 px-3 py-1 rounded-lg"
              :style="{
                backgroundColor: theme.colors?.bgTertiary || '#f3f4f6'
              }"
            >
              <FileText :size="14" :stroke-width="2.5" :style="{ color: theme.colors?.textSecondary || '#374151' }" />
              <span
                class="text-sm"
                :style="{ color: theme.colors?.textSecondary || '#374151' }"
              >
                Summary available
              </span>
            </div>
          </div>
        </div>

        <!-- Simulated filter panel -->
        <div 
          class="rounded-lg p-3 border"
          :style="{ 
            backgroundColor: theme.colors?.bgTertiary || '#f3f4f6',
            borderColor: theme.colors?.borderSecondary || '#d1d5db'
          }"
        >
          <div class="flex items-center space-x-4">
            <select 
              class="px-3 py-1 rounded border text-sm"
              :style="{ 
                backgroundColor: theme.colors?.bgPrimary || '#ffffff',
                borderColor: theme.colors?.borderPrimary || '#e5e7eb',
                color: theme.colors?.textSecondary || '#374151'
              }"
            >
              <option>All Apps</option>
              <option>demo-app</option>
            </select>
            <select 
              class="px-3 py-1 rounded border text-sm"
              :style="{ 
                backgroundColor: theme.colors?.bgPrimary || '#ffffff',
                borderColor: theme.colors?.borderPrimary || '#e5e7eb',
                color: theme.colors?.textSecondary || '#374151'
              }"
            >
              <option>All Events</option>
              <option>PreToolUse</option>
            </select>
            <button 
              class="px-3 py-1 rounded text-sm font-medium text-white transition-colors"
              :style="{ 
                backgroundColor: theme.colors?.primary || '#3b82f6'
              }"
              @mouseover="handleHover"
              @mouseleave="handleHoverEnd"
            >
              Apply Filters
            </button>
          </div>
        </div>

        <!-- Color palette display -->
        <div class="grid grid-cols-8 gap-2">
          <div
            v-for="(color, key) in displayColors"
            :key="key"
            class="h-8 rounded border relative group cursor-pointer"
            :style="{ backgroundColor: color, borderColor: theme.colors?.borderPrimary || '#e5e7eb' }"
            :title="`${formatColorLabel(key)}: ${color}`"
          >
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200"></div>
          </div>
        </div>

        <!-- Status indicators -->
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <div 
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: theme.colors?.accentSuccess || '#10b981' }"
              ></div>
              <span :style="{ color: theme.colors?.textSecondary || '#374151' }">
                Success
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <div 
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: theme.colors?.accentWarning || '#f59e0b' }"
              ></div>
              <span :style="{ color: theme.colors?.textSecondary || '#374151' }">
                Warning
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <div 
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: theme.colors?.accentError || '#ef4444' }"
              ></div>
              <span :style="{ color: theme.colors?.textSecondary || '#374151' }">
                Error
              </span>
            </div>
          </div>
          <span :style="{ color: theme.colors?.textTertiary || '#6b7280' }">
            156 events
          </span>
        </div>
      </div>
    </div>

    <!-- Theme info -->
    <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
            Live Preview Active
          </p>
          <p class="text-sm text-blue-600 dark:text-blue-300">
            This is how your theme will look in the application. Changes are applied in real-time.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CustomTheme, CreateThemeFormData } from '../types/theme';
import { Wrench, FileText } from 'lucide-vue-next';

interface Props {
  theme: CustomTheme | CreateThemeFormData;
}

const props = defineProps<Props>();

defineEmits<{
  apply: [];
}>();

// Extract only the visible colors for the palette display
const displayColors = computed(() => {
  const colors = props.theme.colors;
  if (!colors) return {};
  
  return {
    primary: colors.primary,
    bgPrimary: colors.bgPrimary,
    bgSecondary: colors.bgSecondary,
    bgTertiary: colors.bgTertiary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    accentSuccess: colors.accentSuccess,
    accentError: colors.accentError
  };
});

const formatColorLabel = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

const handleHover = (event: Event) => {
  const button = event.target as HTMLElement;
  if (props.theme.colors?.primaryHover) {
    button.style.backgroundColor = props.theme.colors.primaryHover;
  }
};

const handleHoverEnd = (event: Event) => {
  const button = event.target as HTMLElement;
  if (props.theme.colors?.primary) {
    button.style.backgroundColor = props.theme.colors.primary;
  }
};
</script>