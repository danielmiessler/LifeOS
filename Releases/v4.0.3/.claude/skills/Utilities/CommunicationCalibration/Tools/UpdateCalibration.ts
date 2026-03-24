#!/usr/bin/env bun
/**
 * UpdateCalibration — Safe write tool for communication style calibration
 *
 * Handles backup, validation, and writing of personality traits to
 * settings.json and COMMUNICATIONSTYLE.md.
 *
 * Usage:
 *   bun UpdateCalibration.ts read
 *   bun UpdateCalibration.ts backup
 *   bun UpdateCalibration.ts write '<json-payload>'
 *
 * JSON payload shape for write:
 * {
 *   personality: { enthusiasm, energy, expressiveness, resilience, composure,
 *                  optimism, warmth, formality, directness, precision, curiosity, playfulness },
 *   communicationStyle: string,
 *   cognitivePreferences?: { structurePreference, languageStyle, chunkingPreference, reengagementStyle },
 *   culturalCalibration?: { communicating, evaluating, persuading, disagreeing, trusting }
 * }
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getPrincipal } from "../../../../hooks/lib/identity";
import {
  getProfile,
  generateCommStyleMarkdown,
  type CalibrationPayload,
  type PersonalityTraits,
} from "./Profiles";

// ─── Paths ───────────────────────────────────────────────────────

const HOME = process.env.HOME!;
const PAI_DIR = join(HOME, ".claude");
const SETTINGS_PATH = join(PAI_DIR, "settings.json");
const USER_DIR = join(PAI_DIR, "PAI", "USER");
const COMM_STYLE_PATH = join(USER_DIR, "COMMUNICATIONSTYLE.md");
const BACKUPS_DIR = join(USER_DIR, "Backups");

// ─── Trait Defaults ──────────────────────────────────────────────

const TRAIT_DEFAULTS: PersonalityTraits = {
  enthusiasm: 75,
  energy: 80,
  expressiveness: 85,
  resilience: 85,
  composure: 70,
  optimism: 75,
  warmth: 70,
  formality: 30,
  directness: 80,
  precision: 95,
  curiosity: 90,
  playfulness: 45,
};

const TRAIT_KEYS = Object.keys(TRAIT_DEFAULTS) as (keyof PersonalityTraits)[];

// ─── Helpers ─────────────────────────────────────────────────────

function getTimestamp(): string {
  const now = new Date();
  const principal = getPrincipal();
  const tz = principal.timezone || "UTC";
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getFullYear()}${pad(local.getMonth() + 1)}${pad(local.getDate())}` +
    `-${pad(local.getHours())}${pad(local.getMinutes())}${pad(local.getSeconds())}`
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function validateTraits(traits: any): PersonalityTraits {
  const result = { ...TRAIT_DEFAULTS };
  for (const key of TRAIT_KEYS) {
    if (typeof traits[key] === "number") {
      result[key] = clamp(traits[key]);
    }
  }
  return result;
}

function readSettings(): any {
  if (!existsSync(SETTINGS_PATH)) {
    console.error(`❌ settings.json not found at ${SETTINGS_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
  } catch (e) {
    console.error(`❌ Failed to parse settings.json: ${e}`);
    process.exit(1);
  }
}

function getCurrentTraits(settings: any): PersonalityTraits {
  const personality = settings?.daidentity?.personality || {};
  return validateTraits({ ...TRAIT_DEFAULTS, ...personality });
}

// ─── preserve any user-written content above the auto-generated header ──────

function extractUserPreamble(existingContent: string): string {
  const headerMarker = "<!--";
  const idx = existingContent.indexOf(headerMarker);
  if (idx <= 0) return ""; // nothing before the marker, or no marker
  const preamble = existingContent.substring(0, idx).trimEnd();
  return preamble.length > 0 ? preamble + "\n\n" : "";
}

// ─── Actions ─────────────────────────────────────────────────────

function actionRead(): void {
  const settings = readSettings();
  const traits = getCurrentTraits(settings);
  const style = settings?.daidentity?.communicationStyle || "unknown";
  console.log(
    JSON.stringify(
      {
        communicationStyle: style,
        personality: traits,
      },
      null,
      2
    )
  );
}

function actionBackup(): void {
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  const ts = getTimestamp();

  // Backup settings.json
  const settingsBackup = join(BACKUPS_DIR, `settings-${ts}.json`);
  copyFileSync(SETTINGS_PATH, settingsBackup);
  console.log(`✅ settings.json backed up: Backups/settings-${ts}.json`);

  // Backup COMMUNICATIONSTYLE.md if it exists
  if (existsSync(COMM_STYLE_PATH)) {
    const styleBackup = join(BACKUPS_DIR, `COMMUNICATIONSTYLE-${ts}.md`);
    copyFileSync(COMM_STYLE_PATH, styleBackup);
    console.log(`✅ COMMUNICATIONSTYLE.md backed up: Backups/COMMUNICATIONSTYLE-${ts}.md`);
  }
}

function actionWrite(payloadArg: string): void {
  // Parse payload
  let payload: CalibrationPayload;
  try {
    payload = JSON.parse(payloadArg);
  } catch (e) {
    console.error(`❌ Invalid JSON payload: ${e}`);
    process.exit(1);
  }

  // Validate
  if (!payload.personality || !payload.communicationStyle) {
    console.error("❌ Payload must include personality and communicationStyle");
    process.exit(1);
  }
  const validatedTraits = validateTraits(payload.personality);

  // Step 1: Backup
  actionBackup();

  // Step 2: Read current settings, apply personality + communicationStyle
  const settings = readSettings();
  const oldTraits = getCurrentTraits(settings);

  if (!settings.daidentity) settings.daidentity = {};
  settings.daidentity.personality = validatedTraits;
  settings.daidentity.communicationStyle = payload.communicationStyle;

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  console.log(`✅ settings.json updated`);

  // Step 3: Generate COMMUNICATIONSTYLE.md
  const principal = getPrincipal();
  const principalName = principal.name || "User";
  const profile = getProfile(payload.communicationStyle);

  // Override profile's personality with the calibrated values
  const enrichedProfile = {
    ...profile,
    personalityOverrides: validatedTraits,
  };

  let userPreamble = "";
  if (existsSync(COMM_STYLE_PATH)) {
    const existing = readFileSync(COMM_STYLE_PATH, "utf-8");
    userPreamble = extractUserPreamble(existing);
  }

  const generated = generateCommStyleMarkdown(
    enrichedProfile,
    principalName,
    payload.cognitivePreferences,
    payload.culturalCalibration
  );

  const finalContent = userPreamble + generated;

  if (!existsSync(USER_DIR)) {
    mkdirSync(USER_DIR, { recursive: true });
  }
  writeFileSync(COMM_STYLE_PATH, finalContent);
  console.log(`✅ COMMUNICATIONSTYLE.md written`);

  // Step 4: Print diff summary
  console.log("\n📊 Trait Changes:");
  let hasChanges = false;
  for (const key of TRAIT_KEYS) {
    const before = oldTraits[key];
    const after = validatedTraits[key];
    if (before !== after) {
      const arrow = after > before ? "↑" : "↓";
      console.log(`   ${key.padEnd(14)} ${before} → ${after} ${arrow}`);
      hasChanges = true;
    }
  }
  if (!hasChanges) {
    console.log("   No trait changes.");
  }
  console.log(`\n🎯 Communication style: ${profile.label}`);
  console.log(`   Profile ID: ${payload.communicationStyle}`);
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action) {
    console.error("❌ Usage: bun UpdateCalibration.ts <read|backup|write> [payload]");
    process.exit(1);
  }

  switch (action) {
    case "read":
      actionRead();
      break;
    case "backup":
      actionBackup();
      break;
    case "write":
      if (!args[1]) {
        console.error("❌ write action requires a JSON payload as the second argument");
        process.exit(1);
      }
      actionWrite(args[1]);
      break;
    default:
      console.error(`❌ Unknown action: ${action}. Use read, backup, or write.`);
      process.exit(1);
  }
}

main();
