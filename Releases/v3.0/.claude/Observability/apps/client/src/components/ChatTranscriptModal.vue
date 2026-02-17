<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 mobile:p-0">
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        @click="close"
      ></div>
      
      <!-- Modal -->
      <div 
        class="relative bg-white dark:bg-gray-800 rounded-lg mobile:rounded-none shadow-xl flex flex-col overflow-hidden z-10 mobile:w-full mobile:h-full mobile:fixed mobile:inset-0"
        :style="{ width: '85vw', height: '85vh' }"
        :class="{ 'mobile:!w-full mobile:!h-full': true }"
        @click.stop
      >
          <!-- Header -->
          <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 mobile:p-3">
            <div class="flex items-center justify-between mb-4 mobile:mb-2">
              <h2 class="flex items-center gap-2 text-3xl mobile:text-lg font-semibold text-gray-900 dark:text-white">
                <MessageSquare :size="28" :stroke-width="2.5" />
                Chat Transcript
              </h2>
              <button
                @click="close"
                class="p-2 mobile:p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg class="w-6 h-6 mobile:w-5 mobile:h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <!-- Search and Filters -->
            <div class="space-y-4">
              <!-- Search Input -->
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="searchQuery"
                    @keyup.enter="executeSearch"
                    type="text"
                    placeholder="Search transcript..."
                    class="w-full px-4 py-2 mobile:px-3 mobile:py-2 pl-10 mobile:pl-8 text-lg mobile:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                  <svg class="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  @click="executeSearch"
                  class="px-4 py-2 mobile:px-3 mobile:py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-base mobile:text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  Search
                </button>
                <button
                  @click="copyAllMessages"
                  class="px-4 py-2 mobile:px-3 mobile:py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-base mobile:text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Copy all messages as JSON"
                >
                  {{ copyAllButtonText }}
                </button>
              </div>
              
              <!-- Filters -->
              <div class="flex flex-wrap gap-2 mobile:gap-1 max-h-24 mobile:max-h-32 overflow-y-auto p-2 mobile:p-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg mobile:overflow-x-auto mobile:pb-2">
                <button
                  v-for="filter in filters"
                  :key="filter.type"
                  @click="toggleFilter(filter.type)"
                  class="px-4 py-2 mobile:px-3 mobile:py-1.5 rounded-full text-sm mobile:text-xs font-medium transition-colors min-h-[44px] mobile:min-h-[36px] flex items-center whitespace-nowrap"
                  :class="activeFilters.includes(filter.type)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
                >
                  <component :is="filter.icon" :size="14" :stroke-width="2.5" class="mr-1" />
                  {{ filter.label }}
                </button>
                
                <!-- Clear Filters -->
                <button
                  v-if="searchQuery || activeSearchQuery || activeFilters.length > 0"
                  @click="clearSearch"
                  class="px-4 py-2 mobile:px-3 mobile:py-1.5 rounded-full text-sm mobile:text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 min-h-[44px] mobile:min-h-[36px] flex items-center whitespace-nowrap"
                >
                  Clear All
                </button>
              </div>
              
              <!-- Results Count -->
              <div v-if="activeSearchQuery || activeFilters.length > 0" class="text-sm mobile:text-xs text-gray-500 dark:text-gray-400">
                Showing {{ filteredChat.length }} of {{ chat.length }} messages
                <span v-if="activeSearchQuery" class="ml-2 font-medium mobile:block mobile:ml-0 mobile:mt-1">
                  (searching for "{{ activeSearchQuery }}")
                </span>
              </div>
            </div>
          </div>
          
          <!-- Content -->
          <div class="flex-1 p-6 mobile:p-3 overflow-hidden flex flex-col">
            <ChatTranscript :chat="filteredChat" />
          </div>
        </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ChatTranscript from './ChatTranscript.vue';
import { obfuscateObject } from '../utils/obfuscate';
import { MessageSquare, Copy, CheckCircle, X, User, Bot, Settings, Wrench, FileText, PenTool, Edit, Search } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  chat: any[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const searchQuery = ref('');
const activeSearchQuery = ref('');
const activeFilters = ref<string[]>([]);
const copyAllButtonText = ref('Copy All');

const filters = [
  // Message types
  { type: 'user', label: 'User', icon: User },
  { type: 'assistant', label: 'Assistant', icon: Bot },
  { type: 'system', label: 'System', icon: Settings },

  // Tool actions
  { type: 'tool_use', label: 'Tool Use', icon: Wrench },
  { type: 'tool_result', label: 'Tool Result', icon: CheckCircle },

  // Specific tools
  { type: 'Read', label: 'Read', icon: FileText },
  { type: 'Write', label: 'Write', icon: PenTool },
  { type: 'Edit', label: 'Edit', icon: Edit },
  { type: 'Glob', label: 'Glob', icon: Search },
];

const toggleFilter = (type: string) => {
  const index = activeFilters.value.indexOf(type);
  if (index > -1) {
    activeFilters.value.splice(index, 1);
  } else {
    activeFilters.value.push(type);
  }
};

const executeSearch = () => {
  activeSearchQuery.value = searchQuery.value;
};

const clearSearch = () => {
  searchQuery.value = '';
  activeSearchQuery.value = '';
  activeFilters.value = [];
};

const close = () => {
  emit('close');
};

const copyAllMessages = async () => {
  try {
    // Obfuscate sensitive data before copying
    const obfuscatedChat = obfuscateObject(props.chat);
    const jsonPayload = JSON.stringify(obfuscatedChat, null, 2);
    await navigator.clipboard.writeText(jsonPayload);

    copyAllButtonText.value = 'Copied!';
    setTimeout(() => {
      copyAllButtonText.value = 'Copy All';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy all messages:', err);
    copyAllButtonText.value = 'Failed';
    setTimeout(() => {
      copyAllButtonText.value = 'Copy All';
    }, 2000);
  }
};

const matchesSearch = (item: any, query: string): boolean => {
  const lowerQuery = query.toLowerCase().trim();
  
  // Check direct content (for system messages and simple chat)
  if (typeof item.content === 'string') {
    // Remove ANSI codes before searching
    const cleanContent = item.content.replace(/\u001b\[[0-9;]*m/g, '').toLowerCase();
    if (cleanContent.includes(lowerQuery)) {
      return true;
    }
  }
  
  // Check role in simple format
  if (item.role && item.role.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  // Check message object (complex format)
  if (item.message) {
    // Check message role
    if (item.message.role && item.message.role.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Check message content
    if (item.message.content) {
      if (typeof item.message.content === 'string' && item.message.content.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Check array content
      if (Array.isArray(item.message.content)) {
        for (const content of item.message.content) {
          if (content.text && content.text.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          if (content.name && content.name.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          if (content.input && JSON.stringify(content.input).toLowerCase().includes(lowerQuery)) {
            return true;
          }
          if (content.content && typeof content.content === 'string' && content.content.toLowerCase().includes(lowerQuery)) {
            return true;
          }
        }
      }
    }
  }
  
  // Check type
  if (item.type && item.type.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  // Check parentUuid, uuid, sessionId
  if (item.uuid && item.uuid.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  if (item.sessionId && item.sessionId.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  // Check toolUseResult
  if (item.toolUseResult) {
    if (JSON.stringify(item.toolUseResult).toLowerCase().includes(lowerQuery)) {
      return true;
    }
  }
  
  return false;
};

const matchesFilters = (item: any): boolean => {
  if (activeFilters.value.length === 0) return true;
  
  // Check message type
  if (item.type && activeFilters.value.includes(item.type)) {
    return true;
  }
  
  // Check role (simple format)
  if (item.role && activeFilters.value.includes(item.role)) {
    return true;
  }
  
  // Check for system messages with hook types
  if (item.type === 'system' && item.content) {
    // Extract hook type from system content (e.g., "PreToolUse:Read")
    const hookMatch = item.content.match(/([A-Za-z]+):/)?.[1];
    if (hookMatch && activeFilters.value.includes(hookMatch)) {
      return true;
    }
    // Also check if content contains "Running"
    if (item.content.includes('Running') && activeFilters.value.includes('Running')) {
      return true;
    }
    // Check for specific tool names in system messages
    const toolNames = ['Read', 'Write', 'Edit', 'Glob'];
    for (const tool of toolNames) {
      if (item.content.includes(tool) && activeFilters.value.includes(tool)) {
        return true;
      }
    }
  }
  
  // Check for command messages
  if (item.message?.content && typeof item.message.content === 'string') {
    if (item.message.content.includes('<command-') && activeFilters.value.includes('command')) {
      return true;
    }
  }
  
  // Check for meta messages
  if (item.isMeta && activeFilters.value.includes('meta')) {
    return true;
  }
  
  // Check for tool use in content
  if (item.message?.content && Array.isArray(item.message.content)) {
    for (const content of item.message.content) {
      if (content.type === 'tool_use') {
        if (activeFilters.value.includes('tool_use')) {
          return true;
        }
        // Check for specific tool names
        if (content.name && activeFilters.value.includes(content.name)) {
          return true;
        }
      }
      if (content.type === 'tool_result' && activeFilters.value.includes('tool_result')) {
        return true;
      }
    }
  }
  
  return false;
};

const filteredChat = computed(() => {
  if (!activeSearchQuery.value && activeFilters.value.length === 0) {
    return props.chat;
  }
  
  return props.chat.filter(item => {
    const matchesQueryCondition = !activeSearchQuery.value || matchesSearch(item, activeSearchQuery.value);
    const matchesFilterCondition = matchesFilters(item);
    return matchesQueryCondition && matchesFilterCondition;
  });
});

// Handle ESC key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Reset search when modal closes
watch(() => props.isOpen, (newVal) => {
  if (!newVal) {
    clearSearch();
  }
});

</script>