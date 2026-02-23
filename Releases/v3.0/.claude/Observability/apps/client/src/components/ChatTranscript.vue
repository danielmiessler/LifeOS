<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 h-full overflow-y-auto space-y-3 border-2 border-gray-300 dark:border-gray-600">
    <div v-for="(item, index) in chatItems" :key="index">
      <!-- User Message -->
      <div v-if="item.type === 'user' && item.message" 
           class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-blue-500 text-white">
              User
            </span>
            <div class="flex-1">
              <!-- Handle string content -->
              <p v-if="typeof item.message.content === 'string'"
                 class="prose text-lg text-gray-800 dark:text-gray-100 whitespace-pre-wrap font-medium">
                {{ item.message.content.includes('<command-') ? cleanCommandContent(item.message.content) : item.message.content }}
              </p>
              <!-- Handle array content -->
              <div v-else-if="Array.isArray(item.message.content)" class="space-y-2">
                <div v-for="(content, cIndex) in item.message.content" :key="cIndex">
                  <!-- Text content -->
                  <p v-if="content.type === 'text'"
                     class="prose text-lg text-gray-800 dark:text-gray-100 whitespace-pre-wrap font-medium">
                    {{ content.text }}
                  </p>
                  <!-- Tool result -->
                  <div v-else-if="content.type === 'tool_result'" 
                       class="bg-gray-100 dark:bg-gray-900 p-2 rounded">
                    <span class="text-sm font-mono text-gray-600 dark:text-gray-400">Tool Result:</span>
                    <pre class="text-sm text-gray-700 dark:text-gray-300 mt-1">{{ content.content }}</pre>
                  </div>
                </div>
              </div>
              <!-- Metadata -->
              <div v-if="item.timestamp" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index, item.type || item.role)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">{{ JSON.stringify(getObfuscatedItem(index), null, 2) }}</pre>
        </div>
      </div>

      <!-- Assistant Message -->
      <div v-else-if="item.type === 'assistant' && item.message" 
           class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-gray-500 text-white">
              Assistant
            </span>
            <div class="flex-1">
              <!-- Handle content array -->
              <div v-if="Array.isArray(item.message.content)" class="space-y-2">
                <div v-for="(content, cIndex) in item.message.content" :key="cIndex">
                  <!-- Text content -->
                  <p v-if="content.type === 'text'"
                     class="prose text-lg text-gray-800 dark:text-gray-100 whitespace-pre-wrap font-medium">
                    {{ content.text }}
                  </p>
                  <!-- Tool use -->
                  <div v-else-if="content.type === 'tool_use'"
                       class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                    <div class="flex items-center space-x-2 mb-2">
                      <Wrench :size="20" :stroke-width="2.5" class="text-yellow-600 dark:text-yellow-400" />
                      <span class="font-semibold text-yellow-800 dark:text-yellow-200">{{ content.name }}</span>
                    </div>
                    <pre class="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">{{ JSON.stringify(content.input, null, 2) }}</pre>
                  </div>
                </div>
              </div>
              <!-- Usage info -->
              <div v-if="item.message.usage" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Tokens: {{ item.message.usage.input_tokens }} in / {{ item.message.usage.output_tokens }} out
              </div>
              <!-- Timestamp -->
              <div v-if="item.timestamp" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index, item.type || item.role)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">{{ JSON.stringify(getObfuscatedItem(index), null, 2) }}</pre>
        </div>
      </div>

      <!-- System Message -->
      <div v-else-if="item.type === 'system'" 
           class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-amber-600 text-white">
              System
            </span>
            <div class="flex-1">
              <p class="text-lg text-gray-800 dark:text-gray-100 font-medium">
                {{ cleanSystemContent(item.content || '') }}
              </p>
              <!-- Tool use ID if present -->
              <div v-if="item.toolUseID" class="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                Tool ID: {{ item.toolUseID }}
              </div>
              <!-- Timestamp -->
              <div v-if="item.timestamp" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index, item.type || item.role)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">{{ JSON.stringify(getObfuscatedItem(index), null, 2) }}</pre>
        </div>
      </div>

      <!-- Fallback for simple chat format -->
      <div v-else-if="item.role" 
           class="p-3 rounded-lg"
           :class="item.role === 'user' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-gray-50 dark:bg-gray-900/30'">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0"
                  :class="item.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'">
              {{ item.role === 'user' ? 'User' : 'Assistant' }}
            </span>
            <div class="flex-1">
              <p class="prose text-lg text-gray-800 dark:text-gray-100 whitespace-pre-wrap font-medium">
                {{ item.content }}
              </p>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index, item.type || item.role)"
              class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">{{ JSON.stringify(getObfuscatedItem(index), null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Wrench } from 'lucide-vue-next';
import { obfuscateObject, obfuscateString } from '../utils/obfuscate';

const props = defineProps<{
  chat: any[];
}>();

// Track which items have details expanded
const expandedDetails = ref<Set<number>>(new Set());

const toggleDetails = (index: number) => {
  if (expandedDetails.value.has(index)) {
    expandedDetails.value.delete(index);
  } else {
    expandedDetails.value.add(index);
  }
  // Force reactivity
  expandedDetails.value = new Set(expandedDetails.value);
};

const isDetailsExpanded = (index: number) => {
  return expandedDetails.value.has(index);
};

const chatItems = computed(() => {
  // Handle both simple chat format and complex claude-code format
  if (props.chat.length > 0 && props.chat[0].type) {
    // Complex format from chat.json
    return props.chat;
  } else {
    // Simple format with role/content
    return props.chat;
  }
});

// Obfuscated version for displaying in details sections
const getObfuscatedItem = (index: number) => {
  const item = chatItems.value[index];
  return obfuscateObject(item);
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// const cleanContent = (content: string) => {
//   // Remove command message tags
//   return content
//     .replace(/<command-message>.*?<\/command-message>/gs, '')
//     .replace(/<command-name>.*?<\/command-name>/gs, '')
//     .trim();
// };

const cleanSystemContent = (content: string) => {
  // Remove ANSI escape codes
  return content.replace(/\u001b\[[0-9;]*m/g, '');
};

const cleanCommandContent = (content: string) => {
  // Remove command tags and clean content
  return content
    .replace(/<command-message>.*?<\/command-message>/gs, '')
    .replace(/<command-name>(.*?)<\/command-name>/gs, '$1')
    .trim();
};

// Track copy button states
const copyButtonStates = ref<Map<number, string>>(new Map());

const getCopyButtonText = (index: number) => {
  return copyButtonStates.value.get(index) || 'Copy';
};

const copyMessage = async (index: number, _type: string) => {
  const item = chatItems.value[index];

  try {
    // Obfuscate sensitive data before copying
    const obfuscatedItem = obfuscateObject(item);
    const jsonPayload = JSON.stringify(obfuscatedItem, null, 2);
    await navigator.clipboard.writeText(jsonPayload);

    copyButtonStates.value.set(index, 'Copied!');
    setTimeout(() => {
      copyButtonStates.value.delete(index);
      copyButtonStates.value = new Map(copyButtonStates.value);
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyButtonStates.value.set(index, 'Failed');
    setTimeout(() => {
      copyButtonStates.value.delete(index);
      copyButtonStates.value = new Map(copyButtonStates.value);
    }, 2000);
  }
  // Force reactivity
  copyButtonStates.value = new Map(copyButtonStates.value);
};
</script>