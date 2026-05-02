#!/usr/bin/env bun
/**
 * StopFailureHandler.hook.ts - API Error Recovery (StopFailure)
 *
 * TRIGGER: StopFailure (fires when turn ends due to API error)
 * Added: v2.1.78
 *
 * Logs API failures (rate limits, auth errors, server errors) and sends
 * a voice notification so {{PRINCIPAL_NAME}} knows the session hit an error.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { paiPath } from './lib/paths';
import { getISOTimestamp, getPSTDate, getYearMonth } from './lib/time';
import { getVoiceId } from './lib/identity';

interface StopFailureInput {
  session_id?: string;
  hook_event_name?: string;
  error?: string;
}

async function main() {
  let input: StopFailureInput;
  try {
    input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
  } catch {
    process.exit(0);
  }

  const timestamp = getISOTimestamp();
  const [year, month] = getYearMonth().split('-');
  const logDir = paiPath('MEMORY', 'SECURITY', year, month);

  // Log the failure
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp,
    session_id: input.session_id || 'unknown',
    event_type: 'stop_failure',
    hook_event: input.hook_event_name || 'StopFailure',
    error_details: input.error || 'unknown API error'
  };

  try {
    appendFileSync(
      `${logDir}/stop-failures-${getPSTDate()}.jsonl`,
      JSON.stringify(logEntry) + '\n'
    );
  } catch {
    // Silent — don't block on logging failure
  }

  // Voice notification for API errors
  try {
    await fetch('http://localhost:31337/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'API error ended the turn. Check the session.',
        voice_id: getVoiceId(),
        voice_enabled: true
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Silent — voice server may be down
  }

  process.exit(0);
}

main();
