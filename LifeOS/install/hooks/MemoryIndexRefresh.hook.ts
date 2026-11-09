#!/usr/bin/env bun
/**
 * @version 1.0.0
 * MemoryIndexRefresh.hook.ts — async Stop hook that keeps the memory retriever's index fresh
 * off the prompt path.
 *
 * The per-prompt retriever (MemoryTurnStart → getRelevantContext with `allowStaleIndex`) does no
 * freshness walk and never rebuilds a stale index: it serves the last good one, because a rebuild
 * costs seconds and every prompt waited on it (7.9s tail, 2026-10-09). This hook runs after each
 * turn, walks the folders the index covers, and rebuilds when the writers' generation or the walk
 * has moved past the index. Registered `async: true`, so the turn never waits on it. Every other
 * retriever caller keeps rebuilding a stale index itself before it scores.
 *
 * Non-blocking: always exits 0. A failed refresh means the next prompt serves the same index
 * it already would have; it is reported on stderr, never raised.
 */

import { refreshIndex, refreshEmbeddingIndex } from "../LIFEOS/TOOLS/MemoryRetriever";
import { InvariantViolation } from "../LIFEOS/TOOLS/Invariant";

try {
  const result = refreshIndex();
  if (result.rebuilt) console.error(`memory index rebuilt (${result.reason}, generation ${result.generation})`);
  else if (result.error) console.error(`memory index rebuild not saved (${result.reason}): ${result.error}`);
} catch (err) {
  // An invariant violation is an impossible state in the index writer: say so loudly, but the
  // Stop chain still must not fail on it.
  const label = err instanceof InvariantViolation ? "memory index invariant violated" : "memory index refresh failed";
  console.error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
}

// Opt-in embedding leg (public issue #2207): embed new and changed notes after the keyword index is
// fresh. Off by default (null, no work). Bounded under the hook's 60s timeout; a large first index
// finishes over a few turns.
try {
  const emb = await refreshEmbeddingIndex({ budgetMs: 40_000 });
  if (emb && (emb.embedded || emb.pruned)) console.error(`memory embeddings: ${emb.embedded} embedded, ${emb.pending} pending, ${emb.pruned} pruned`);
} catch (err) {
  console.error(`memory embedding refresh failed: ${err instanceof Error ? err.message : String(err)}`);
}

process.exit(0);
