#!/usr/bin/env bun
/**
 * FileChanged hook — fires when a file is modified.
 * Watches for changes to key PAI config files and triggers validation.
 */

import { readFileSync } from "fs";
import { paiPath } from './lib/paths';

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const filePath: string = input?.toolInput?.file_path ?? input?.filePath ?? "";

// Key files that should trigger alerts when modified
const watchedPatterns = [
  /settings\.json$/,
  /settings\.local\.json$/,
  /CLAUDE\.md$/,
  /CONTEXT_ROUTING\.md$/,
  /Algorithm\/v[\d.]+\.md$/,
];

const isWatched = watchedPatterns.some((p) => p.test(filePath));

if (isWatched) {
  // Log the change for observability
  const logEntry = JSON.stringify({
    ts: new Date().toISOString(),
    event: "FileChanged",
    file: filePath,
  });

  const logPath = paiPath('MEMORY', 'SKILLS', 'execution.jsonl');
  const fs = await import("fs");
  fs.appendFileSync(logPath, logEntry + "\n");
}

// Always allow — this is observability, not a gate
process.exit(0);
