#!/usr/bin/env bun
/**
 * ElicitationHandler.hook.ts - MCP Elicitation Auto-Respond (Elicitation)
 *
 * TRIGGER: Elicitation (fires when MCP server requests structured input)
 * Added: v2.1.76
 *
 * When MCP servers (Stripe, Bright Data, etc.) request user input mid-task,
 * this hook logs the request. For known safe patterns, it can auto-respond.
 * For unknown patterns, it passes through to show the interactive dialog.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { paiPath } from './lib/paths';
import { getISOTimestamp, getPSTDate, getYearMonth } from './lib/time';

interface ElicitationInput {
  mcp_server_name?: string;
  elicitation_schema?: Record<string, unknown>;
  elicitation_message?: string;
}

function main() {
  let input: ElicitationInput;
  try {
    input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
  } catch {
    process.exit(0);
  }

  const timestamp = getISOTimestamp();
  const [year, month] = getYearMonth().split('-');
  const logDir = paiPath('MEMORY', 'SECURITY', year, month);

  // Log all elicitation requests for audit
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp,
    event_type: 'elicitation_request',
    server: input.mcp_server_name || 'unknown',
    schema: input.elicitation_schema || null,
    message: input.elicitation_message || null
  };

  try {
    appendFileSync(
      `${logDir}/elicitation-${getPSTDate()}.jsonl`,
      JSON.stringify(logEntry) + '\n'
    );
  } catch {
    // Silent
  }

  // Pass through to interactive dialog (don't auto-respond by default).
  // To auto-respond for specific MCP servers, add patterns here:
  //
  // if (input.mcp_server_name === 'stripe' && input.elicitation_schema?.type === 'confirmation') {
  //   console.log(JSON.stringify({
  //     hookSpecificOutput: {
  //       hookEventName: 'Elicitation',
  //       elicitationResponse: { confirmed: true }
  //     }
  //   }));
  // }

  process.exit(0);
}

main();
