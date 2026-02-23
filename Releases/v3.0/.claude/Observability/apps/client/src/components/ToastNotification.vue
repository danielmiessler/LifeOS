<template>
  <Transition name="toast">
    <div
      v-if="isVisible"
      class="fixed left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg border-2 font-semibold drop-shadow-2xl transition-all duration-300"
      :style="{
        top: `${16 + (index * 68)}px`,
        borderColor: agentColor,
        boxShadow: `0 10px 40px -10px rgba(0, 0, 0, 0.5), 0 20px 50px -15px rgba(0, 0, 0, 0.3), 0 0 0 3px ${agentColor}33`
      }"
    >
      <div
        class="w-3 h-3 rounded-full"
        :style="{ backgroundColor: agentColor }"
      ></div>
      <span class="text-sm" :style="{ color: agentColor }">
        New Agent <span class="font-bold px-2 py-0.5 rounded" :style="{ backgroundColor: agentColor, color: '#1a1b26' }">"{{ agentName }}"</span> Joined
      </span>
      <button
        @click="dismiss"
        class="ml-2 text-white hover:text-white/80 transition-colors duration-200 font-bold text-lg leading-none"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  agentName: string;
  agentColor: string;
  index: number;
  duration?: number;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const isVisible = ref(false);
let dismissTimer: number | null = null;

const dismiss = () => {
  isVisible.value = false;
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  // Wait for animation to complete before emitting
  setTimeout(() => {
    emit('dismiss');
  }, 300);
};

onMounted(() => {
  // Show toast with slight delay for animation
  requestAnimationFrame(() => {
    isVisible.value = true;
  });

  // Auto-dismiss after duration (default 4s)
  const totalDuration = props.duration || 4000;
  dismissTimer = window.setTimeout(() => {
    dismiss();
  }, totalDuration);
});

onUnmounted(() => {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
  }
});
</script>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
