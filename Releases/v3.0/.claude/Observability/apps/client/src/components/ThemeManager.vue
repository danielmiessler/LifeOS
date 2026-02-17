<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        @click="close"
      ></div>
      
      <!-- Modal -->
      <div 
        class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col overflow-hidden z-10"
        style="width: 75vw; height: 75vh"
        @click.stop
      >
        <!-- Header -->
        <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-3xl font-semibold text-gray-900 dark:text-white">
              🎨 Theme Manager
            </h2>
            <button
              @click="close"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Content -->
        <div class="flex-1 p-6 overflow-y-auto">
          <!-- Theme Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div
              v-for="theme in predefinedThemes"
              :key="theme.name"
              @click="selectTheme(theme.name)"
              :class="[
                'cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md',
                currentTheme === theme.name
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              ]"
            >
              <!-- Theme Preview -->
              <div class="flex h-16 rounded-md overflow-hidden mb-3">
                <div 
                  class="flex-1"
                  :style="{ backgroundColor: theme.preview.primary }"
                ></div>
                <div 
                  class="flex-1"
                  :style="{ backgroundColor: theme.preview.secondary }"
                ></div>
                <div 
                  class="flex-1"
                  :style="{ backgroundColor: theme.preview.accent }"
                ></div>
              </div>
              
              <!-- Theme Info -->
              <h3 class="font-medium text-gray-900 dark:text-white">{{ theme.displayName }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ theme.description }}</p>
              
              <!-- Current indicator -->
              <div v-if="currentTheme === theme.name" class="mt-2">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Current
                </span>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ predefinedThemes.length }} themes available
            </div>
            <button
              @click="close"
              class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemes } from '../composables/useThemes';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Theme management
const { state, predefinedThemes, setTheme } = useThemes();

// Computed properties
const currentTheme = computed(() => state.value.currentTheme);

// Methods
const selectTheme = (themeName: string) => {
  setTheme(themeName);
  close();
};

const close = () => {
  emit('close');
};
</script>