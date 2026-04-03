#!/usr/bin/env bun
/**
 * PAI Installer v4.0 — Welcome MP3 Generator
 * Uses ElevenLabs API to generate the welcome audio with a voice clone.
 *
 * Usage: bun generate-welcome.ts
 *
 * Requires: ELEVENLABS_API_KEY environment variable
 * Uses voice clone ID from settings.json principal.voiceClone
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const OUTPUT_PATH = join(import.meta.dir, "public", "assets", "welcome.mp3");

// Voice ID — check env var, then settings.json voices, then default
function getVoiceId(): string {
  // Environment variable takes priority
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;

  const settingsPath = join(homedir(), ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      // Use principal's voice clone (the installer speaks in the user's voice)
      const clone = settings.principal?.voiceClone;
      if (typeof clone === "string") return clone;
      if (typeof clone?.voiceId === "string") return clone.voiceId;
      // Fallback to DA main voice
      const mainVoice = settings.daidentity?.voices?.main?.voiceId;
      if (typeof mainVoice === "string") return mainVoice;
    } catch {}
  }
  // Fallback to a default ElevenLabs voice
  return "pNInz6obpgDQGcFmaJgB"; // Adam
}

async function generateWelcome() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Try to read from config
    const envPath = join(homedir(), ".config", "PAI", ".env");
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf-8");
      const match = envContent.match(/ELEVENLABS_API_KEY=(.+)/);
      if (match) {
        process.env.ELEVENLABS_API_KEY = match[1].trim();
      }
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("Error: ELEVENLABS_API_KEY not found in environment or ~/.config/PAI/.env");
      console.error("Set it with: export ELEVENLABS_API_KEY=your-key-here");
      process.exit(1);
    }
  }

  const voiceId = getVoiceId();
  const text = "Welcome to Personal AI Infrastructure. <break time=\"1.0s\" /> Magnifying human capabilities.";

  console.log(`Generating welcome audio...`);
  console.log(`  Voice ID: ${voiceId}`);
  console.log(`  Text: "${text}"`);
  console.log(`  Output: ${OUTPUT_PATH}`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.85,
          similarity_boost: 0.9,
          style: 0.1,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`ElevenLabs API error (${response.status}): ${error}`);
    process.exit(1);
  }

  const buffer = await response.arrayBuffer();
  writeFileSync(OUTPUT_PATH, Buffer.from(buffer));

  console.log(`\n✓ Welcome audio generated: ${OUTPUT_PATH} (${Math.round(buffer.byteLength / 1024)}KB)`);
}

generateWelcome().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
