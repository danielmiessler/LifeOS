import { 
  insertTheme, 
  updateTheme, 
  getTheme, 
  getThemes, 
  deleteTheme, 
  incrementThemeDownloadCount 
} from './db';
import type { Theme, ThemeSearchQuery, ThemeValidationError, ApiResponse } from './types';

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substr(2, 16);
}

function validateTheme(theme: Partial<Theme>): ThemeValidationError[] {
  const errors: ThemeValidationError[] = [];
  
  // Required fields validation
  if (!theme.name) {
    errors.push({
      field: 'name',
      message: 'Theme name is required',
      code: 'REQUIRED'
    });
  } else if (!/^[a-z0-9-_]+$/.test(theme.name)) {
    errors.push({
      field: 'name',
      message: 'Theme name must contain only lowercase letters, numbers, hyphens, and underscores',
      code: 'INVALID_FORMAT'
    });
  }
  
  if (!theme.displayName) {
    errors.push({
      field: 'displayName',
      message: 'Display name is required',
      code: 'REQUIRED'
    });
  }
  
  if (!theme.colors) {
    errors.push({
      field: 'colors',
      message: 'Theme colors are required',
      code: 'REQUIRED'
    });
  } else {
    // Validate color format
    const requiredColors = [
      'primary', 'primaryHover', 'primaryLight', 'primaryDark',
      'bgPrimary', 'bgSecondary', 'bgTertiary', 'bgQuaternary',
      'textPrimary', 'textSecondary', 'textTertiary', 'textQuaternary',
      'borderPrimary', 'borderSecondary', 'borderTertiary',
      'accentSuccess', 'accentWarning', 'accentError', 'accentInfo',
      'shadow', 'shadowLg', 'hoverBg', 'activeBg', 'focusRing'
    ];
    
    for (const colorKey of requiredColors) {
      const color = theme.colors[colorKey as keyof typeof theme.colors];
      if (!color) {
        errors.push({
          field: `colors.${colorKey}`,
          message: `Color ${colorKey} is required`,
          code: 'REQUIRED'
        });
      } else if (!isValidColor(color)) {
        errors.push({
          field: `colors.${colorKey}`,
          message: `Invalid color format for ${colorKey}`,
          code: 'INVALID_COLOR'
        });
      }
    }
  }
  
  // Tags validation
  if (theme.tags && Array.isArray(theme.tags)) {
    for (const tag of theme.tags) {
      if (typeof tag !== 'string' || tag.length === 0) {
        errors.push({
          field: 'tags',
          message: 'All tags must be non-empty strings',
          code: 'INVALID_FORMAT'
        });
        break;
      }
    }
  }
  
  return errors;
}

function isValidColor(color: string): boolean {
  // Check hex colors
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    return true;
  }
  
  // Check rgba/rgb colors
  if (/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d?(?:\.\d+)?))?\)$/.test(color)) {
    return true;
  }
  
  // Check named colors (basic validation)
  const namedColors = [
    'transparent', 'black', 'white', 'red', 'green', 'blue', 
    'yellow', 'cyan', 'magenta', 'gray', 'grey'
  ];
  
  return namedColors.includes(color.toLowerCase());
}

function sanitizeTheme(theme: any): Partial<Theme> {
  return {
    name: theme.name?.toString().toLowerCase().replace(/[^a-z0-9-_]/g, '') || '',
    displayName: theme.displayName?.toString().trim() || '',
    description: theme.description?.toString().trim() || '',
    colors: theme.colors || {},
    isPublic: Boolean(theme.isPublic),
    tags: Array.isArray(theme.tags) ? theme.tags.filter(tag => typeof tag === 'string' && tag.trim()) : [],
    authorId: theme.authorId?.toString() || null,
    authorName: theme.authorName?.toString() || null
  };
}

// Theme management functions
export async function createTheme(themeData: any): Promise<ApiResponse<Theme>> {
  try {
    const sanitized = sanitizeTheme(themeData);
    const errors = validateTheme(sanitized);
    
    if (errors.length > 0) {
      return {
        success: false,
        error: 'Validation failed',
        validationErrors: errors
      };
    }
    
    // Check if theme name already exists
    const existingThemes = getThemes({ query: sanitized.name });
    if (existingThemes.some(t => t.name === sanitized.name)) {
      return {
        success: false,
        error: 'Theme name already exists',
        validationErrors: [{
          field: 'name',
          message: 'A theme with this name already exists',
          code: 'DUPLICATE'
        }]
      };
    }
    
    const theme: Theme = {
      id: generateId(),
      name: sanitized.name!,
      displayName: sanitized.displayName!,
      description: sanitized.description,
      colors: sanitized.colors!,
      isPublic: sanitized.isPublic!,
      authorId: sanitized.authorId,
      authorName: sanitized.authorName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: sanitized.tags || [],
      downloadCount: 0,
      rating: 0,
      ratingCount: 0
    };
    
    const savedTheme = insertTheme(theme);
    
    return {
      success: true,
      data: savedTheme,
      message: 'Theme created successfully'
    };
  } catch (error) {
    console.error('Error creating theme:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function updateThemeById(id: string, updates: any): Promise<ApiResponse<Theme>> {
  try {
    const existingTheme = getTheme(id);
    if (!existingTheme) {
      return {
        success: false,
        error: 'Theme not found'
      };
    }
    
    const sanitized = sanitizeTheme(updates);
    
    // Don't allow changing the name after creation
    delete sanitized.name;
    
    const errors = validateTheme({ ...existingTheme, ...sanitized });
    
    if (errors.length > 0) {
      return {
        success: false,
        error: 'Validation failed',
        validationErrors: errors
      };
    }
    
    const updateData = {
      ...sanitized,
      updatedAt: Date.now()
    };
    
    const success = updateTheme(id, updateData);
    
    if (!success) {
      return {
        success: false,
        error: 'Failed to update theme'
      };
    }
    
    const updatedTheme = getTheme(id);
    
    return {
      success: true,
      data: updatedTheme!,
      message: 'Theme updated successfully'
    };
  } catch (error) {
    console.error('Error updating theme:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function getThemeById(id: string): Promise<ApiResponse<Theme>> {
  try {
    const theme = getTheme(id);
    
    if (!theme) {
      return {
        success: false,
        error: 'Theme not found'
      };
    }
    
    // Increment download count for public themes
    if (theme.isPublic) {
      incrementThemeDownloadCount(id);
    }
    
    return {
      success: true,
      data: theme
    };
  } catch (error) {
    console.error('Error getting theme:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function searchThemes(query: ThemeSearchQuery): Promise<ApiResponse<Theme[]>> {
  try {
    // Default to only public themes unless specific author requested
    const searchQuery = {
      ...query,
      isPublic: query.authorId ? undefined : true
    };
    
    const themes = getThemes(searchQuery);
    
    return {
      success: true,
      data: themes
    };
  } catch (error) {
    console.error('Error searching themes:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function deleteThemeById(id: string, authorId?: string): Promise<ApiResponse<void>> {
  try {
    const theme = getTheme(id);
    
    if (!theme) {
      return {
        success: false,
        error: 'Theme not found'
      };
    }
    
    // Only allow deletion by theme author (in a real app, you'd have proper auth)
    if (authorId && theme.authorId !== authorId) {
      return {
        success: false,
        error: 'Unauthorized - you can only delete your own themes'
      };
    }
    
    const success = deleteTheme(id);
    
    if (!success) {
      return {
        success: false,
        error: 'Failed to delete theme'
      };
    }
    
    return {
      success: true,
      message: 'Theme deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting theme:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function exportThemeById(id: string): Promise<ApiResponse<any>> {
  try {
    const theme = getTheme(id);
    
    if (!theme) {
      return {
        success: false,
        error: 'Theme not found'
      };
    }
    
    const exportData = {
      version: '1.0.0',
      theme: {
        ...theme,
        // Remove server-specific data for export
        id: undefined,
        authorId: undefined,
        downloadCount: undefined,
        rating: undefined,
        ratingCount: undefined,
        createdAt: undefined,
        updatedAt: undefined
      },
      exportedAt: new Date().toISOString(),
      exportedBy: 'observability-system'
    };
    
    return {
      success: true,
      data: exportData
    };
  } catch (error) {
    console.error('Error exporting theme:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function importTheme(importData: any, authorId?: string): Promise<ApiResponse<Theme>> {
  try {
    if (!importData.theme) {
      return {
        success: false,
        error: 'Invalid import data - missing theme'
      };
    }
    
    const themeData = {
      ...importData.theme,
      authorId,
      authorName: importData.theme.authorName || 'Imported',
      isPublic: false // Imported themes are private by default
    };
    
    return await createTheme(themeData);
  } catch (error) {
    console.error('Error importing theme:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

// Utility function to get theme statistics
export async function getThemeStats(): Promise<ApiResponse<any>> {
  try {
    const allThemes = getThemes();
    const publicThemes = getThemes({ isPublic: true });
    
    const stats = {
      totalThemes: allThemes.length,
      publicThemes: publicThemes.length,
      privateThemes: allThemes.length - publicThemes.length,
      totalDownloads: allThemes.reduce((sum, theme) => sum + (theme.downloadCount || 0), 0),
      averageRating: allThemes.length > 0 
        ? allThemes.reduce((sum, theme) => sum + (theme.rating || 0), 0) / allThemes.length 
        : 0
    };
    
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('Error getting theme stats:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}