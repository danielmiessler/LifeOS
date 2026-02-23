
export function useEventColors() {
  // Agent color definitions from /agents/*.md files
  const agentColors: Record<string, string> = {
    'pentester': '#EF4444',        // red
    'engineer': '#3B82F6',         // blue (senior engineer)
    'designer': '#A855F7',         // purple
    'architect': '#A855F7',        // purple
    'intern': '#06B6D4',           // cyan
    'artist': '#06B6D4',           // cyan
    'perplexity-researcher': '#EAB308', // yellow
    'claude-researcher': '#EAB308',     // yellow
    'gemini-researcher': '#EAB308',     // yellow
    'grok-researcher': '#EAB308',       // yellow
    'qatester': '#EAB308',         // yellow
    'claude-code': '#3B82F6',      // blue (default for main agent)
  };

  const colorPalette = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];

  // Improved hash function with better distribution
  const hashString = (str: string): number => {
    let hash = 7151;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash >>> 0); // Use unsigned 32-bit integer
  };

  const getColorForSession = (sessionId: string): string => {
    const hash = hashString(sessionId);
    const index = hash % colorPalette.length;
    return colorPalette[index];
  };

  const getColorForApp = (appName: string): string => {
    const hash = hashString(appName);
    const index = hash % colorPalette.length;
    return colorPalette[index];
  };

  const getGradientForSession = (sessionId: string): string => {
    const baseColor = getColorForSession(sessionId);

    // Map base colors to gradient classes
    const gradientMap: Record<string, string> = {
      'bg-blue-500': 'from-blue-500 to-blue-600',
      'bg-green-500': 'from-green-500 to-green-600',
      'bg-yellow-500': 'from-yellow-500 to-yellow-600',
      'bg-purple-500': 'from-purple-500 to-purple-600',
      'bg-pink-500': 'from-pink-500 to-pink-600',
      'bg-indigo-500': 'from-indigo-500 to-indigo-600',
      'bg-red-500': 'from-red-500 to-red-600',
      'bg-orange-500': 'from-orange-500 to-orange-600',
      'bg-teal-500': 'from-teal-500 to-teal-600',
      'bg-cyan-500': 'from-cyan-500 to-cyan-600',
    };

    return `bg-gradient-to-r ${gradientMap[baseColor] || 'from-gray-500 to-gray-600'}`;
  };

  const getGradientForApp = (appName: string): string => {
    const baseColor = getColorForApp(appName);

    // Map base colors to gradient classes
    const gradientMap: Record<string, string> = {
      'bg-blue-500': 'from-blue-500 to-blue-600',
      'bg-green-500': 'from-green-500 to-green-600',
      'bg-yellow-500': 'from-yellow-500 to-yellow-600',
      'bg-purple-500': 'from-purple-500 to-purple-600',
      'bg-pink-500': 'from-pink-500 to-pink-600',
      'bg-indigo-500': 'from-indigo-500 to-indigo-600',
      'bg-red-500': 'from-red-500 to-red-600',
      'bg-orange-500': 'from-orange-500 to-orange-600',
      'bg-teal-500': 'from-teal-500 to-teal-600',
      'bg-cyan-500': 'from-cyan-500 to-cyan-600',
    };

    return `bg-gradient-to-r ${gradientMap[baseColor] || 'from-gray-500 to-gray-600'}`;
  };

  const tailwindToHex = (tailwindClass: string): string => {
    const colorMap: Record<string, string> = {
      'bg-blue-500': '#3B82F6',
      'bg-green-500': '#22C55E',
      'bg-yellow-500': '#EAB308',
      'bg-purple-500': '#A855F7',
      'bg-pink-500': '#EC4899',
      'bg-indigo-500': '#6366F1',
      'bg-red-500': '#EF4444',
      'bg-orange-500': '#F97316',
      'bg-teal-500': '#14B8A6',
      'bg-cyan-500': '#06B6D4',
    };
    return colorMap[tailwindClass] || '#3B82F6'; // Default to blue
  };

  const getHexColorForSession = (sessionId: string): string => {
    const tailwindClass = getColorForSession(sessionId);
    return tailwindToHex(tailwindClass);
  };

  const getHexColorForApp = (appName: string): string => {
    // Extract agent name before colon (e.g., "main:58a240f7" -> "main")
    const agentName = appName.split(':')[0].toLowerCase();

    // Special case: main agent and 'claude-code' should be blue (primary agent color)
    // The main agent name comes from settings.json DA env var
    if (agentName === 'main' || agentName === 'kai' || agentName === 'pai') {
      return '#3B82F6';
    }

    // Check if app has a predefined color from agent definitions
    if (agentColors[agentName]) {
      return agentColors[agentName];
    }

    // Fallback to hash-based color for unknown apps
    const hash = hashString(appName);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Tokyo Night color palette for event types
  const tokyoNightColors = {
    purple: '#bb9af7',    // Skills
    cyan: '#7dcfff',      // Prompts
    blue: '#7aa2f7',      // Sessions
    magenta: '#bb9af7',   // Sub-agents
    green: '#9ece6a',     // File operations
    yellow: '#e0af68',    // Search/Find
    orange: '#ff9e64',    // Execution/Bash
    red: '#f7768e',       // Errors/Stop
    teal: '#1abc9c',      // Compaction
  };

  // Get color for hook event types
  const getEventTypeColor = (hookEventType: string): string => {
    const colorMap: Record<string, string> = {
      'UserPromptSubmit': tokyoNightColors.cyan,
      'SessionStart': tokyoNightColors.blue,
      'SessionEnd': tokyoNightColors.blue,
      'Stop': tokyoNightColors.red,
      'SubagentStop': tokyoNightColors.magenta,
      'PreCompact': tokyoNightColors.teal,
      'PreToolUse': tokyoNightColors.yellow,
      'PostToolUse': tokyoNightColors.orange,  // Orange for post-tool
      'Notification': tokyoNightColors.orange,
      'Completed': tokyoNightColors.green,  // Green for completions
    };
    return colorMap[hookEventType] || tokyoNightColors.blue;
  };

  // Get color for tool types
  const getToolTypeColor = (toolName: string): string => {
    // File operations
    if (['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
      return tokyoNightColors.green;
    }
    // Search/Find operations
    if (['Glob', 'Grep', 'WebSearch', 'WebFetch'].includes(toolName)) {
      return tokyoNightColors.yellow;
    }
    // Execution
    if (['Bash', 'BashOutput', 'KillShell'].includes(toolName)) {
      return tokyoNightColors.orange;
    }
    // Task/Agent operations
    if (['Task', 'Skill', 'SlashCommand'].includes(toolName)) {
      return tokyoNightColors.purple;
    }
    // User interaction
    if (['AskUserQuestion', 'TodoWrite'].includes(toolName)) {
      return tokyoNightColors.cyan;
    }
    // Default
    return tokyoNightColors.blue;
  };

  return {
    getColorForSession,
    getColorForApp,
    getGradientForSession,
    getGradientForApp,
    getHexColorForSession,
    getHexColorForApp,
    getEventTypeColor,
    getToolTypeColor
  };
}