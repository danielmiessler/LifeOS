#!/usr/bin/env bun
/**
 * RebuildArchSummary.ts - Regenerate DOCUMENTATION/ARCHITECTURE_SUMMARY.md when system files change
 *
 * PURPOSE:
 * Watches PAI system docs, hooks, Algorithm spec, Tools, user config, and security
 * policy for mtime changes. When any tracked file is newer than the current
 * DOCUMENTATION/ARCHITECTURE_SUMMARY.md, invokes Tools/ArchitectureSummaryGenerator.ts to
 * regenerate it.
 *
 * TRIGGER: called from DocIntegrity.hook.ts on Stop.
 *
 * DESIGN:
 * - No Components dir tracking (deprecated pipeline removed in v5.0).
 * - No build-script rebuilds of CLAUDE.md / SKILL.md — both are directly edited.
 * - Single responsibility: keep the auto-generated architecture summary current.
 */

import { statSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { getPaiDir, getClaudeDir } from "../lib/paths";

export async function handleRebuildArchSummary(): Promise<void> {
  const paiDir = getPaiDir();
  const claudeDir = getClaudeDir();
  const output = join(paiDir, "DOCUMENTATION", "PAI_ARCHITECTURE_SUMMARY.md");
  const generator = join(paiDir, "Tools/ArchitectureSummaryGenerator.ts");

  if (!existsSync(generator)) return;

  try {
    const outputStat = existsSync(output) ? statSync(output) : null;
    if (!outputStat) {
      console.error("[RebuildArchSummary] Architecture summary missing - regenerating");
      await rebuild(generator, paiDir);
      return;
    }

    const trackedDirs = [
      join(paiDir, ""),
      join(paiDir, "DOCUMENTATION"),
      join(claudeDir, "hooks"),
      join(paiDir, "ALGORITHM"),
      join(paiDir, "TOOLS"),
      join(paiDir, "USER", "Config"),
      join(paiDir, "USER", "SECURITY"),
    ];

    const trackedExtensions = new Set([".ts", ".md", ".yaml", ".yml", ".sh", ".json"]);

    let newestSystemFile = "";
    let newestMtime = 0;

    for (const dir of trackedDirs) {
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const ext = entry.name.slice(entry.name.lastIndexOf("."));
          if (!trackedExtensions.has(ext)) continue;
          const filePath = join(dir, entry.name);
          const mtime = statSync(filePath).mtimeMs;
          if (mtime > newestMtime) {
            newestMtime = mtime;
            newestSystemFile = filePath;
          }
        }
      } catch {
        /* dir not readable — skip */
      }
    }

    for (const f of [join(claudeDir, "settings.json"), join(claudeDir, "CLAUDE.md")]) {
      if (existsSync(f)) {
        const mtime = statSync(f).mtimeMs;
        if (mtime > newestMtime) {
          newestMtime = mtime;
          newestSystemFile = f;
        }
      }
    }

    if (newestMtime > outputStat.mtimeMs) {
      const rel = newestSystemFile.replace(claudeDir + "/", "");
      console.error(`[RebuildArchSummary] System file changed (${rel}) - regenerating`);
      await rebuild(generator, paiDir);
    } else {
      console.error("[RebuildArchSummary] DOCUMENTATION/ARCHITECTURE_SUMMARY.md is current");
    }
  } catch (error) {
    console.error("[RebuildArchSummary] Error checking architecture summary:", error);
  }
}

async function rebuild(generator: string, cwd: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("bun", [generator, "generate"], { cwd, stdio: "pipe" });

    let stderr = "";
    proc.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        console.error("[RebuildArchSummary] Regenerated DOCUMENTATION/ARCHITECTURE_SUMMARY.md");
      } else {
        console.error(`[RebuildArchSummary] Regeneration failed (exit ${code}): ${stderr.trim()}`);
      }
      resolve();
    });

    proc.on("error", (err) => {
      console.error("[RebuildArchSummary] Spawn error:", err);
      resolve();
    });
  });
}
