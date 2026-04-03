/**
 * PAI Theme for Remotion
 *
 * Derived from Art skill preferences at:
 * ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md
 *
 * Core aesthetic: Charcoal architectural sketch with purple accents
 * Visual feel: Monumental emotional spaces, gestural linework, cool washes
 */

export const PAI_THEME = {
  // Colors (from Art color palette)
  colors: {
    // Backgrounds (vast architectural space feel)
    background: '#0f172a',        // Deep slate
    backgroundAlt: '#1e293b',     // Slightly lighter slate
    backgroundDark: '#020617',    // Near black

    // Accents (purple/violet from Art prefs)
    accent: '#8b5cf6',            // Primary purple
    accentLight: '#a78bfa',       // Lighter purple
    accentDark: '#7c3aed',        // Darker purple
    accentMuted: '#6366f1',       // Indigo variant

    // Text (paper ground inspired)
    text: '#f1f5f9',              // Light text
    textMuted: '#94a3b8',         // Muted/secondary text
    textDark: '#64748b',          // De-emphasized text

    // Special
    paperGround: '#F5F5F0',       // Cream/off-white from Art prefs
    coolWash: 'rgba(139, 92, 246, 0.1)', // Purple atmospheric wash
    warmWash: 'rgba(251, 191, 36, 0.1)', // Amber contrast wash

    // Utility
    success: '#10b981',           // Green
    warning: '#f59e0b',           // Amber
    error: '#ef4444',             // Red
    info: '#3b82f6',              // Blue
  },

  // Typography (production design quality)
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',

    // Size scale
    title: { fontSize: 72, fontWeight: 'bold' as const, lineHeight: 1.1 },
    subtitle: { fontSize: 48, fontWeight: '600' as const, lineHeight: 1.2 },
    heading: { fontSize: 36, fontWeight: '600' as const, lineHeight: 1.3 },
    body: { fontSize: 24, fontWeight: 'normal' as const, lineHeight: 1.5 },
    caption: { fontSize: 18, fontWeight: 'normal' as const, lineHeight: 1.4 },
    small: { fontSize: 14, fontWeight: 'normal' as const, lineHeight: 1.4 },
  },

  // Animation feel (gestural, organic - not mechanical)
  animation: {
    // Spring configs (organic feel like gestural linework)
    springFast: { damping: 15, stiffness: 150 },
    springDefault: { damping: 12, stiffness: 100 },
    springSlow: { damping: 10, stiffness: 80 },
    springBouncy: { damping: 8, stiffness: 120 },

    // Frame durations at 30fps
    fadeFrames: 30,        // ~1 second fade
    quickFade: 15,         // ~0.5 second
    slowFade: 45,          // ~1.5 seconds

    // Stagger delays
    staggerDelay: 10,      // Frames between sequential elements
    staggerFast: 5,        // Quick succession
    staggerSlow: 15,       // Dramatic reveal
  },

  // Spacing (human-scale in vast spaces)
  spacing: {
    page: 100,             // Edge padding for full-screen
    section: 60,           // Between major sections
    element: 30,           // Between related elements
    tight: 15,             // Compact spacing

    // For text blocks
    paragraphGap: 24,
    listItemGap: 16,
  },

  // Shadows and effects
  effects: {
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    boxShadowLarge: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    glow: '0 0 20px rgba(139, 92, 246, 0.5)',
  },

  // Border radius
  borderRadius: {
    small: 8,
    medium: 16,
    large: 24,
    full: 9999,
  },
} as const

// Type exports
export type PAITheme = typeof PAI_THEME
export type PAIColors = typeof PAI_THEME.colors
export type PAITypography = typeof PAI_THEME.typography
export type PAIAnimation = typeof PAI_THEME.animation

// Utility: Get interpolate input/output for fade
export const fadeInterpolation = (startFrame = 0) => ({
  inputRange: [startFrame, startFrame + PAI_THEME.animation.fadeFrames],
  outputRange: [0, 1] as [number, number],
})

// Utility: Style preset for centered title screen
export const titleScreenStyle = {
  backgroundColor: PAI_THEME.colors.background,
  display: 'flex' as const,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  fontFamily: PAI_THEME.typography.fontFamily,
}

// Utility: Style preset for content screen
export const contentScreenStyle = {
  backgroundColor: PAI_THEME.colors.background,
  padding: PAI_THEME.spacing.page,
  fontFamily: PAI_THEME.typography.fontFamily,
}
