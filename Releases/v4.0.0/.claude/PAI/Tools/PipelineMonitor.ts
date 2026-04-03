#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI Pipeline Monitor - Real-time WebSocket Server + UI
 * ============================================================================
 *
 * Monitors pipeline execution across multiple agents in real-time.
 *
 * USAGE:
 *   bun PipelineMonitor.ts                    # Start server
 *   bun PipelineMonitor.ts --port 8765        # Custom port
 *
 * Then open http://localhost:8765 for the UI
 *
 * ============================================================================
 */

const PORT = parseInt(process.argv.find(a => a.startsWith("--port="))?.split("=")[1] || "8765");

// State
interface PipelineExecution {
  id: string;
  agent: string;
  pipeline: string;
  status: "pending" | "running" | "completed" | "failed";
  currentStep?: string;
  steps: StepExecution[];
  startTime: number;
  endTime?: number;
  result?: unknown;
  error?: string;
}

interface StepExecution {
  id: string;
  action: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: number;
  endTime?: number;
  output?: unknown;
  error?: string;
}

const executions: Map<string, PipelineExecution> = new Map();
const clients: Set<WebSocket> = new Set();

// Broadcast to all connected clients
function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of clients) {
    try {
      client.send(message);
    } catch (e) {
      // Client disconnected
      clients.delete(client);
    }
  }
}

// HTML UI - Kanban Board Layout
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PAI Pipeline Kanban</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
      overflow-x: auto;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #334155;
    }
    .header h1 {
      font-size: 24px;
      color: #3b82f6;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .status-dot.disconnected { background: #ef4444; animation: none; }
    .stats {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat {
      background: #1e293b;
      padding: 12px 20px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #3b82f6;
    }
    .stat-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
    }

    /* Kanban Board */
    .kanban-container {
      display: flex;
      gap: 12px;
      min-height: calc(100vh - 180px);
      overflow-x: auto;
      padding-bottom: 20px;
    }
    .kanban-column {
      min-width: 280px;
      max-width: 320px;
      flex-shrink: 0;
      background: #1e293b;
      border-radius: 12px;
      border: 1px solid #334155;
      display: flex;
      flex-direction: column;
    }
    .kanban-column.completed {
      border-color: #166534;
      background: linear-gradient(180deg, #14532d22 0%, #1e293b 100%);
    }
    .kanban-column.failed {
      border-color: #991b1b;
      background: linear-gradient(180deg, #7f1d1d22 0%, #1e293b 100%);
    }
    .column-header {
      padding: 16px;
      border-bottom: 1px solid #334155;
      position: sticky;
      top: 0;
      background: inherit;
      border-radius: 12px 12px 0 0;
    }
    .column-title {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .column-title code {
      font-family: 'SF Mono', Monaco, monospace;
      color: #a5b4fc;
      font-size: 12px;
      background: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .column-count {
      background: #334155;
      color: #e2e8f0;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: auto;
    }
    .column-cards {
      flex: 1;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }

    /* Pipeline Cards */
    .card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      transition: all 0.3s ease;
      cursor: default;
    }
    .card:hover {
      border-color: #3b82f6;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }
    .card.running {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f633;
      animation: cardPulse 2s infinite;
    }
    @keyframes cardPulse {
      0%, 100% { box-shadow: 0 0 0 1px #3b82f633; }
      50% { box-shadow: 0 0 0 3px #3b82f633; }
    }
    .card.completed {
      border-color: #16653488;
    }
    .card.failed {
      border-color: #991b1b88;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .card-pipeline {
      font-weight: 600;
      color: #f1f5f9;
      font-size: 13px;
    }
    .card-agent {
      font-size: 11px;
      color: #64748b;
      background: #334155;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .card-step {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-step code {
      color: #a5b4fc;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .card-progress {
      margin-top: 10px;
      display: flex;
      gap: 4px;
    }
    .progress-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #334155;
      transition: all 0.3s ease;
    }
    .progress-dot.completed { background: #22c55e; }
    .progress-dot.running { background: #3b82f6; animation: pulse 1s infinite; }
    .progress-dot.failed { background: #ef4444; }
    .card-time {
      font-size: 10px;
      color: #64748b;
      margin-top: 8px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .card-error {
      font-size: 11px;
      color: #fca5a5;
      background: #7f1d1d33;
      padding: 6px 8px;
      border-radius: 4px;
      margin-top: 8px;
    }

    .empty {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
      font-size: 13px;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #1e293b;
    }
    ::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="status-dot" id="status-dot"></div>
    <h1>PAI Pipeline Kanban</h1>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value" id="total-count">0</div>
      <div class="stat-label">Pipelines</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="running-count">0</div>
      <div class="stat-label">Running</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="completed-count">0</div>
      <div class="stat-label">Done</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="failed-count">0</div>
      <div class="stat-label">Failed</div>
    </div>
  </div>

  <div class="kanban-container" id="kanban">
    <div class="empty" style="width: 100%;">Waiting for pipeline executions...</div>
  </div>

  <script>
    const pipelines = new Map();
    let ws;

    function connect() {
      ws = new WebSocket('ws://' + location.host + '/ws');
      ws.onopen = () => document.getElementById('status-dot').classList.remove('disconnected');
      ws.onclose = () => {
        document.getElementById('status-dot').classList.add('disconnected');
        setTimeout(connect, 2000);
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleEvent(msg.event, msg.data);
      };
    }

    function handleEvent(event, data) {
      switch (event) {
        case 'init':
          data.executions.forEach(exec => pipelines.set(exec.id, exec));
          render();
          break;
        case 'pipeline:start':
        case 'pipeline:update':
        case 'pipeline:complete':
        case 'pipeline:fail':
          pipelines.set(data.id, data);
          render();
          break;
        case 'step:start':
        case 'step:complete':
        case 'step:fail':
          const exec = pipelines.get(data.executionId);
          if (exec) {
            const step = exec.steps.find(s => s.id === data.stepId);
            if (step) Object.assign(step, data);
            render();
          }
          break;
      }
    }

    function getCurrentStepIndex(exec) {
      if (exec.status === 'completed' || exec.status === 'failed') return exec.steps.length;
      for (let i = 0; i < exec.steps.length; i++) {
        if (exec.steps[i].status === 'running') return i;
        if (exec.steps[i].status === 'pending') return i;
      }
      return exec.steps.length;
    }

    function render() {
      const container = document.getElementById('kanban');
      const arr = Array.from(pipelines.values());

      // Update stats
      document.getElementById('total-count').textContent = arr.length;
      document.getElementById('running-count').textContent = arr.filter(p => p.status === 'running').length;
      document.getElementById('completed-count').textContent = arr.filter(p => p.status === 'completed').length;
      document.getElementById('failed-count').textContent = arr.filter(p => p.status === 'failed').length;

      if (arr.length === 0) {
        container.innerHTML = '<div class="empty" style="width: 100%;">Waiting for pipeline executions...</div>';
        return;
      }

      // Collect all unique actions across all pipelines in order
      const allActions = [];
      const actionSet = new Set();
      arr.forEach(exec => {
        exec.steps.forEach(step => {
          if (!actionSet.has(step.action)) {
            actionSet.add(step.action);
            allActions.push(step.action);
          }
        });
      });

      // Build columns: each action + COMPLETED + FAILED
      const columns = [
        ...allActions.map(action => ({ type: 'action', action })),
        { type: 'completed', action: 'COMPLETED' },
        { type: 'failed', action: 'FAILED' }
      ];

      // Assign each pipeline to a column based on current step
      function getColumnForExec(exec) {
        if (exec.status === 'completed') return 'COMPLETED';
        if (exec.status === 'failed') return 'FAILED';
        const idx = getCurrentStepIndex(exec);
        if (idx < exec.steps.length) {
          return exec.steps[idx].action;
        }
        return 'COMPLETED';
      }

      // Group by column
      const columnMap = {};
      columns.forEach(col => columnMap[col.action] = []);
      arr.forEach(exec => {
        const col = getColumnForExec(exec);
        if (columnMap[col]) columnMap[col].push(exec);
      });

      // Render
      container.innerHTML = columns.map(col => {
        const cards = columnMap[col.action] || [];
        const isCompleted = col.type === 'completed';
        const isFailed = col.type === 'failed';

        return \`
          <div class="kanban-column \${isCompleted ? 'completed' : ''} \${isFailed ? 'failed' : ''}">
            <div class="column-header">
              <div class="column-title">
                \${col.type === 'action' ? \`<code>\${col.action}</code>\` : col.action}
                <span class="column-count">\${cards.length}</span>
              </div>
            </div>
            <div class="column-cards">
              \${cards.length === 0 ? '' : cards.map(exec => {
                const currentIdx = getCurrentStepIndex(exec);
                const currentStep = exec.steps[currentIdx] || exec.steps[exec.steps.length - 1];
                const duration = exec.endTime ? ((exec.endTime - exec.startTime) / 1000).toFixed(2) + 's' : '';

                return \`
                  <div class="card \${exec.status}">
                    <div class="card-header">
                      <span class="card-pipeline">\${exec.pipeline}</span>
                      <span class="card-agent">\${exec.agent}</span>
                    </div>
                    \${exec.status === 'running' && currentStep ? \`
                      <div class="card-step">
                        \${currentStep.status === 'running' ? '◉' : '○'}
                        Step: <code>\${currentStep.id}</code>
                      </div>
                    \` : ''}
                    <div class="card-progress">
                      \${exec.steps.map(s => \`<div class="progress-dot \${s.status}"></div>\`).join('')}
                    </div>
                    \${duration ? \`<div class="card-time">\${duration}</div>\` : ''}
                    \${exec.error ? \`<div class="card-error">\${exec.error}</div>\` : ''}
                  </div>
                \`;
              }).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    connect();
  </script>
</body>
</html>`;

// Bun server
const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) {
        return; // Upgraded
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // API endpoints
    if (url.pathname === "/api/start") {
      // Start a new pipeline execution
      const data = req.json();
      return data.then((body: any) => {
        const execution: PipelineExecution = {
          id: crypto.randomUUID(),
          agent: body.agent || "unknown",
          pipeline: body.pipeline,
          status: "pending",
          steps: (body.steps || []).map((s: any) => ({
            id: s.id,
            action: s.action,
            status: "pending",
          })),
          startTime: Date.now(),
        };
        executions.set(execution.id, execution);
        broadcast("pipeline:start", execution);
        return Response.json({ id: execution.id });
      });
    }

    if (url.pathname === "/api/update") {
      return req.json().then((body: any) => {
        const exec = executions.get(body.id);
        if (!exec) return Response.json({ error: "Not found" }, { status: 404 });

        if (body.status) exec.status = body.status;
        if (body.currentStep) exec.currentStep = body.currentStep;
        if (body.result) exec.result = body.result;
        if (body.error) exec.error = body.error;
        if (body.status === "completed" || body.status === "failed") {
          exec.endTime = Date.now();
        }

        broadcast("pipeline:update", exec);
        return Response.json({ ok: true });
      });
    }

    if (url.pathname === "/api/step") {
      return req.json().then((body: any) => {
        const exec = executions.get(body.executionId);
        if (!exec) return Response.json({ error: "Not found" }, { status: 404 });

        const step = exec.steps.find(s => s.id === body.stepId);
        if (!step) return Response.json({ error: "Step not found" }, { status: 404 });

        if (body.status) step.status = body.status;
        if (body.status === "running") step.startTime = Date.now();
        if (body.status === "completed" || body.status === "failed") step.endTime = Date.now();
        if (body.output !== undefined) step.output = body.output;
        if (body.error) step.error = body.error;

        broadcast("step:" + body.status, { ...step, executionId: body.executionId });
        return Response.json({ ok: true });
      });
    }

    // Serve UI
    return new Response(HTML, {
      headers: { "Content-Type": "text/html" },
    });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      // Send current state
      ws.send(JSON.stringify({
        event: "init",
        data: { executions: Array.from(executions.values()) },
        timestamp: Date.now(),
      }));
    },
    message(ws, message) {
      // Handle incoming messages if needed
    },
    close(ws) {
      clients.delete(ws);
    },
  },
});

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                     PAI Pipeline Monitor                               ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  Server running at:  http://localhost:${PORT}                           ║
║  WebSocket:          ws://localhost:${PORT}/ws                          ║
║                                                                        ║
║  API Endpoints:                                                        ║
║    POST /api/start   - Start new pipeline execution                    ║
║    POST /api/update  - Update pipeline status                          ║
║    POST /api/step    - Update step status                              ║
║                                                                        ║
╚═══════════════════════════════════════════════════════════════════════╝
`);
