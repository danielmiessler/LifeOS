#!/usr/bin/env bun

/**
 * remove-bg - Background Removal CLI
 *
 * Remove backgrounds from images using local rembg.
 * Part of the Images skill for PAI system.
 *
 * Usage:
 *   remove-bg input.png                    # Overwrites original
 *   remove-bg input.png output.png         # Saves to new file
 *   remove-bg file1.png file2.png file3.png # Batch process
 */

import { resolve, extname } from "node:path";
import { existsSync } from "node:fs";
import { unlink, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

function resolveRembgBin(): string {
  if (process.env.REMBG_BIN) return process.env.REMBG_BIN;
  return resolve(homedir(), ".local/bin/rembg");
}

function showHelp(): void {
  const bin = resolveRembgBin();
  console.log(`
remove-bg - Background Removal CLI

Remove backgrounds from images using local rembg (no API).

USAGE:
  remove-bg <input> [output]           Single file
  remove-bg <file1> <file2> ...        Batch process (overwrites originals)

ARGUMENTS:
  input     Path to image file (PNG, JPG, JPEG, WebP)
  output    Optional output path (defaults to overwriting input)

EXAMPLES:
  remove-bg header.png
  remove-bg header.jpg header-transparent.png
  remove-bg diagram1.png diagram2.png diagram3.png

NOTES:
  - rembg always produces PNG output (alpha channel required)
  - If input is .jpg/.jpeg/.webp and you overwrite, the file is renamed to .png
  - Requires rembg at ${bin} (override via REMBG_BIN env var)
    Install: pipx install rembg  (or: uv tool install rembg)
`);
  process.exit(0);
}

function runRembg(bin: string, input: string, output: string): Promise<void> {
  return new Promise((resolveFn, rejectFn) => {
    const proc = spawn(bin, ["i", input, output], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", (err) => rejectFn(new Error(`Failed to launch rembg: ${err.message}`)));
    proc.on("close", (code) => {
      if (code === 0) resolveFn();
      else rejectFn(new Error(`rembg exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function removeBackground(inputPath: string, outputPath?: string): Promise<void> {
  const bin = resolveRembgBin();
  if (!existsSync(bin)) {
    console.error(`❌ rembg not found at ${bin}`);
    console.error("   Install: pipx install rembg  (or: uv tool install rembg)");
    console.error("   Override path: export REMBG_BIN=/path/to/rembg");
    process.exit(1);
  }

  if (!existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  const inputExt = extname(inputPath).toLowerCase();
  let target = outputPath ?? inputPath;
  let renameAfter: { from: string; to: string } | null = null;
  if (!outputPath && inputExt !== ".png") {
    target = inputPath.replace(/\.[^.]+$/, ".png");
    renameAfter = { from: inputPath, to: target };
  }

  console.log(`🔲 Removing background: ${inputPath}`);
  const start = Date.now();
  try {
    await runRembg(bin, inputPath, target);
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (renameAfter && renameAfter.from !== renameAfter.to) {
    try { await unlink(renameAfter.from); } catch {}
  }

  const elapsed = Date.now() - start;
  let dims = "";
  try {
    const s = await stat(target);
    dims = ` (${(s.size / 1024).toFixed(0)}KB)`;
  } catch {}
  console.log(`✅ Saved: ${target}${dims} in ${elapsed}ms`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
  }

  if (args.length === 1) {
    await removeBackground(args[0]);
    return;
  }

  if (args.length === 2) {
    if (existsSync(args[1])) {
      for (const file of args) {
        await removeBackground(file);
      }
    } else {
      await removeBackground(args[0], args[1]);
    }
    return;
  }

  console.log(`🔲 Batch processing ${args.length} files...\n`);
  let success = 0;
  let failed = 0;

  for (const file of args) {
    try {
      await removeBackground(file);
      success++;
    } catch {
      failed++;
    }
  }

  console.log(`\n📊 Complete: ${success} succeeded, ${failed} failed`);
}

main();
