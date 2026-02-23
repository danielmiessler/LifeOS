#!/usr/bin/env bun

/**
 * GetCounts.ts - Single Source of Truth for PAI System Counts
 *
 * PURPOSE:
 * Provides deterministic, consistent counts for PAI system metrics.
 * Both Banner.ts and statusline-command.sh MUST use this tool to ensure
 * the same numbers are displayed everywhere.
 *
 * COUNTING METHODOLOGY:
 * - Skills: Directories in skills/ that contain a SKILL.md file
 * - Workflows: .md files in any Workflows/ directory (recursive)
 * - Hooks: .ts files directly in hooks/ (depth 1)
 * - Signals: .md files in MEMORY/LEARNING/ (recursive)
 * - Files: All files in skills/PAI/USER/ (recursive)
 * - Work: Directories in MEMORY/WORK/ (depth 1)
 * - Research: .md and .json files in MEMORY/RESEARCH/ (recursive)
 *
 * USAGE:
 *   bun run GetCounts.ts           # JSON output
 *   bun run GetCounts.ts --shell   # Shell-sourceable output
 *   bun run GetCounts.ts --single skills  # Single value output
 *
 * OUTPUT (JSON):
 *   {"skills":65,"workflows":339,"hooks":18,"signals":3819,"files":172}
 *
 * OUTPUT (--shell):
 *   skills_count=65
 *   workflows_count=339
 *   hooks_count=18
 *   signals_count=3819
 *   files_count=172
 */

import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME!;
const PAI_DIR = process.env.PAI_DIR || join(HOME, ".claude");

interface Counts {
  skills: number;
  workflows: number;
  hooks: number;
  signals: number;
  files: number;
  work: number;
  research: number;
  ratings: number;
}

/**
 * Count files matching criteria recursively
 */
function countFilesRecursive(dir: string, extension?: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesRecursive(fullPath, extension);
      } else if (entry.isFile()) {
        if (!extension || entry.name.endsWith(extension)) {
          count++;
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return count;
}

/**
 * Count .md files inside any Workflows directory
 */
function countWorkflowFiles(dir: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'workflows') {
          // Found a Workflows directory - count all .md files inside
          count += countFilesRecursive(fullPath, '.md');
        } else {
          // Recurse into subdirectories to find more Workflows dirs
          count += countWorkflowFiles(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return count;
}

/**
 * Count skills (directories with SKILL.md file)
 */
function countSkills(): number {
  let count = 0;
  const skillsDir = join(PAI_DIR, "skills");
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      // Handle both real directories and symlinks to directories
      const isDir = entry.isDirectory() ||
        (entry.isSymbolicLink() && statSync(join(skillsDir, entry.name)).isDirectory());
      if (isDir) {
        const skillFile = join(skillsDir, entry.name, "SKILL.md");
        if (existsSync(skillFile)) {
          count++;
        }
      }
    }
  } catch {
    // skills directory doesn't exist
  }
  return count;
}

/**
 * Count hooks (.ts files in hooks/ at depth 1)
 */
function countHooks(): number {
  let count = 0;
  const hooksDir = join(PAI_DIR, "hooks");
  try {
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        count++;
      }
    }
  } catch {
    // hooks directory doesn't exist
  }
  return count;
}

/**
 * Count ratings from ratings.jsonl
 */
function countRatings(): number {
  const ratingsFile = join(PAI_DIR, "MEMORY/LEARNING/SIGNALS/ratings.jsonl");
  try {
    const fs = require('fs');
    const content = fs.readFileSync(ratingsFile, 'utf-8');
    return content.split('\n').filter((line: string) => line.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Get all counts
 */
function getCounts(): Counts {
  return {
    skills: countSkills(),
    workflows: countWorkflowFiles(join(PAI_DIR, "skills")),
    hooks: countHooks(),
    signals: countFilesRecursive(join(PAI_DIR, "MEMORY/LEARNING"), ".md"),
    files: countFilesRecursive(join(PAI_DIR, "skills/PAI/USER")),
    work: (() => {
      let count = 0;
      try {
        for (const entry of readdirSync(join(PAI_DIR, "MEMORY/WORK"), { withFileTypes: true })) {
          if (entry.isDirectory()) count++;
        }
      } catch {}
      return count;
    })(),
    research: countFilesRecursive(join(PAI_DIR, "MEMORY/RESEARCH"), ".md") +
              countFilesRecursive(join(PAI_DIR, "MEMORY/RESEARCH"), ".json"),
    ratings: countRatings(),
  };
}

// CLI handling
const args = process.argv.slice(2);
const shellMode = args.includes('--shell');
const singleArg = args.find(a => a.startsWith('--single'));
const singleKey = singleArg ? args[args.indexOf(singleArg) + 1] : null;

const counts = getCounts();

if (singleKey && singleKey in counts) {
  // Output just the single value (for use in shell scripts)
  console.log(counts[singleKey as keyof Counts]);
} else if (shellMode) {
  // Output as shell-sourceable variables
  console.log(`skills_count=${counts.skills}`);
  console.log(`workflows_count=${counts.workflows}`);
  console.log(`hooks_count=${counts.hooks}`);
  console.log(`signals_count=${counts.signals}`);
  console.log(`files_count=${counts.files}`);
  console.log(`work_count=${counts.work}`);
  console.log(`research_count=${counts.research}`);
  console.log(`ratings_count=${counts.ratings}`);
} else {
  // JSON output (default)
  console.log(JSON.stringify(counts));
}
