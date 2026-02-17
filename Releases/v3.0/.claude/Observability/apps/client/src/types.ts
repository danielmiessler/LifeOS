// Todo item interface
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// New interface for human-in-the-loop requests
export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[]; // For multiple choice questions
  timeout?: number; // Optional timeout in seconds
  requiresResponse?: boolean; // Whether response is required or optional
}

// Response interface
export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string; // Selected choice from options
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string; // Optional user identifier
}

// Status tracking interface
export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  model_name?: string;
  agent_name?: string; // NEW: Agent name enriched by server (Phase 1)

  // NEW: Optional HITL data
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;

  // NEW: Optional Todo data
  todos?: TodoItem[];
  completedTodos?: TodoItem[];  // Todos that were completed in this event
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'hitl_response' | 'task_update' | 'ulwork_update';
  data: HookEvent | HookEvent[] | HumanInTheLoopResponse | any;
}

export type TimeRange = '1M' | '2M' | '4M' | '8M' | '16M';

export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  lastActivity: number;
  description: string;      // Human-readable description
  prompt?: string;
  result?: string;
  error?: string;
  eventCount: number;
  outputFile: string;
  outputPreview: string;    // Last few lines of output
  taskType: 'bash' | 'agent' | 'unknown';
}

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  sessions: Record<string, number>; // session id -> count
  apps?: Record<string, number>; // app name -> count (optional for backward compatibility)
  summaryText?: string; // Optional AI-generated summary for clustered events
  isCluster?: boolean; // Whether this represents multiple aggregated events
  clusterId?: string; // Unique ID for the cluster
  rawEvents?: HookEvent[]; // Raw events for this data point (for drill-down)
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}