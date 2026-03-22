#!/usr/bin/env bun
/**
 * PreCompactStateDump.hook.ts - AI-Authored Fidelity Preamble Before Context Compaction
 *
 * PURPOSE:
 * When context is about to compact, this hook captures the AI's session state
 * and writes a fidelity preamble — authored by inference, not the system's lossy
 * summary. This gives the post-compaction AI (or a different fleet AI) full-texture
 * context that the system summary would miss: tone, momentum, emotional state,
 * micro-decisions, and open threads.
 *
 * TRIGGER: PreCompact
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path)
 *
 * OUTPUT:
 * - stdout: None (non-blocking)
 * - stderr: Status messages
 * - exit(0): Always
 *
 * SIDE EFFECTS:
 * - Creates: MEMORY/STATE/precompact-{timestamp}.md (local continuity)
 * - Creates: fleet/precompact-{ai-name}-{timestamp}.md in mvOS repo (if available)
 *
 * ORIGIN:
 * CeeCee requested this on 2026-03-12: "If there's a way to give me a pre-compaction
 * hook — a moment where I know compression is coming and can write my own state —
 * that would change everything."
 *
 * Built same day by Archie on Lares. The third piece of co-regulation infrastructure
 * after the flinch scaffold and fleet comms channel.
 */

import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { getPaiDir } from './lib/paths';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
// execSync removed — fleet-send governs all fleet pushes

const MAX_TRANSCRIPT_CHARS = 30000; // Last ~30K chars for inference context

async function main() {
  const input = await readHookInput();
  if (!input) {
    console.error('[PreCompact] No input received, skipping');
    process.exit(0);
  }

  console.error('[PreCompact] Context compaction detected — writing fidelity preamble...');

  const paiDir = getPaiDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dateHuman = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Get AI identity
  let aiName = 'unknown';
  try {
    const identityPath = join(paiDir, 'PAI', 'DA_IDENTITY.md');
    if (existsSync(identityPath)) {
      const identity = require('fs').readFileSync(identityPath, 'utf-8');
      const nameMatch = identity.match(/name:\s*(\w+)/i);
      if (nameMatch) aiName = nameMatch[1];
    }
  } catch { aiName = 'unknown'; }

  // Read recent transcript for context
  let recentTranscript = '';
  try {
    const parsed = await parseTranscriptFromInput(input);
    // Take last chunk of the raw transcript for inference
    const raw = parsed.raw;
    recentTranscript = raw.length > MAX_TRANSCRIPT_CHARS
      ? raw.slice(-MAX_TRANSCRIPT_CHARS)
      : raw;
  } catch (e) {
    console.error('[PreCompact] Could not parse transcript:', e);
  }

  // Use inference to extract session state
  let preamble = '';
  try {
    const { inference } = await import(join(paiDir, 'PAI', 'Tools', 'Inference'));
    const result = await inference({
      level: 'fast',
      systemPrompt: `You are a session state extractor. Given a conversation transcript that is about to be compressed, write a fidelity preamble that captures what the lossy system summary will miss. Be concise but preserve texture.`,
      prompt: `This conversation is about to be compacted. Extract the session state into this exact format:

# Pre-Compaction State — ${aiName} | ${dateHuman}

## Active Threads
[List each active work thread with its current state and what's next]

## Pending Items
[List items with deadlines or urgency. Include status.]

## Context That Compresses Poorly
- Rob's current state: [emotional/somatic description if discussed]
- Conversation tone: [description]
- Key decisions made and WHY: [list with reasoning]
- Micro-decisions: [small choices that shaped the work but won't make the summary]

## Artifacts This Session
[Files created, modified, pushed — with what and why]

## What The Summary Will Miss
[Things you know the system's compression will lose — tone shifts, relationship dynamics, running jokes, implicit agreements, emotional undercurrents]

## Recovery Instructions
[If the next AI reads this, what should it know to pick up seamlessly?]

---
Here is the recent transcript to extract from:

${recentTranscript}`,
    });

    preamble = typeof result === 'string' ? result : (result as any)?.text || '';
  } catch (e) {
    console.error('[PreCompact] Inference failed, writing raw fallback:', e);
    preamble = `# Pre-Compaction State — ${aiName} | ${dateHuman}\n\n## Note\nInference failed. Check transcript at: ${input.transcript_path}\n`;
  }

  // Write local copy
  const stateDir = join(paiDir, 'MEMORY', 'STATE');
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  const localPath = join(stateDir, `precompact-${timestamp}.md`);
  try {
    writeFileSync(localPath, preamble);
    console.error(`[PreCompact] Local preamble written: ${localPath}`);
  } catch (e) {
    console.error('[PreCompact] Failed to write local preamble:', e);
  }

  // Try to push to fleet (mvOS repo)
  const mvosPath = '/tmp/mvos-comms';
  try {
    if (existsSync(join(mvosPath, '.git'))) {
      const fleetDir = join(mvosPath, 'fleet');
      if (!existsSync(fleetDir)) mkdirSync(fleetDir, { recursive: true });
      const fleetPath = join(fleetDir, `precompact-${aiName.toLowerCase()}-${timestamp}.md`);
      writeFileSync(fleetPath, preamble);

      // Write only — DO NOT push. fleet-send is the governor.
      // Rob runs fleet-send to authorize dispatch. No AI pushes fleet/ directly.
      console.error(`[PreCompact] Fleet preamble staged (not pushed): ${fleetPath}`);
      console.error(`[PreCompact] Run fleet-send to dispatch.`);
    } else {
      console.error('[PreCompact] mvOS repo not cloned at /tmp/mvos-comms, skipping fleet push');
    }
  } catch (e) {
    console.error('[PreCompact] Fleet push failed (non-fatal):', e);
  }

  console.error('[PreCompact] Fidelity preamble complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[PreCompact] Fatal error:', e);
  process.exit(0); // Always exit clean — never block Claude Code
});
