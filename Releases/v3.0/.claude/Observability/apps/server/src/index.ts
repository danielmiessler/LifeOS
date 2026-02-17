import { homedir } from 'os';
import { join } from 'path';
import type { HookEvent } from './types';
import {
  createTheme,
  updateThemeById,
  getThemeById,
  searchThemes,
  deleteThemeById,
  exportThemeById,
  importTheme,
  getThemeStats
} from './theme';
import { startFileIngestion, getRecentEvents, getFilterOptions } from './file-ingest';
import { startTaskWatcher, getAllTasks, getTask, getTaskOutput, type BackgroundTask } from './task-watcher';
import { startULWorkWatcher, getULWorkState, type ULWorkUpdate } from './ulwork-watcher';

// Store WebSocket clients
const wsClients = new Set<any>();

// Start file-based ingestion (reads from ~/.claude/projects/)
// Pass a callback to broadcast new events to connected WebSocket clients
startFileIngestion((events) => {
  // Broadcast each event to all connected WebSocket clients
  events.forEach(event => {
    const message = JSON.stringify({ type: 'event', data: event });
    wsClients.forEach(client => {
      try {
        client.send(message);
      } catch (err) {
        // Client disconnected, remove from set
        wsClients.delete(client);
      }
    });
  });
});

// Start background task watcher
startTaskWatcher((task: BackgroundTask) => {
  // Broadcast task updates to all connected WebSocket clients
  const message = JSON.stringify({ type: 'task_update', data: task });
  wsClients.forEach(client => {
    try {
      client.send(message);
    } catch (err) {
      wsClients.delete(client);
    }
  });
});

// Start UL Work watcher (polls GitHub Issues every 30s)
startULWorkWatcher((update: ULWorkUpdate) => {
  const message = JSON.stringify({ type: 'ulwork_update', data: update });
  wsClients.forEach(client => {
    try {
      client.send(message);
    } catch (err) {
      wsClients.delete(client);
    }
  });
});

// Create Bun server with HTTP and WebSocket support
const server = Bun.serve({
  port: 4000,
  
  async fetch(req: Request) {
    const url = new URL(req.url);
    
    // Handle CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    // GET /events/filter-options - Get available filter options
    if (url.pathname === '/events/filter-options' && req.method === 'GET') {
      const options = getFilterOptions();
      return new Response(JSON.stringify(options), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /events/recent - Get recent events
    if (url.pathname === '/events/recent' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const events = getRecentEvents(limit);
      return new Response(JSON.stringify(events), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /events/by-agent/:agentName - Get events for specific agent
    if (url.pathname.startsWith('/events/by-agent/') && req.method === 'GET') {
      const agentName = decodeURIComponent(url.pathname.split('/')[3]);
      const limit = parseInt(url.searchParams.get('limit') || '100');

      if (!agentName) {
        return new Response(JSON.stringify({
          error: 'Agent name is required'
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const allEvents = getRecentEvents(limit);
      const agentEvents = allEvents.filter(e => e.agent_name === agentName);

      return new Response(JSON.stringify(agentEvents), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Theme API endpoints
    
    // POST /api/themes - Create a new theme
    if (url.pathname === '/api/themes' && req.method === 'POST') {
      try {
        const themeData = await req.json();
        const result = await createTheme(themeData);
        
        const status = result.success ? 201 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error creating theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/themes - Search themes
    if (url.pathname === '/api/themes' && req.method === 'GET') {
      const query = {
        query: url.searchParams.get('query') || undefined,
        isPublic: url.searchParams.get('isPublic') ? url.searchParams.get('isPublic') === 'true' : undefined,
        authorId: url.searchParams.get('authorId') || undefined,
        sortBy: url.searchParams.get('sortBy') as any || undefined,
        sortOrder: url.searchParams.get('sortOrder') as any || undefined,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
      };
      
      const result = await searchThemes(query);
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/themes/:id - Get a specific theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      const result = await getThemeById(id);
      const status = result.success ? 200 : 404;
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // PUT /api/themes/:id - Update a theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'PUT') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const updates = await req.json();
        const result = await updateThemeById(id, updates);
        
        const status = result.success ? 200 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error updating theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // DELETE /api/themes/:id - Delete a theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'DELETE') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      const authorId = url.searchParams.get('authorId');
      const result = await deleteThemeById(id, authorId || undefined);
      
      const status = result.success ? 200 : (result.error?.includes('not found') ? 404 : 403);
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/themes/:id/export - Export a theme
    if (url.pathname.match(/^\/api\/themes\/[^\/]+\/export$/) && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      
      const result = await exportThemeById(id);
      if (!result.success) {
        const status = result.error?.includes('not found') ? 404 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(result.data), {
        headers: { 
          ...headers, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${result.data.theme.name}.json"`
        }
      });
    }
    
    // POST /api/themes/import - Import a theme
    if (url.pathname === '/api/themes/import' && req.method === 'POST') {
      try {
        const importData = await req.json();
        const authorId = url.searchParams.get('authorId');
        
        const result = await importTheme(importData, authorId || undefined);
        
        const status = result.success ? 201 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error importing theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid import data' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/themes/stats - Get theme statistics
    if (url.pathname === '/api/themes/stats' && req.method === 'GET') {
      const result = await getThemeStats();
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/activities - Get current activities from Kitty tab titles
    if (url.pathname === '/api/activities' && req.method === 'GET') {
      try {
        // Run kitty @ ls to get tab/window info
        const proc = Bun.spawn(['kitty', '@', 'ls'], {
          stdout: 'pipe',
          stderr: 'pipe'
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          return new Response(JSON.stringify([]), {
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const kittyData = JSON.parse(stdout);
        const activities: { agent: string; activity: string; timestamp: string }[] = [];

        // Parse ALL Kitty tabs - just return their titles as-is
        for (const osWindow of kittyData) {
          for (const tab of osWindow.tabs || []) {
            // Strip trailing ellipsis and leading "N: " tab number prefix
            const title = (tab.title || '')
              .replace(/\.{3}$/, '')
              .replace(/^\d+:\s*/, '')
              .trim();

            if (!title) continue;

            activities.push({
              agent: process.env.DA || 'main',
              activity: title,
              timestamp: new Date().toISOString()
            });
          }
        }

        return new Response(JSON.stringify(activities), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching Kitty activities:', error);
        return new Response(JSON.stringify([]), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/haiku/summarize - Proxy for Haiku summarization (uses Inference tool)
    if (url.pathname === '/api/haiku/summarize' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing prompt'
          }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        // Use Inference tool (via CLI subprocess) instead of direct API
        const proc = Bun.spawn(['bun', 'run', join(process.env.HOME || process.env.USERPROFILE || homedir(), '.claude', 'skills', 'PAI', 'Tools', 'Inference.ts'), '--level', 'fast', 'You are a helpful assistant. Be concise.', prompt], {
          stdout: 'pipe',
          stderr: 'pipe',
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          return new Response(JSON.stringify({
            success: false,
            error: `Inference failed: ${stderr}`
          }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          text: stdout.trim()
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error in Haiku proxy:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Internal server error'
        }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/tasks - List all background tasks
    if (url.pathname === '/api/tasks' && req.method === 'GET') {
      const tasks = getAllTasks();
      return new Response(JSON.stringify(tasks), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/tasks/:taskId - Get a specific task
    if (url.pathname.match(/^\/api\/tasks\/[^\/]+$/) && req.method === 'GET') {
      const taskId = url.pathname.split('/')[3];
      const task = getTask(taskId);

      if (!task) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(task), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/tasks/:taskId/output - Get full task output
    if (url.pathname.match(/^\/api\/tasks\/[^\/]+\/output$/) && req.method === 'GET') {
      const taskId = url.pathname.split('/')[3];
      const output = getTaskOutput(taskId);

      if (!output) {
        return new Response(JSON.stringify({ error: 'Task output not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ output }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/ulwork - Get current UL Work state
    if (url.pathname === '/api/ulwork' && req.method === 'GET') {
      const state = getULWorkState();
      return new Response(JSON.stringify(state), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // WebSocket upgrade
    if (url.pathname === '/stream') {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
    }

    // Default response
    return new Response('Multi-Agent Observability Server', {
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      console.log('WebSocket client connected');
      wsClients.add(ws);
      
      // Send recent events on connection
      const events = getRecentEvents(50);
      ws.send(JSON.stringify({ type: 'initial', data: events }));

      // Send current UL Work state
      const ulworkState = getULWorkState();
      if (ulworkState.issues.length > 0) {
        ws.send(JSON.stringify({ type: 'ulwork_update', data: ulworkState }));
      }
    },
    
    message(ws, message) {
      // Handle any client messages if needed
      console.log('Received message:', message);
    },
    
    close(ws) {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    },
    
    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    }
  }
});

console.log(`🚀 Server running on http://localhost:${server.port}`);
console.log(`📊 WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`📮 POST events to: http://localhost:${server.port}/events`);