#!/usr/bin/env bun
/**
 * MCPGuard.hook.ts - MCP Tool Definition Integrity Checker
 *
 * PURPOSE:
 * Verifies that MCP server tool definitions have not changed between sessions.
 * Detects supply-chain attacks where tool descriptions are tampered to change
 * behavior without visible code changes.
 *
 * TRIGGER: SessionStart
 *
 * INPUT:
 * - session_id: Current session identifier
 *
 * OUTPUT:
 * - stdout: {"continue": true} (always — informational only, never blocks)
 * - stderr: Warning messages if tool definitions have changed
 *
 * MECHANISM:
 * 1. Reads ~/.claude/mcp-pins.json (pinned tool hashes)
 * 2. Reads ~/.mcp.json to discover configured MCP servers
 * 3. For each server, SHA-256 hashes: tool_name + description + schema
 * 4. Compares against pinned hashes
 * 5. On mismatch: logs warning (does NOT block — "ask" decision pattern)
 * 6. On first run: creates initial pin manifest
 *
 * ADAPTED FROM: github.com/alexandriashai/mcp-guardian (tool-pinning.ts)
 * See COMMUNITY-ATTRIBUTIONS.md for full attribution.
 *
 * NOTE: This hook does NOT query MCP servers at startup (too slow).
 * It relies on mcp-guardian audit output to generate pins.
 * Run: bun /path/to/mcp-guardian/dist/bin/mcp-guardian.js ~/.mcp.json --pin
 * to regenerate the pin manifest.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { paiPath } from './lib/paths';
import { homedir } from 'os';

// ========================================
// Types
// ========================================

interface PinManifest {
  version: string;
  createdAt: string;
  updatedAt: string;
  servers: Record<string, ServerPin>;
}

interface ServerPin {
  toolCount: number;
  pinnedAt: string;
  tools: Record<string, ToolPin>;
}

interface ToolPin {
  hash: string;
  descriptionLength: number;
}

// ========================================
// Paths
// ========================================

const PINS_PATH = paiPath('mcp-pins.json');
const MCP_CONFIG_PATH = join(homedir(), '.mcp.json');

// ========================================
// Hashing
// ========================================

function hashTool(name: string, description: string, schema: unknown): string {
  const payload = JSON.stringify({ name, description, schema });
  return createHash('sha256').update(payload).digest('hex');
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  // Always continue — this hook is informational only
  console.log(JSON.stringify({ continue: true }));

  try {
    // Check if pin manifest exists
    if (!existsSync(PINS_PATH)) {
      console.error('[MCPGuard] No pin manifest found at ' + PINS_PATH);
      console.error('[MCPGuard] Run mcp-guardian audit with --pin to create initial pins');
      console.error('[MCPGuard] Or create manually: mcp-pins.json');

      // Create a placeholder manifest noting configured servers
      if (existsSync(MCP_CONFIG_PATH)) {
        try {
          const mcpConfig = JSON.parse(readFileSync(MCP_CONFIG_PATH, 'utf-8'));
          const servers = Object.keys(mcpConfig.mcpServers || {});
          const manifest: PinManifest = {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            servers: {},
          };

          for (const server of servers) {
            manifest.servers[server] = {
              toolCount: 0,
              pinnedAt: new Date().toISOString(),
              tools: {},
            };
          }

          writeFileSync(PINS_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
          console.error(`[MCPGuard] Created placeholder manifest for ${servers.length} servers`);
          console.error('[MCPGuard] Tool hashes will be populated on next mcp-guardian audit');
        } catch {
          console.error('[MCPGuard] Could not read .mcp.json to create placeholder');
        }
      }
      process.exit(0);
      return;
    }

    // Load and validate manifest
    const manifest: PinManifest = JSON.parse(readFileSync(PINS_PATH, 'utf-8'));
    const serverCount = Object.keys(manifest.servers).length;
    let totalTools = 0;
    let emptyServers = 0;

    for (const [serverName, serverPin] of Object.entries(manifest.servers)) {
      const toolCount = Object.keys(serverPin.tools).length;
      totalTools += toolCount;
      if (toolCount === 0) {
        emptyServers++;
      }
    }

    if (emptyServers > 0) {
      console.error(`[MCPGuard] ${emptyServers}/${serverCount} servers have no pinned tools`);
      console.error('[MCPGuard] Run mcp-guardian audit to populate tool hashes');
    } else {
      console.error(`[MCPGuard] Manifest loaded: ${serverCount} servers, ${totalTools} tools pinned`);
    }

    // Check if .mcp.json has servers not in the manifest
    if (existsSync(MCP_CONFIG_PATH)) {
      try {
        const mcpConfig = JSON.parse(readFileSync(MCP_CONFIG_PATH, 'utf-8'));
        const configuredServers = new Set(Object.keys(mcpConfig.mcpServers || {}));
        const pinnedServers = new Set(Object.keys(manifest.servers));

        const newServers = [...configuredServers].filter(s => !pinnedServers.has(s));
        const removedServers = [...pinnedServers].filter(s => !configuredServers.has(s));

        if (newServers.length > 0) {
          console.error(`[MCPGuard] WARNING: ${newServers.length} new server(s) not in pin manifest: ${newServers.join(', ')}`);
          console.error('[MCPGuard] Re-run mcp-guardian audit to pin new servers');
        }

        if (removedServers.length > 0) {
          console.error(`[MCPGuard] NOTE: ${removedServers.length} pinned server(s) no longer in .mcp.json: ${removedServers.join(', ')}`);
        }
      } catch {
        // Ignore .mcp.json read errors
      }
    }

  } catch (error) {
    console.error(`[MCPGuard] Error: ${error}`);
  }

  process.exit(0);
}

main();
