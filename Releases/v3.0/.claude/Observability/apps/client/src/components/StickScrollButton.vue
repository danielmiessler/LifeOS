<template>
  <button
    @click="$emit('toggle')"
    class="fixed bottom-6 right-6 mobile:bottom-4 mobile:right-4 p-4 mobile:p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center border-2 transform hover:scale-110"
    :class="[
      stickToBottom
        ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] text-white border-[var(--theme-primary-dark)] drop-shadow-md'
        : 'bg-[var(--theme-bg-primary)] hover:bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] border-[var(--theme-border-primary)] hover:border-[var(--theme-primary)]'
    ]"
    :title="stickToBottom ? 'Disable auto-scroll to top' : 'Enable auto-scroll to top'"
  >
    <svg
      class="w-6 h-6 mobile:w-5 mobile:h-5 drop-shadow-sm"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        v-if="stickToBottom"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
      <path
        v-else
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6v.01"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  stickToBottom: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>