import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  AdapterInstallInput,
  AdapterValidateInput,
  AdapterValidationIssue,
  AdapterValidationResult,
  PaiHarness,
} from "./contract";
import { readAdapterManifest } from "./manifest";
import { resolveHarnessPaths, type ResolvedHarnessPaths } from "./paths";

export interface PreparedAdapterInstall {
  paths: ResolvedHarnessPaths;
  now: string;
}

function ensureCompatibilityLink(linkPath: string, paiDir: string): void {
  if (existsSync(linkPath)) {
    if (!lstatSync(linkPath).isSymbolicLink() || readlinkSync(linkPath) !== paiDir) {
      throw new Error(`${linkPath} exists and is not the expected symlink to ${paiDir}`);
    }
    return;
  }

  symlinkSync(paiDir, linkPath);
}

function writeDefaultHarnessMarker(paiDir: string, harness: PaiHarness): void {
  writeFileSync(join(paiDir, ".pai-harness"), `${harness}\n`, "utf-8");
}

export function prepareAdapterInstall(
  input: AdapterInstallInput,
  harness: PaiHarness,
): PreparedAdapterInstall {
  const paths = resolveHarnessPaths({ ...input, harness });
  const now = input.now ?? new Date().toISOString();

  mkdirSync(paths.paiDir, { recursive: true });
  mkdirSync(paths.harnessHome, { recursive: true });
  ensureCompatibilityLink(paths.compatibilityLink, paths.paiDir);
  writeDefaultHarnessMarker(paths.paiDir, harness);

  return { paths, now };
}

export function validateAdapterState(
  input: AdapterValidateInput,
  harness: PaiHarness,
  harnessLabel: string,
): AdapterValidationResult {
  const paths = resolveHarnessPaths({ ...input, harness });
  const issues: AdapterValidationIssue[] = [];

  if (!existsSync(paths.compatibilityLink) || !lstatSync(paths.compatibilityLink).isSymbolicLink()) {
    issues.push({ check: "compatibilityLink", message: `${harnessLabel} PAI compatibility link is missing` });
  } else if (readlinkSync(paths.compatibilityLink) !== paths.paiDir) {
    issues.push({
      check: "compatibilityLink",
      message: `${harnessLabel} PAI compatibility link points to the wrong PAI directory`,
    });
  }

  try {
    const manifest = readAdapterManifest(paths.manifestPath);
    if (manifest.harness !== harness) {
      issues.push({ check: "manifest", message: `Manifest harness is not ${harness}` });
    }
    if (manifest.paiDir !== paths.paiDir) {
      issues.push({ check: "manifest", message: "Manifest PAI directory does not match resolved PAI directory" });
    }
    if (manifest.harnessHome !== paths.harnessHome) {
      issues.push({ check: "manifest", message: "Manifest harness home does not match resolved harness home" });
    }
    if (input.expectedPaiVersion && manifest.paiVersion !== input.expectedPaiVersion) {
      issues.push({ check: "manifest", message: "Manifest PAI version does not match expected PAI version" });
    }
    for (const managedFile of manifest.managedFiles) {
      if (!existsSync(join(paths.harnessHome, managedFile))) {
        issues.push({ check: "managedFiles", message: `Managed file is missing: ${managedFile}` });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ check: "manifest", message });
  }

  return { valid: issues.length === 0, paths, issues };
}
