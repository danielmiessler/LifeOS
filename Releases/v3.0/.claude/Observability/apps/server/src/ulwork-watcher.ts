// UL Work Watcher — polls GitHub Issues from danielmiessler/ULWork every 30 seconds

const REPO = 'danielmiessler/ULWork';
const POLL_INTERVAL_MS = 30_000;

export interface ULWorkIssue {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  labels: string[];
  assignees: string[];
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface ULWorkUpdate {
  issues: ULWorkIssue[];
  changes: ULWorkChange[];
  lastPolled: number;
}

export interface ULWorkChange {
  issueNumber: number;
  field: 'state' | 'labels' | 'assignees' | 'title' | 'new';
  oldValue?: string;
  newValue: string;
  timestamp: number;
}

let previousIssues: Map<number, ULWorkIssue> = new Map();
let currentIssues: ULWorkIssue[] = [];
let lastPolled = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchIssues(): Promise<ULWorkIssue[]> {
  try {
    const proc = Bun.spawn(
      ['gh', 'issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '50', '--json', 'number,title,state,labels,assignees,author,body,createdAt,updatedAt,url'],
      { stdout: 'pipe', stderr: 'pipe' }
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error('[ulwork-watcher] gh issue list failed:', stderr);
      return [];
    }

    const raw = JSON.parse(stdout);
    return raw.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: (issue.labels || []).map((l: any) => l.name),
      assignees: (issue.assignees || []).map((a: any) => a.login),
      author: issue.author?.login || 'unknown',
      body: issue.body || '',
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      url: issue.url,
    }));
  } catch (err) {
    console.error('[ulwork-watcher] Error fetching issues:', err);
    return [];
  }
}

function detectChanges(newIssues: ULWorkIssue[]): ULWorkChange[] {
  const changes: ULWorkChange[] = [];
  const now = Date.now();

  for (const issue of newIssues) {
    const prev = previousIssues.get(issue.number);

    if (!prev) {
      // New issue we haven't seen before (only flag as 'new' after first poll)
      if (previousIssues.size > 0) {
        changes.push({
          issueNumber: issue.number,
          field: 'new',
          newValue: issue.title,
          timestamp: now,
        });
      }
      continue;
    }

    if (prev.state !== issue.state) {
      changes.push({
        issueNumber: issue.number,
        field: 'state',
        oldValue: prev.state,
        newValue: issue.state,
        timestamp: now,
      });
    }

    if (prev.title !== issue.title) {
      changes.push({
        issueNumber: issue.number,
        field: 'title',
        oldValue: prev.title,
        newValue: issue.title,
        timestamp: now,
      });
    }

    const prevLabels = prev.labels.sort().join(',');
    const newLabels = issue.labels.sort().join(',');
    if (prevLabels !== newLabels) {
      changes.push({
        issueNumber: issue.number,
        field: 'labels',
        oldValue: prevLabels,
        newValue: newLabels,
        timestamp: now,
      });
    }

    const prevAssignees = prev.assignees.sort().join(',');
    const newAssignees = issue.assignees.sort().join(',');
    if (prevAssignees !== newAssignees) {
      changes.push({
        issueNumber: issue.number,
        field: 'assignees',
        oldValue: prevAssignees,
        newValue: newAssignees,
        timestamp: now,
      });
    }
  }

  return changes;
}

export function startULWorkWatcher(onUpdate: (update: ULWorkUpdate) => void) {
  console.log('[ulwork-watcher] Starting UL Work watcher (polling every 30s)');

  const poll = async () => {
    const issues = await fetchIssues();
    if (issues.length === 0 && currentIssues.length === 0) return;

    const changes = detectChanges(issues);
    lastPolled = Date.now();
    currentIssues = issues;

    // Update previous state
    previousIssues = new Map(issues.map(i => [i.number, i]));

    onUpdate({ issues, changes, lastPolled });
  };

  // Initial fetch
  poll();

  // Poll every 30 seconds
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function getULWorkState(): ULWorkUpdate {
  return {
    issues: currentIssues,
    changes: [],
    lastPolled,
  };
}
