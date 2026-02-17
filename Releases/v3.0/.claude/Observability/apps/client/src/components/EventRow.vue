<template>
  <div>
    <!-- HITL Question Section (NEW) -->
    <div
      v-if="event.humanInTheLoop && (event.humanInTheLoopStatus?.status === 'pending' || hasSubmittedResponse)"
      class="mb-4 p-4 rounded-lg border-2 shadow-lg"
      :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'border-green-500 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20' : 'border-yellow-500 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 animate-pulse-slow'"
      @click.stop
    >
      <!-- Question Header -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2">
            <component :is="hitlTypeIcon" :size="24" :stroke-width="2.5" :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'" />
            <h3 class="text-lg font-bold" :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'">
              {{ hitlTypeLabel }}
            </h3>
            <span v-if="permissionType" class="text-xs font-mono font-semibold px-2 py-1 rounded border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-900 dark:text-blue-100">
              {{ permissionType }}
            </span>
          </div>
          <span v-if="!hasSubmittedResponse && event.humanInTheLoopStatus?.status !== 'responded'" class="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-300">
            <Clock :size="12" :stroke-width="2.5" />
            Waiting for response...
          </span>
        </div>
        <div class="flex items-center space-x-2 ml-9">
          <div
            class="text-xs font-bold px-2 py-0.5 rounded-full border-2 shadow-lg flex items-center gap-1 text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)]"
            :style="{
              borderColor: appHexColor,
              backgroundColor: appHexColor + '33'
            }"
          >
            <span class="font-mono text-xs">{{ agentId }}</span>
          </div>
          <span class="text-xs text-[var(--theme-text-tertiary)] font-medium">
            {{ formatTime(event.timestamp) }}
          </span>
        </div>
      </div>

      <!-- Question Text -->
      <div class="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border" :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'border-green-300' : 'border-yellow-300'">
        <p class="prose text-base font-medium text-gray-900 dark:text-gray-100">
          {{ event.humanInTheLoop.question }}
        </p>
      </div>

      <!-- Inline Response Display (Optimistic UI) -->
      <div v-if="localResponse || (event.humanInTheLoopStatus?.status === 'responded' && event.humanInTheLoopStatus.response)" class="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-400">
        <div class="flex items-center gap-2 mb-2">
          <CheckCircle :size="18" :stroke-width="2.5" class="text-green-600" />
          <strong class="text-green-900 dark:text-green-100">Your Response:</strong>
        </div>
        <div v-if="(localResponse?.response || event.humanInTheLoopStatus?.response?.response)" class="text-gray-900 dark:text-gray-100 ml-7">
          {{ localResponse?.response || event.humanInTheLoopStatus?.response?.response }}
        </div>
        <div v-if="(localResponse?.permission !== undefined || event.humanInTheLoopStatus?.response?.permission !== undefined)" class="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 ml-7">
          <component :is="(localResponse?.permission ?? event.humanInTheLoopStatus?.response?.permission) ? CheckCircle : X" :size="16" :stroke-width="2.5" :class="(localResponse?.permission ?? event.humanInTheLoopStatus?.response?.permission) ? 'text-green-600' : 'text-red-600'" />
          {{ (localResponse?.permission ?? event.humanInTheLoopStatus?.response?.permission) ? 'Approved' : 'Denied' }}
        </div>
        <div v-if="(localResponse?.choice || event.humanInTheLoopStatus?.response?.choice)" class="text-gray-900 dark:text-gray-100 ml-7">
          {{ localResponse?.choice || event.humanInTheLoopStatus?.response?.choice }}
        </div>
      </div>

      <!-- Response UI -->
      <div v-if="event.humanInTheLoop.type === 'question'">
        <!-- Text Input for Questions -->
        <textarea
          v-model="responseText"
          class="w-full p-3 border-2 border-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
          rows="3"
          placeholder="Type your response here..."
          @click.stop
        ></textarea>
        <div class="flex justify-end space-x-2 mt-2">
          <button
            @click.stop="submitResponse"
            :disabled="!responseText.trim() || isSubmitting || hasSubmittedResponse"
            class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
          >
            <component :is="isSubmitting ? Loader2 : CheckCircle" :size="16" :stroke-width="2.5" :class="isSubmitting ? 'animate-spin' : ''" />
            {{ isSubmitting ? 'Sending...' : 'Submit Response' }}
          </button>
        </div>
      </div>

      <div v-else-if="event.humanInTheLoop.type === 'permission'">
        <!-- Yes/No Buttons for Permissions -->
        <div class="flex justify-end items-center space-x-3">
          <div v-if="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded'" class="flex items-center px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-500">
            <span class="text-sm font-bold text-green-900 dark:text-green-100">Responded</span>
          </div>
          <button
            @click.stop="submitPermission(false)"
            :disabled="isSubmitting || hasSubmittedResponse"
            class="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            :class="hasSubmittedResponse ? 'opacity-40 cursor-not-allowed' : ''"
          >
            <component :is="isSubmitting ? Loader2 : X" :size="16" :stroke-width="2.5" :class="isSubmitting ? 'animate-spin' : ''" />
            Deny
          </button>
          <button
            @click.stop="submitPermission(true)"
            :disabled="isSubmitting || hasSubmittedResponse"
            class="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            :class="hasSubmittedResponse ? 'opacity-40 cursor-not-allowed' : ''"
          >
            <component :is="isSubmitting ? Loader2 : CheckCircle" :size="16" :stroke-width="2.5" :class="isSubmitting ? 'animate-spin' : ''" />
            Approve
          </button>
        </div>
      </div>

      <div v-else-if="event.humanInTheLoop.type === 'choice'">
        <!-- Multiple Choice Buttons -->
        <div class="flex flex-wrap gap-2 justify-end">
          <button
            v-for="choice in event.humanInTheLoop.choices"
            :key="choice"
            @click.stop="submitChoice(choice)"
            :disabled="isSubmitting || hasSubmittedResponse"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
          >
            <Loader2 v-if="isSubmitting" :size="16" :stroke-width="2.5" class="animate-spin" />
            {{ choice }}
          </button>
        </div>
      </div>
    </div>

    <!-- Original Event Row Content (skip if HITL with humanInTheLoop) -->
    <div
      v-if="!event.humanInTheLoop"
      class="group relative p-3 mobile:p-2 rounded-xl glass-card cursor-pointer"
      :class="{ 'ring-1 ring-[var(--theme-primary)]/50 glow-primary': isExpanded }"
      @click="toggleExpanded"
    >
    <div class="ml-1">
      <!-- Single Row Layout - All Platforms -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <!-- Agent Badge - More refined -->
          <div
            class="text-xs font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 transition-smooth"
            :style="{
              borderColor: appHexColor + '50',
              backgroundColor: appHexColor + '15'
            }"
          >
            <span class="font-mono text-xs whitespace-nowrap text-[var(--theme-text-primary)]">{{ agentId }}</span>
          </div>

          <!-- Event Type Badge (Hook) -->
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
            :style="{
              backgroundColor: eventTypeColor + '12',
              color: eventTypeColor
            }"
          >
            <component :is="hookIcon" :size="12" :stroke-width="2" />
            {{ formatEventType(event.hook_event_type) }}
          </span>

          <!-- Tool info - Inline on same row -->
          <span v-if="toolInfo" class="flex items-center gap-1.5 min-w-0">
            <span
              v-if="toolInfo.tool"
              class="text-sm font-medium px-2 py-1 rounded-lg inline-flex items-center gap-1 shrink-0"
              :style="{
                backgroundColor: toolTypeColor + '10',
                color: toolTypeColor
              }"
            >
              <component :is="getToolIcon(toolInfo.tool)" :size="11" :stroke-width="2" />
              {{ toolInfo.tool }}
            </span>
            <span
              v-if="toolInfo.detail"
              class="text-base truncate flex-1 min-w-0 text-[var(--theme-text-secondary)]"
              :class="{
                'font-medium': event.hook_event_type === 'Completed'
              }"
              :style="{
                fontFamily: event.hook_event_type === 'UserPromptSubmit'
                  ? 'valkyrie-text, Georgia, serif'
                  : 'concourse-t3, Georgia, serif',
                fontStyle: event.hook_event_type === 'UserPromptSubmit' ? 'italic' : undefined,
                color: event.hook_event_type === 'UserPromptSubmit' ? '#7dcfff' :
                       event.hook_event_type === 'Completed' ? '#9ece6a' :
                       undefined
              }"
            >{{ toolInfo.detail }}</span>
          </span>

          <!-- Summary - Inline on same row -->
          <span v-if="event.summary" class="inline-flex items-center gap-1.5 text-xs text-[var(--theme-text-primary)] font-medium px-2.5 py-1 bg-[var(--theme-primary)]/8 rounded-lg min-w-0 max-w-sm">
            <FileText :size="11" :stroke-width="2" class="text-[var(--theme-primary)] shrink-0" />
            <span class="truncate">{{ event.summary }}</span>
          </span>
        </div>

        <!-- Timestamp -->
        <span class="text-xs text-[var(--theme-text-quaternary)] font-medium whitespace-nowrap">
          {{ formatTime(event.timestamp) }}
        </span>
      </div>

      <!-- Expanded content - Glass panel nested -->
      <div v-if="isExpanded" class="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-3">
        <!-- Payload -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-[var(--theme-text-secondary)] flex items-center gap-1.5">
              <Package :size="14" :stroke-width="2" />
              Payload
            </h4>
            <button
              @click.stop="copyPayload"
              class="glass-button px-3 py-1.5 mobile:px-2 mobile:py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
            >
              <Copy :size="12" :stroke-width="2" />
              <span>{{ copyButtonText }}</span>
            </button>
          </div>
          <pre class="text-sm text-[var(--theme-text-primary)] glass-panel-subtle p-3 mobile:p-2 rounded-xl overflow-x-auto max-h-64 overflow-y-auto" style="font-family: 'triplicate-code', monospace;">{{ formattedPayload }}</pre>
        </div>

        <!-- Chat transcript button -->
        <div v-if="event.chat && event.chat.length > 0" class="flex justify-end">
          <button
            @click.stop="!isMobile && (showChatModal = true)"
            :class="[
              'px-4 py-2 mobile:px-3 mobile:py-1.5 font-medium rounded-xl transition-smooth flex items-center gap-2',
              isMobile
                ? 'glass-panel-subtle cursor-not-allowed opacity-40 text-[var(--theme-text-quaternary)]'
                : 'bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white'
            ]"
            :disabled="isMobile"
          >
            <MessageSquare :size="14" :stroke-width="2" />
            <span class="text-sm mobile:text-xs">
              {{ isMobile ? 'Not available' : `Chat (${event.chat.length})` }}
            </span>
          </button>
        </div>
      </div>
    </div>
    </div>
    <!-- Chat Modal -->
    <ChatTranscriptModal
      v-if="event.chat && event.chat.length > 0"
      :is-open="showChatModal"
      :chat="event.chat"
      @close="showChatModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent, HumanInTheLoopResponse } from '../types';
import { useMediaQuery } from '../composables/useMediaQuery';
import { useEventColors } from '../composables/useEventColors';
import { obfuscateObject, obfuscateString } from '../utils/obfuscate';
import {
  Wrench,
  CheckCircle,
  Bell,
  StopCircle,
  Users,
  Package,
  MessageSquare,
  Rocket,
  Flag,
  FileText,
  Copy,
  HelpCircle,
  Lock,
  Target,
  Clock,
  Loader2,
  X,
  UserCheck,
  Eye,
  FilePlus,
  Edit3,
  Terminal,
  Search,
  FolderSearch,
  Globe,
  Compass,
  Zap,
  Command,
  CheckSquare,
  MessageCircleQuestion,
  BookOpen,
  Code,
  type LucideIcon
} from 'lucide-vue-next';
import ChatTranscriptModal from './ChatTranscriptModal.vue';

const props = defineProps<{
  event: HookEvent;
  gradientClass: string;
  colorClass: string;
  appGradientClass: string;
  appColorClass: string;
  appHexColor: string;
}>();

// Get color functions
const { getEventTypeColor, getToolTypeColor } = useEventColors();

const emit = defineEmits<{
  (e: 'response-submitted', response: HumanInTheLoopResponse): void;
}>();

// Existing refs
const isExpanded = ref(false);
const showChatModal = ref(false);
const copyButtonText = ref('Copy');

// New refs for HITL
const responseText = ref('');
const isSubmitting = ref(false);
const hasSubmittedResponse = ref(false);
const localResponse = ref<HumanInTheLoopResponse | null>(null); // Optimistic UI

// Media query for responsive design
const { isMobile } = useMediaQuery();

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const sessionIdShort = computed(() => {
  return props.event.session_id.slice(0, 8);
});

const agentId = computed(() => {
  // For UserPromptSubmit events, show the principal as the source
  if (props.event.hook_event_type === 'UserPromptSubmit') {
    return 'User';
  }
  // Capitalize the agent name
  const name = props.event.source_app;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
});

const hookIcon = computed<LucideIcon>(() => {
  const iconMap: Record<string, LucideIcon> = {
    'PreToolUse': Wrench,
    'PostToolUse': CheckCircle,
    'Notification': Bell,
    'Stop': StopCircle,
    'SubagentStop': UserCheck,
    'PreCompact': Package,
    'UserPromptSubmit': MessageSquare,
    'SessionStart': Rocket,
    'SessionEnd': Flag,
    'Completed': CheckCircle
  };
  return iconMap[props.event.hook_event_type] || MessageSquare;
});

// Color for the event type badge
const eventTypeColor = computed(() => {
  return getEventTypeColor(props.event.hook_event_type);
});

// Color for the tool name badge
const toolTypeColor = computed(() => {
  if (toolInfo.value?.tool) {
    return getToolTypeColor(toolInfo.value.tool);
  }
  return '#7aa2f7'; // Default Tokyo Night blue
});

const formattedPayload = computed(() => {
  // Obfuscate sensitive data in the payload before displaying
  const obfuscated = obfuscateObject(props.event.payload);
  return JSON.stringify(obfuscated, null, 2);
});

const toolInfo = computed(() => {
  const payload = props.event.payload;

  // Handle Completed events (synthetic completion events)
  if (props.event.hook_event_type === 'Completed') {
    return {
      tool: '',
      detail: payload.task || props.event.summary || 'Task completed'
    };
  }

  // Handle UserPromptSubmit events
  if (props.event.hook_event_type === 'UserPromptSubmit' && payload.prompt) {
    const promptPreview = payload.prompt.slice(0, 300);
    const obfuscatedPrompt = obfuscateString(promptPreview);
    return {
      tool: 'Prompt:',
      detail: `"${obfuscatedPrompt}${payload.prompt.length > 300 ? '...' : ''}"`
    };
  }

  // Handle PreCompact events
  if (props.event.hook_event_type === 'PreCompact') {
    const trigger = payload.trigger || 'unknown';
    return {
      tool: 'Compaction:',
      detail: trigger === 'manual' ? 'Manual compaction' : 'Auto-compaction (full context)'
    };
  }

  // Handle SessionStart events
  if (props.event.hook_event_type === 'SessionStart') {
    const source = payload.source || 'unknown';
    const sourceLabels: Record<string, string> = {
      'startup': 'New session',
      'resume': 'Resuming session',
      'clear': 'Fresh session'
    };
    return {
      tool: 'Session:',
      detail: sourceLabels[source] || source
    };
  }

  // Handle tool-based events
  if (payload.tool_name) {
    const info: { tool: string; detail?: string } = { tool: payload.tool_name };

    if (payload.tool_input) {
      if (payload.tool_input.command) {
        const commandPreview = payload.tool_input.command.slice(0, 200);
        const obfuscatedCommand = obfuscateString(commandPreview);
        info.detail = obfuscatedCommand + (payload.tool_input.command.length > 200 ? '...' : '');
      } else if (payload.tool_input.file_path) {
        // Show more of the file path (last 3 segments or full if shorter)
        const parts = payload.tool_input.file_path.split('/');
        const filePath = parts.length > 3 ? '.../' + parts.slice(-3).join('/') : payload.tool_input.file_path;
        // Obfuscate in case file path contains sensitive info
        info.detail = obfuscateString(filePath);
      } else if (payload.tool_input.pattern) {
        info.detail = obfuscateString(payload.tool_input.pattern);
      }
    }

    return info;
  }

  return null;
});

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

// Format event type names for user-friendly display
const formatEventType = (eventType: string): string => {
  const displayNames: Record<string, string> = {
    'PreToolUse': 'Pre-Tool',
    'PostToolUse': 'Post-Tool',
    'UserPromptSubmit': 'UserPromptSubmit',
    'SessionStart': 'SessionStart',
    'SessionEnd': 'SessionEnd',
    'Stop': 'Stop',
    'SubagentStop': 'SubagentStop',
    'PreCompact': 'PreCompact',
    'Notification': 'Notification',
    'Completed': 'Completed'
  };
  return displayNames[eventType] || eventType;
};

// Get icon for tool type (matching TopToolsWidget)
const getToolIcon = (toolName: string): LucideIcon => {
  const toolIcons: Record<string, LucideIcon> = {
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
    'ExitPlanMode': CheckCircle,
  };
  return toolIcons[toolName] || Code;
};

const copyPayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPayload.value);
    copyButtonText.value = 'Copied!';
    setTimeout(() => {
      copyButtonText.value = 'Copy';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyButtonText.value = 'Failed';
    setTimeout(() => {
      copyButtonText.value = 'Copy';
    }, 2000);
  }
};

// New computed properties for HITL
const hitlTypeIcon = computed<LucideIcon>(() => {
  if (!props.event.humanInTheLoop) return HelpCircle;
  const iconMap: Record<string, LucideIcon> = {
    question: HelpCircle,
    permission: Lock,
    choice: Target
  };
  return iconMap[props.event.humanInTheLoop.type] || HelpCircle;
});

const hitlTypeLabel = computed(() => {
  if (!props.event.humanInTheLoop) return '';
  const labelMap = {
    question: 'Agent Question',
    permission: 'Permission Request',
    choice: 'Choice Required'
  };
  return labelMap[props.event.humanInTheLoop.type] || 'Question';
});

const permissionType = computed(() => {
  return props.event.payload?.permission_type || null;
});

// Methods for HITL responses
const submitResponse = async () => {
  if (!responseText.value.trim() || !props.event.id) return;

  const response: HumanInTheLoopResponse = {
    response: responseText.value.trim(),
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  const savedText = responseText.value;
  responseText.value = '';
  isSubmitting.value = true;

  try {
    const res = await fetch(`http://localhost:4000/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit response');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting response:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    responseText.value = savedText;
    alert('Failed to submit response. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const submitPermission = async (approved: boolean) => {
  if (!props.event.id) return;

  const response: HumanInTheLoopResponse = {
    permission: approved,
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  isSubmitting.value = true;

  try {
    const res = await fetch(`http://localhost:4000/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit permission');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting permission:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    alert('Failed to submit permission. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const submitChoice = async (choice: string) => {
  if (!props.event.id) return;

  const response: HumanInTheLoopResponse = {
    choice,
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  isSubmitting.value = true;

  try {
    const res = await fetch(`http://localhost:4000/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit choice');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting choice:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    alert('Failed to submit choice. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.95;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}
</style>