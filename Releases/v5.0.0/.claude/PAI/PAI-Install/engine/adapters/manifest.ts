import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, isAbsolute } from "path";
import type { PaiHarness } from "../types";

export type AdapterValidationStatus = "pass" | "warn" | "fail" | "unknown";

export interface InstalledAdapterManifest {
  schemaVersion: 1;
  harness: PaiHarness;
  paiVersion: string;
  paiDir: string;
  harnessHome: string;
  managedFiles: string[];
  installedAt: string;
  updatedAt: string;
  validation: {
    status: AdapterValidationStatus;
    checkedAt: string;
    issues: string[];
  };
}

export interface AdapterManifestValidationResult {
  valid: boolean;
  issues: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidHarness(value: unknown): value is PaiHarness {
  return value === "claude" || value === "codex";
}

function isValidValidationStatus(value: unknown): value is AdapterValidationStatus {
  return value === "pass" || value === "warn" || value === "fail" || value === "unknown";
}

function containsProtectedUserPath(file: string): boolean {
  return file.split("/").some((part) => {
    const lower = part.toLowerCase();
    return lower === "user" || lower === "telios";
  });
}

function containsCredentialPath(file: string): boolean {
  const lower = file.toLowerCase();
  return lower === ".env" ||
    lower.endsWith("/.env") ||
    lower.includes("credential") ||
    lower.includes("secret") ||
    lower.includes("token");
}

export function validateAdapterManifest(
  manifest: unknown,
): AdapterManifestValidationResult {
  const issues: string[] = [];

  if (!isRecord(manifest)) {
    return { valid: false, issues: ["manifest must be an object"] };
  }

  if (manifest.schemaVersion !== 1) {
    issues.push("schemaVersion must be 1");
  }
  if (!isValidHarness(manifest.harness)) {
    issues.push("harness must be claude or codex");
  }
  if (!isNonEmptyString(manifest.paiVersion)) {
    issues.push("paiVersion is required");
  }
  if (!isNonEmptyString(manifest.paiDir) || !isAbsolute(manifest.paiDir)) {
    issues.push("paiDir must be an absolute path");
  }
  if (!isNonEmptyString(manifest.harnessHome) || !isAbsolute(manifest.harnessHome)) {
    issues.push("harnessHome must be an absolute path");
  }
  const managedFiles = manifest.managedFiles;
  if (!Array.isArray(managedFiles) || !managedFiles.every((file) => (
    isNonEmptyString(file) && !isAbsolute(file) && !file.split("/").includes("..")
  ))) {
    issues.push("managedFiles must be relative paths");
  } else {
    if (managedFiles.some(containsProtectedUserPath)) {
      issues.push("managedFiles must not include USER/TELIOS paths");
    }
    if (managedFiles.some(containsCredentialPath)) {
      issues.push("managedFiles must not include credential files");
    }
  }
  if (!isNonEmptyString(manifest.installedAt)) {
    issues.push("installedAt is required");
  }
  if (!isNonEmptyString(manifest.updatedAt)) {
    issues.push("updatedAt is required");
  }

  const validation = manifest.validation;
  if (!isRecord(validation)) {
    issues.push("validation must be an object");
  } else {
    if (!isValidValidationStatus(validation.status)) {
      issues.push("validation.status must be pass, warn, fail, or unknown");
    }
    if (!isNonEmptyString(validation.checkedAt)) {
      issues.push("validation.checkedAt is required");
    }
    if (!Array.isArray(validation.issues) || !validation.issues.every((issue) => typeof issue === "string")) {
      issues.push("validation.issues must be string array");
    }
  }

  return { valid: issues.length === 0, issues };
}

export function readAdapterManifest(path: string): InstalledAdapterManifest {
  const manifest = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  const validation = validateAdapterManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid adapter manifest: ${validation.issues.join("; ")}`);
  }
  return manifest as InstalledAdapterManifest;
}

export function writeAdapterManifest(
  path: string,
  manifest: InstalledAdapterManifest,
): void {
  const validation = validateAdapterManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid adapter manifest: ${validation.issues.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}
