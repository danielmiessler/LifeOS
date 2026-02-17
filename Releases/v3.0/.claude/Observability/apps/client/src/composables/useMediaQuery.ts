import { ref, computed, onMounted, onUnmounted } from 'vue';

/**
 * Reactive media query composable for detecting screen size changes
 * Provides mobile detection for < 700px screens with debouncing
 */
export function useMediaQuery() {
  const windowWidth = ref(0);
  let resizeTimeout: number | null = null;
  let mediaQuery: MediaQueryList | null = null;

  // Define mobile breakpoint at 700px
  const MOBILE_BREAKPOINT = 700;

  // Computed properties for different screen sizes
  const isMobile = computed(() => windowWidth.value < MOBILE_BREAKPOINT);
  const isTablet = computed(() => windowWidth.value >= MOBILE_BREAKPOINT && windowWidth.value < 1024);
  const isDesktop = computed(() => windowWidth.value >= 1024);

  // Debounced resize handler
  const handleResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = window.setTimeout(() => {
      windowWidth.value = window.innerWidth;
    }, 100);
  };

  // Media query change handler
  const handleMediaQueryChange = (_event: MediaQueryListEvent) => {
    windowWidth.value = window.innerWidth;
  };

  onMounted(() => {
    // Check if we're in a browser environment (SSR compatibility)
    if (typeof window !== 'undefined') {
      // Set initial width
      windowWidth.value = window.innerWidth;

      // Set up media query listener for better performance
      mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      
      // Use the newer addEventListener if available, fallback to addListener
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaQueryChange);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleMediaQueryChange);
      }

      // Also listen to resize events as backup
      window.addEventListener('resize', handleResize);
    }
  });

  onUnmounted(() => {
    // Clean up event listeners
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    if (mediaQuery) {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaQueryChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleMediaQueryChange);
      }
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
  });

  return {
    windowWidth: computed(() => windowWidth.value),
    isMobile,
    isTablet,
    isDesktop,
    MOBILE_BREAKPOINT
  };
}