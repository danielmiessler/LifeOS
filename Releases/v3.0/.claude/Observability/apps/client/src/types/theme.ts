// Theme type definitions

export type ThemeName = 'light' | 'dark' | 'modern' | 'earth' | 'glass' | 'high-contrast' | 'dark-blue' | 'colorblind-friendly' | 'ocean' | 'midnight-purple' | 'sunset-orange' | 'mint-fresh' | 'tokyo-night';

export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgQuaternary: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  
  // Border colors
  borderPrimary: string;
  borderSecondary: string;
  borderTertiary: string;
  
  // Accent colors
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  accentInfo: string;
  
  // Shadow colors
  shadow: string;
  shadowLg: string;
  
  // Interactive states
  hoverBg: string;
  activeBg: string;
  focusRing: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  colors: ThemeColors;
  isCustom: boolean;
  isPublic?: boolean;
  authorId?: string;
  authorName?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface PredefinedTheme {
  name: ThemeName;
  displayName: string;
  description: string;
  colors: ThemeColors;
  cssClass: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface ThemeState {
  currentTheme: ThemeName | string;
  customThemes: CustomTheme[];
  isCustomTheme: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ThemeManagerState {
  isOpen: boolean;
  activeTab: 'predefined' | 'custom' | 'create';
  previewTheme: ThemeName | CustomTheme | null;
  editingTheme: CustomTheme | null;
}

export interface CreateThemeFormData {
  name: string;
  displayName: string;
  description: string;
  colors: Partial<ThemeColors>;
  isPublic: boolean;
  tags: string[];
}

export interface ThemeImportExport {
  version: string;
  theme: CustomTheme;
  exportedAt: string;
  exportedBy?: string;
}

export interface ThemeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Color picker types
export interface ColorPickerProps {
  modelValue: string;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}

// Theme API types
export interface ThemeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ThemeSearchFilters {
  query?: string;
  tags?: string[];
  authorId?: string;
  isPublic?: boolean;
  sortBy?: 'name' | 'created' | 'updated' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ThemeShareData {
  themeId: string;
  shareToken: string;
  expiresAt?: string;
  isPublic: boolean;
  allowedUsers?: string[];
}

// Utility types
export type ThemeColorKey = keyof ThemeColors;
export type PartialThemeColors = Partial<ThemeColors>;
export type RequiredThemeColors = Required<ThemeColors>;

// Constants for validation
export const THEME_COLOR_KEYS: ThemeColorKey[] = [
  'primary',
  'primaryHover',
  'primaryLight',
  'primaryDark',
  'bgPrimary',
  'bgSecondary',
  'bgTertiary',
  'bgQuaternary',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'textQuaternary',
  'borderPrimary',
  'borderSecondary',
  'borderTertiary',
  'accentSuccess',
  'accentWarning',
  'accentError',
  'accentInfo',
  'shadow',
  'shadowLg',
  'hoverBg',
  'activeBg',
  'focusRing',
];

export const PREDEFINED_THEME_NAMES: ThemeName[] = [
  'light',
  'dark',
  'modern',
  'earth',
  'glass',
  'high-contrast',
  'dark-blue',
  'colorblind-friendly',
  'ocean',
  'midnight-purple',
  'sunset-orange',
  'mint-fresh',
  'tokyo-night',
];

// Color validation regex
export const COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
export const RGBA_REGEX = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d?(?:\.\d+)?))?\)$/;

// Theme metadata
export const THEME_METADATA = {
  light: {
    name: 'light' as ThemeName,
    displayName: 'Light',
    description: 'Clean and bright theme with high contrast',
    cssClass: 'theme-light',
    category: 'default',
    accessibility: 'high-contrast',
  },
  dark: {
    name: 'dark' as ThemeName,
    displayName: 'Dark',
    description: 'Dark theme with reduced eye strain',
    cssClass: 'theme-dark',
    category: 'default',
    accessibility: 'low-light',
  },
  modern: {
    name: 'modern' as ThemeName,
    displayName: 'Modern',
    description: 'Sleek modern theme with blue accents',
    cssClass: 'theme-modern',
    category: 'professional',
    accessibility: 'standard',
  },
  earth: {
    name: 'earth' as ThemeName,
    displayName: 'Earth',
    description: 'Natural theme with green and brown tones',
    cssClass: 'theme-earth',
    category: 'nature',
    accessibility: 'standard',
  },
  glass: {
    name: 'glass' as ThemeName,
    displayName: 'Glass',
    description: 'Translucent glass-like theme with purple accents',
    cssClass: 'theme-glass',
    category: 'modern',
    accessibility: 'low-contrast',
  },
  'high-contrast': {
    name: 'high-contrast' as ThemeName,
    displayName: 'High Contrast',
    description: 'Maximum contrast theme for accessibility',
    cssClass: 'theme-high-contrast',
    category: 'accessibility',
    accessibility: 'maximum-contrast',
  },
} as const;