/**
 * Background Task Watcher
 * Monitors /tmp/claude tasks directory for background agent tasks
 * Handles both JSONL (Task agents) and plain text (Bash commands)
 * Uses Haiku for intelligent task naming
 */

import { watch, existsSync, readdirSync, readlinkSync, statSync, lstatSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  lastActivity: number;
  description: string;      // Human-readable description of what the task is doing
  prompt?: string;          // Original prompt/command
  result?: string;          // Final output (truncated)
  error?: string;
  eventCount: number;
  outputFile: string;
  outputPreview: string;    // Last few lines of output
  taskType: 'bash' | 'agent' | 'unknown';
}

// In-memory task store
const tasks = new Map<string, BackgroundTask>();

// Description cache to avoid repeated LLM calls
const descriptionCache = new Map<string, string>();

// Pending description requests (to avoid duplicate calls)
const pendingDescriptions = new Set<string>();

// Callback for task updates
let onTaskUpdate: ((task: BackgroundTask) => void) | null = null;

// Tasks directory - dynamically constructed from username
const TASKS_DIR = `/tmp/claude/-Users-${process.env.USER || 'user'}--claude/tasks`;

// Idle threshold for determining completion (30 seconds)
const IDLE_THRESHOLD_MS = 30000;

/**
 * Load API key from ~/.claude/.env
 */
function loadApiKey(): string | null {
  try {
    const envPath = join(homedir(), '.claude', '.env');
    if (!existsSync(envPath)) {
      return null;
    }
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
    if (match) {
      return match[1].trim();
    }
    return null;
  } catch {
    return null;
  }
}

// Cache the API key
let cachedApiKey: string | null = null;

/**
 * Generate task description using Haiku (fast inference)
 */
async function generateDescription(taskId: string, content: string): Promise<string | null> {
  // Check cache first
  if (descriptionCache.has(taskId)) {
    return descriptionCache.get(taskId)!;
  }

  // Skip if already pending
  if (pendingDescriptions.has(taskId)) {
    return null;
  }

  // Need at least some content
  if (content.length < 20) {
    return null;
  }

  // Load API key from ~/.claude/.env
  if (cachedApiKey === null) {
    cachedApiKey = loadApiKey() || '';
  }

  if (!cachedApiKey) {
    // Only log once
    return null;
  }

  pendingDescriptions.add(taskId);

  try {
    // Take first 1000 chars of output for context
    const outputSample = content.slice(0, 1000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cachedApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `Based on this command output, give a 2-5 word description of what this background task is doing. Be specific and concise. Just respond with the description, nothing else.

Output:
${outputSample}`
        }]
      })
    });

    if (!response.ok) {
      console.error('[task-watcher] Haiku API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    const description = data.content?.[0]?.text?.trim();

    if (description && description.length > 0 && description.length < 100) {
      descriptionCache.set(taskId, description);
      console.log(`[task-watcher] Generated description for ${taskId}: "${description}"`);
      return description;
    }

    return null;
  } catch (err) {
    console.error('[task-watcher] Error generating description:', err);
    return null;
  } finally {
    pendingDescriptions.delete(taskId);
  }
}

/**
 * Infer task description from output content using pattern matching
 */
function inferDescription(content: string, taskId: string): string {
  const lines = content.split('\n').filter(l => l.trim());
  const lowerContent = content.toLowerCase();

  // === Server/Service Patterns ===
  if (lowerContent.includes('server running') || lowerContent.includes('listening on') || lowerContent.includes('server on')) {
    const portMatch = content.match(/(?:port|localhost:|:)(\d{4,5})/i);
    if (portMatch) {
      if (lowerContent.includes('observability') || lowerContent.includes('event')) {
        return `Observability Server :${portMatch[1]}`;
      }
      if (lowerContent.includes('vite') || lowerContent.includes('hmr')) {
        return `Vite Dev Server :${portMatch[1]}`;
      }
      return `Server :${portMatch[1]}`;
    }
    return 'Running Server';
  }

  // === Build/Test/Dev Patterns ===
  if (lowerContent.includes('npm run') || lowerContent.includes('bun run') || lowerContent.includes('pnpm run')) {
    if (lowerContent.includes('test')) return 'Running Tests';
    if (lowerContent.includes('build')) return 'Building Project';
    if (lowerContent.includes('dev')) return 'Dev Server';
    if (lowerContent.includes('lint')) return 'Linting Code';
    if (lowerContent.includes('typecheck')) return 'Type Checking';
  }

  // === Git Patterns ===
  if (lowerContent.includes('git ')) {
    if (lowerContent.includes('push')) return 'Git Push';
    if (lowerContent.includes('pull')) return 'Git Pull';
    if (lowerContent.includes('commit')) return 'Git Commit';
    if (lowerContent.includes('clone')) return 'Git Clone';
    if (lowerContent.includes('fetch')) return 'Git Fetch';
    if (lowerContent.includes('merge')) return 'Git Merge';
    if (lowerContent.includes('rebase')) return 'Git Rebase';
  }

  // === Browser/Screenshot Patterns ===
  if (lowerContent.includes('browse.ts') || lowerContent.includes('playwright') || lowerContent.includes('puppeteer')) {
    if (lowerContent.includes('screenshot')) return 'Taking Screenshot';
    if (lowerContent.includes('click')) return 'Browser Click Action';
    return 'Browser Automation';
  }
  if (lowerContent.includes('screenshot')) return 'Taking Screenshot';

  // === File Watching Patterns ===
  if (lowerContent.includes('watching:') || lowerContent.includes('file watcher') || lowerContent.includes('watch mode')) {
    if (lowerContent.includes('.jsonl')) return 'Watching JSONL Files';
    if (lowerContent.includes('.ts')) return 'Watching TypeScript';
    return 'File Watcher';
  }

  // === Event/Message Patterns ===
  if ((lowerContent.includes('received') && lowerContent.includes('event')) || lowerContent.includes('websocket')) {
    if (lowerContent.includes('observability')) return 'Observability Server';
    return 'Event Processing';
  }

  // === Docker Patterns ===
  if (lowerContent.includes('docker')) {
    if (lowerContent.includes('build')) return 'Docker Build';
    if (lowerContent.includes('run')) return 'Docker Run';
    if (lowerContent.includes('compose')) return 'Docker Compose';
    return 'Docker Command';
  }

  // === Install Patterns ===
  if (lowerContent.includes('installing') || lowerContent.includes('npm install') || lowerContent.includes('bun install')) {
    return 'Installing Dependencies';
  }

  // === Deploy Patterns ===
  if (lowerContent.includes('deploy') || lowerContent.includes('cloudflare') || lowerContent.includes('vercel')) {
    return 'Deploying';
  }

  // === API/Curl Patterns ===
  if (lowerContent.includes('curl ') || lowerContent.includes('http request') || lowerContent.includes('api call')) {
    return 'API Request';
  }

  // === Database Patterns ===
  if (lowerContent.includes('database') || lowerContent.includes('postgresql') || lowerContent.includes('mysql') || lowerContent.includes('sqlite')) {
    return 'Database Operation';
  }

  // === Search Patterns ===
  if (lowerContent.includes('searching') || lowerContent.includes('grep') || lowerContent.includes('find ')) {
    return 'Searching Files';
  }

  // === Claude/AI Patterns ===
  if (lowerContent.includes('claude') || lowerContent.includes('anthropic') || lowerContent.includes('ai agent')) {
    return 'AI Agent Task';
  }

  // === Extract meaningful first line as fallback ===
  for (const line of lines.slice(0, 10)) {
    let trimmed = line.trim();

    // Skip noise
    if (trimmed.startsWith('[') || trimmed.startsWith('#') ||
        trimmed.startsWith('//') || trimmed.startsWith('$') ||
        trimmed.length < 5 || trimmed.length > 80) continue;

    // Skip common log prefixes
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}/) || trimmed.match(/^\[\w+\]/)) continue;

    // Clean up emojis and special chars
    trimmed = trimmed.replace(/[🔍✅❌📂📊🚀👀💡⚡🎯📝🔧⚙️🌐📦🔄]/g, '').trim();

    // Skip if too short after cleanup
    if (trimmed.length < 5) continue;

    // Capitalize first letter and limit length
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1, 50);
  }

  return `Background Task ${taskId.slice(0, 7)}`;
}

/**
 * Get last N lines of output as preview
 */
function getOutputPreview(content: string, maxLines: number = 10): string {
  const lines = content.split('\n').filter(l => l.trim());
  const lastLines = lines.slice(-maxLines);
  return lastLines.join('\n');
}

/**
 * Parse plain text output file (for Bash commands)
 */
function parsePlainTextFile(filePath: string, taskId: string): Partial<BackgroundTask> | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const stats = statSync(filePath);

    // Check for error indicators
    let error = '';
    const errorLine = lines.find(l =>
      l.toLowerCase().includes('error') ||
      l.toLowerCase().includes('failed') ||
      l.toLowerCase().includes('exception')
    );
    if (errorLine) {
      error = errorLine.slice(0, 200);
    }

    return {
      taskId,
      sessionId: '',
      agentId: taskId,
      startedAt: stats.birthtime.getTime(),
      lastActivity: stats.mtime.getTime(),
      description: inferDescription(content, taskId),
      prompt: lines[0]?.slice(0, 200) || '',
      result: lines.slice(-5).join('\n').slice(0, 500),
      error,
      eventCount: lines.length,
      outputPreview: getOutputPreview(content),
      taskType: 'bash'
    };
  } catch (err) {
    console.error(`Error parsing plain text file ${filePath}:`, err);
    return null;
  }
}

/**
 * Parse a JSONL file (for Task agents)
 */
function parseJsonlFile(filePath: string, taskId: string): Partial<BackgroundTask> | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      return null;
    }

    let sessionId = '';
    let agentId = taskId;
    let startedAt = Date.now();
    let prompt = '';
    let result = '';
    let error = '';
    let lastTimestamp = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (!sessionId && entry.sessionId) {
          sessionId = entry.sessionId;
        }
        if (entry.agentId) {
          agentId = entry.agentId;
        }

        if (entry.timestamp) {
          const ts = new Date(entry.timestamp).getTime();
          if (startedAt === Date.now() || ts < startedAt) {
            startedAt = ts;
          }
          if (ts > lastTimestamp) {
            lastTimestamp = ts;
          }
        }

        // Extract user prompt
        if (entry.type === 'user' && entry.message?.content && !prompt) {
          const msgContent = entry.message.content;
          if (typeof msgContent === 'string') {
            prompt = msgContent.slice(0, 500);
          } else if (Array.isArray(msgContent)) {
            const textPart = msgContent.find((c: any) => c.type === 'text');
            if (textPart?.text) {
              prompt = textPart.text.slice(0, 500);
            }
          }
        }

        // Extract assistant response
        if (entry.type === 'assistant' && entry.message?.content) {
          const msgContent = entry.message.content;
          if (Array.isArray(msgContent)) {
            const textPart = msgContent.find((c: any) => c.type === 'text');
            if (textPart?.text) {
              result = textPart.text.slice(0, 1000);
            }
          }
        }

        if (entry.error || entry.message?.error) {
          error = entry.error || entry.message?.error;
        }
      } catch {
        // Line is not JSON, skip
      }
    }

    return {
      taskId,
      sessionId,
      agentId,
      startedAt,
      lastActivity: lastTimestamp || startedAt,
      description: prompt ? prompt.slice(0, 60) : `Agent ${taskId}`,
      prompt,
      result,
      error,
      eventCount: lines.length,
      outputPreview: result.slice(0, 500),
      taskType: 'agent'
    };
  } catch (err) {
    console.error(`Error parsing JSONL file ${filePath}:`, err);
    return null;
  }
}

/**
 * Parse task file - auto-detects format (JSONL vs plain text)
 */
function parseTaskFile(filePath: string, taskId: string): Partial<BackgroundTask> | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n')[0]?.trim() || '';

    // Check if first line is valid JSON (JSONL format)
    try {
      JSON.parse(firstLine);
      return parseJsonlFile(filePath, taskId);
    } catch {
      // Not JSONL, parse as plain text
      return parsePlainTextFile(filePath, taskId);
    }
  } catch (err) {
    console.error(`Error reading task file ${filePath}:`, err);
    return null;
  }
}

/**
 * Determine task status based on file activity and content
 */
function determineStatus(task: Partial<BackgroundTask>, filePath: string): 'running' | 'completed' | 'failed' {
  try {
    const stats = statSync(filePath);
    const lastModified = stats.mtime.getTime();
    const now = Date.now();

    // If file was modified recently, task is still running
    if (now - lastModified < IDLE_THRESHOLD_MS) {
      return 'running';
    }

    // If we have an error, mark as failed
    if (task.error) {
      return 'failed';
    }

    // Otherwise, completed
    return 'completed';
  } catch {
    return 'failed';
  }
}

/**
 * Scan a single task file and update the task store
 */
function scanTask(taskId: string): BackgroundTask | null {
  const taskPath = join(TASKS_DIR, `${taskId}.output`);

  if (!existsSync(taskPath)) {
    return null;
  }

  try {
    // Check if it's a symlink or regular file
    const lstats = lstatSync(taskPath);
    const realPath = lstats.isSymbolicLink()
      ? readlinkSync(taskPath)
      : taskPath;

    if (!existsSync(realPath)) {
      return null;
    }

    const taskData = parseTaskFile(realPath, taskId);
    if (!taskData) {
      return null;
    }

    const status = determineStatus(taskData, realPath);
    const completedAt = status !== 'running' ? taskData.lastActivity : undefined;

    // Use cached LLM description if available, otherwise use fallback
    const cachedDescription = descriptionCache.get(taskId);
    const description = cachedDescription || taskData.description || `Task ${taskId}`;

    const task: BackgroundTask = {
      taskId,
      sessionId: taskData.sessionId || '',
      agentId: taskData.agentId || taskId,
      status,
      startedAt: taskData.startedAt || Date.now(),
      completedAt,
      lastActivity: taskData.lastActivity || Date.now(),
      description,
      prompt: taskData.prompt,
      result: taskData.result,
      error: taskData.error,
      eventCount: taskData.eventCount || 0,
      outputFile: realPath,
      outputPreview: taskData.outputPreview || '',
      taskType: taskData.taskType || 'unknown'
    };

    // Update store and notify
    const existing = tasks.get(taskId);
    tasks.set(taskId, task);

    // Trigger async LLM description generation if not cached
    // Only generate if we have meaningful output and no cached description
    if (!cachedDescription && taskData.outputPreview && taskData.outputPreview.length > 50) {
      generateDescription(taskId, taskData.outputPreview).then(llmDescription => {
        if (llmDescription) {
          // Update task with LLM description
          const updatedTask = tasks.get(taskId);
          if (updatedTask) {
            updatedTask.description = llmDescription;
            tasks.set(taskId, updatedTask);
            if (onTaskUpdate) {
              onTaskUpdate(updatedTask);
            }
          }
        }
      });
    }

    // Notify on any change
    if (!existing ||
        existing.status !== task.status ||
        existing.eventCount !== task.eventCount ||
        existing.outputPreview !== task.outputPreview ||
        existing.description !== task.description) {
      if (onTaskUpdate) {
        onTaskUpdate(task);
      }
    }

    return task;
  } catch (err) {
    console.error(`Error scanning task ${taskId}:`, err);
    return null;
  }
}

/**
 * Scan all tasks in the directory
 */
function scanAllTasks(): void {
  if (!existsSync(TASKS_DIR)) {
    return;
  }

  try {
    const files = readdirSync(TASKS_DIR);
    const currentTaskIds = new Set<string>();

    for (const file of files) {
      if (file.endsWith('.output')) {
        const taskId = basename(file, '.output');
        currentTaskIds.add(taskId);
        scanTask(taskId);
      }
    }

    // Remove tasks that no longer exist in the directory
    for (const taskId of tasks.keys()) {
      if (!currentTaskIds.has(taskId)) {
        tasks.delete(taskId);
        descriptionCache.delete(taskId);
      }
    }
  } catch (err) {
    console.error('Error scanning tasks directory:', err);
  }
}

/**
 * Start watching for task updates
 */
export function startTaskWatcher(callback?: (task: BackgroundTask) => void): void {
  console.log('🔍 Starting background task watcher');
  console.log(`📂 Watching: ${TASKS_DIR}`);

  // Load API key on startup
  cachedApiKey = loadApiKey() || '';
  if (cachedApiKey) {
    console.log('🔑 Haiku API key loaded for intelligent task naming');
  } else {
    console.log('⚠️ No API key found in ~/.claude/.env - using pattern matching for task names');
  }

  if (callback) {
    onTaskUpdate = callback;
  }

  // Initial scan
  scanAllTasks();
  console.log(`✅ Found ${tasks.size} background task(s)`);

  // Watch for new tasks and updates
  if (existsSync(TASKS_DIR)) {
    watch(TASKS_DIR, (eventType, filename) => {
      if (filename && filename.endsWith('.output')) {
        const taskId = basename(filename, '.output');
        scanTask(taskId);
      }
    });
  }

  // Periodic scan to update running task status (every 2 seconds for better responsiveness)
  setInterval(() => {
    for (const [taskId, task] of tasks) {
      if (task.status === 'running') {
        scanTask(taskId);
      }
    }
  }, 2000);
}

/**
 * Get all tasks (rescans directory to catch any missed files)
 */
export function getAllTasks(): BackgroundTask[] {
  // Always do a fresh scan to catch any files the watcher missed
  scanAllTasks();
  return Array.from(tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Get a specific task by ID
 */
export function getTask(taskId: string): BackgroundTask | null {
  return scanTask(taskId);
}

/**
 * Get full task output (not truncated)
 */
export function getTaskOutput(taskId: string): string | null {
  const task = tasks.get(taskId);
  if (!task) {
    return null;
  }

  try {
    const content = readFileSync(task.outputFile, 'utf-8');
    return content;
  } catch {
    return null;
  }
}
