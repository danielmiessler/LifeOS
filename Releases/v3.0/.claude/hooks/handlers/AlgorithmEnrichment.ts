/**
 * AlgorithmEnrichment.ts — Stop handler for algorithm state enrichment
 *
 * Called by StopOrchestrator after response completes. Two jobs:
 * 1. Enrich algorithm state with data extracted from the full transcript
 *    (task description, summary, SLA, quality gate, capabilities)
 * 2. Sweep stale active sessions across all algorithm state files
 *
 * This wires up algorithmEnd() and sweepStaleActive() from algorithm-state.ts,
 * which previously existed but were never called.
 */

import { algorithmEnd, sweepStaleActive, readState, writeState } from '../lib/algorithm-state';
import type { AlgorithmCriterion, AlgorithmState } from '../lib/algorithm-state';
import type { ParsedTranscript } from '../../skills/PAI/Tools/TranscriptParser';

// ── Extraction helpers ──

function extractTaskDescription(text: string): string | undefined {
  // Match "🗒️ TASK: ..." line
  const m = text.match(/🗒️\s*TASK:\s*(.+)/);
  return m ? m[1].trim() : undefined;
}

function extractSummary(text: string): string | undefined {
  // Match "🗣️ [DA_NAME]: ..." voice line
  const m = text.match(/🗣️\s*\w+:\s*(.+)/);
  return m ? m[1].trim() : undefined;
}

function extractSLA(text: string): AlgorithmState['sla'] | undefined {
  // Try multiple patterns to handle different Algorithm output formats:
  // 1. Standard: [Selected: Extended (8min budget) — ...]
  // 2. Markdown bold: **Selected:** Extended
  // 3. Effort level line: EFFORT LEVEL: ... Selected: Extended
  // 4. Tier name after "Selected:" with any intervening characters (**, brackets, etc.)
  const patterns = [
    /Selected:\s*\*{0,2}\s*(Instant|Fast|Standard|Extended|Advanced|Deep|Comprehensive|Loop)/i,
    /\[Selected:\s*(Instant|Fast|Standard|Extended|Advanced|Deep|Comprehensive|Loop)/i,
    /EFFORT.?LEVEL[^:]*:\s*.*?(Instant|Fast|Standard|Extended|Advanced|Deep|Comprehensive|Loop)\s*\(/i,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const raw = m[1];
      // Capitalize first letter, lowercase rest — match exact v0.5.4 tier names
      return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as AlgorithmState['sla'];
    }
  }
  return undefined;
}

function extractQualityGate(text: string): AlgorithmState['qualityGate'] | undefined {
  // Look for the quality gate section
  if (!text.includes('QUALITY GATE')) return undefined;

  const gate: AlgorithmState['qualityGate'] = {
    count: text.includes('QG1 Count:') && text.includes('PASS'),
    length: false,
    state: false,
    testable: false,
    anti: false,
    open: false,
  };

  // Parse each gate check
  const qg2 = text.match(/QG2 Length:\s*\[(PASS|FAIL)/);
  if (qg2) gate!.length = qg2[1] === 'PASS';

  const qg3 = text.match(/QG3 State:\s*\[(PASS|FAIL)/);
  if (qg3) gate!.state = qg3[1] === 'PASS';

  const qg4 = text.match(/QG4 Testable:\s*\[(PASS|FAIL)/);
  if (qg4) gate!.testable = qg4[1] === 'PASS';

  const qg5 = text.match(/QG5 Anti:\s*\[(PASS|FAIL)/);
  if (qg5) gate!.anti = qg5[1] === 'PASS';

  const gateStatus = text.match(/GATE:\s*\[(OPEN|BLOCKED)/);
  if (gateStatus) gate!.open = gateStatus[1] === 'OPEN';

  return gate;
}

function extractCapabilities(text: string): string[] | undefined {
  // Look for USE: section in capability audit
  const m = text.match(/USE:\s*(.+?)(?:\n|DECLINE|NOT APPLICABLE)/s);
  if (!m) return undefined;

  // Extract capability names (# followed by name)
  const caps = m[1].match(/#\d+\s+(\w[\w\s]+)/g);
  if (!caps || caps.length === 0) return undefined;

  return caps.map(c => c.replace(/#\d+\s+/, '').trim());
}

function isAlgorithmResponse(text: string): boolean {
  // Check for algorithm markers in the response
  return text.includes('PAI ALGORITHM') ||
    text.includes('━━━') ||
    (text.includes('OBSERVE') && text.includes('THINK'));
}

/**
 * Infer minimum effort level from criteria count when regex extraction fails.
 * Uses ISC Scale Tiers: Simple (4-8), Medium (12-40), Large (40-150), Massive (150+).
 * Only upgrades — never downgrades an already-set effort level.
 */
function inferEffortFromCriteria(sessionId: string, extractedSla: AlgorithmState['sla'] | undefined): AlgorithmState['sla'] | undefined {
  if (extractedSla) return extractedSla; // Regex worked, use it

  const state = readState(sessionId);
  if (!state) return undefined;

  // Don't downgrade — if already set above Standard, keep it
  const currentSla = state.sla;
  if (currentSla && currentSla !== 'Standard') return undefined;

  // Infer from criteria count
  const count = state.criteria.length;
  if (count >= 40) return 'Deep';
  if (count >= 20) return 'Advanced';
  if (count >= 12) return 'Extended';
  return undefined; // Not enough signal to override
}

// ── Main handler ──

/**
 * Detect if this Stop event is likely from context compaction rather than a genuine
 * response end. Compaction fires Stop mid-algorithm, so the state will show an active
 * session in a mid-phase (not LEARN/COMPLETE). If the phase was recently entered
 * (within 60s), this is almost certainly compaction, not a completed response.
 */
function isLikelyCompaction(sessionId: string): boolean {
  const state = readState(sessionId);
  if (!state || !state.active) return false;

  const midPhases = new Set(['OBSERVE', 'THINK', 'PLAN', 'BUILD', 'EXECUTE', 'VERIFY']);
  if (!midPhases.has(state.currentPhase)) return false;

  // If the phase started recently and we're getting a Stop, it's likely compaction
  const elapsed = Date.now() - state.phaseStartedAt;
  return elapsed < 120_000; // 2 minutes — generous window for compaction detection
}

export async function handleAlgorithmEnrichment(
  parsed: ParsedTranscript,
  sessionId: string,
): Promise<void> {
  const text = parsed.currentResponseText || parsed.plainCompletion || '';

  const isAlgo = isAlgorithmResponse(text);

  // Compaction guard: if the algorithm is actively mid-phase, this Stop is likely
  // from context compaction, not a genuine response end. Enrich but don't terminate.
  const compaction = isLikelyCompaction(sessionId);
  if (compaction) {
    process.stderr.write(`[AlgorithmEnrichment] compaction detected for ${sessionId.slice(0, 8)}... — enriching without terminal marking\n`);
    // Still extract enrichment data (effort level, task description) but skip algorithmEnd
    // which would mark the session as complete
    const state = readState(sessionId);
    if (state) {
      const extractedSla = extractSLA(text);
      const effectiveSla = inferEffortFromCriteria(sessionId, extractedSla);
      if (extractedSla && effectiveSla) state.sla = effectiveSla;
      const taskDesc = extractTaskDescription(text);
      if (taskDesc) {
        state.taskDescription = taskDesc;
        state.currentAction = taskDesc;
      }
      const qg = extractQualityGate(text);
      if (qg) state.qualityGate = qg;
      // Write enrichment without touching active/phase/completedAt
      writeState(state);
    }
    sweepStaleActive(sessionId);
    return;
  }

  const extractedSla = extractSLA(text);
  const effectiveSla = inferEffortFromCriteria(sessionId, extractedSla);

  // Enrich algorithm state
  algorithmEnd(sessionId, {
    taskDescription: extractTaskDescription(text),
    summary: extractSummary(text),
    sla: effectiveSla,
    qualityGate: extractQualityGate(text),
    capabilities: extractCapabilities(text),
    isAlgorithmResponse: isAlgo,
  });

  // Sweep stale sessions (cleans up other sessions, not current)
  sweepStaleActive(sessionId);

  process.stderr.write(`[AlgorithmEnrichment] enriched session ${sessionId.slice(0, 8)}... (isAlgo=${isAlgo}, sla=${effectiveSla || 'none'}, regex=${extractedSla || 'miss'})\n`);
}
