#!/usr/bin/env bun
/**
 * Polish.ts — Cleanvoice API cloud polish
 *
 * Uploads audio to Cleanvoice API for final cleanup:
 * - Mouth sound removal
 * - Remaining filler detection
 * - Loudness normalization
 *
 * Usage: bun Polish.ts <audio-file> [--output <path>]
 * Output: Polished audio file at <audio-file>_polished.<ext>
 *
 * Requires: CLEANVOICE_API_KEY env var
 * Get key at: https://cleanvoice.ai → Dashboard → Settings → API Key
 */

import { existsSync, readFileSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { homedir } from "os";

// ============================================================================
// Environment Loading — keys from ~/.config/PAI/.env
// ============================================================================

function loadEnv(): void {
  const envPath = process.env.PAI_CONFIG_DIR
    ? resolve(process.env.PAI_CONFIG_DIR, ".env")
    : resolve(homedir(), ".config/PAI/.env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silently continue if .env doesn't exist
  }
}

loadEnv();

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const audioFile = positional[0];
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag !== -1 ? args[outputFlag + 1] : undefined;

if (!audioFile) {
  console.error("Usage: bun Polish.ts <audio-file> [--output <path>]");
  process.exit(1);
}

if (!existsSync(audioFile)) {
  console.error(`File not found: ${audioFile}`);
  process.exit(1);
}

const apiKey = process.env.CLEANVOICE_API_KEY;
if (!apiKey) {
  console.error("CLEANVOICE_API_KEY not found. Set it in ~/.config/PAI/.env");
  console.error("Get key at: https://cleanvoice.ai → Dashboard → Settings → API Key");
  process.exit(1);
}

const ext = extname(audioFile);
const base = basename(audioFile, ext);
const dir = dirname(audioFile);
const outFile = outputPath || join(dir, `${base}_polished${ext}`);

console.log(`Audio: ${audioFile}`);
console.log(`Output: ${outFile}`);

const API_BASE = "https://api.cleanvoice.ai/v2";

// Step 1: Upload the file
console.log("\nUploading to Cleanvoice...");

const fileData = await Bun.file(audioFile).arrayBuffer();
const formData = new FormData();
formData.append("file", new Blob([fileData]), basename(audioFile));

const uploadResponse = await fetch(`${API_BASE}/upload`, {
  method: "POST",
  headers: {
    "X-API-Key": apiKey,
  },
  body: formData,
});

if (!uploadResponse.ok) {
  const err = await uploadResponse.text();
  console.error(`Upload failed: ${uploadResponse.status} ${err}`);
  process.exit(1);
}

const uploadData = (await uploadResponse.json()) as any;
const fileId = uploadData.id || uploadData.file_id;
console.log(`Uploaded: ${fileId}`);

// Step 2: Start processing
console.log("Starting Cleanvoice processing...");

const editResponse = await fetch(`${API_BASE}/edit`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  },
  body: JSON.stringify({
    input: { files: [fileId] },
    config: {
      filler_words: true,
      mouth_sounds: true,
      deadair: false, // We handle this ourselves
      normalize: true,
    },
  }),
});

if (!editResponse.ok) {
  const err = await editResponse.text();
  console.error(`Edit request failed: ${editResponse.status} ${err}`);
  process.exit(1);
}

const editData = (await editResponse.json()) as any;
const editId = editData.id || editData.edit_id;
console.log(`Edit job: ${editId}`);

// Step 3: Poll for completion
console.log("Processing...");
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLLS = 360; // 30 minutes max

for (let i = 0; i < MAX_POLLS; i++) {
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

  const statusResponse = await fetch(`${API_BASE}/edit/${editId}`, {
    headers: { "X-API-Key": apiKey },
  });

  if (!statusResponse.ok) {
    console.error(`Status check failed: ${statusResponse.status}`);
    continue;
  }

  const statusData = (await statusResponse.json()) as any;
  const status = statusData.status;

  if (status === "completed" || status === "done") {
    console.log("Processing complete.");

    // Download the result
    const downloadUrl = statusData.result?.url || statusData.download_url || statusData.output?.url;
    if (!downloadUrl) {
      console.error("No download URL in response:", JSON.stringify(statusData, null, 2));
      process.exit(1);
    }

    console.log("Downloading polished audio...");
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
      console.error(`Download failed: ${downloadResponse.status}`);
      process.exit(1);
    }

    const outputData = await downloadResponse.arrayBuffer();
    await Bun.write(outFile, outputData);

    const sizeMB = Math.round(outputData.byteLength / 1024 / 1024);
    console.log(`\n=== Polish Complete ===`);
    console.log(`Output: ${outFile} (${sizeMB}MB)`);
    process.exit(0);
  } else if (status === "failed" || status === "error") {
    console.error(`Processing failed: ${statusData.error || "unknown error"}`);
    process.exit(1);
  } else {
    const elapsed = ((i + 1) * POLL_INTERVAL / 1000).toFixed(0);
    process.stdout.write(`\r  Status: ${status} (${elapsed}s elapsed)`);
  }
}

console.error("\nTimeout: processing took too long (>30 min)");
process.exit(1);
