import { existsSync, mkdirSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PAI_VERSION } from "./types";

export type InstallSourceKind = "bundle" | "clone";
export type BundleSourceReason = "backup" | "env";

export interface InstallSource {
  kind: InstallSourceKind;
  sourceDir: string;
  reason?: BundleSourceReason;
}

export interface ResolveInstallSourceInput {
  env?: Record<string, string | undefined>;
  backupPath?: string;
  tempDir?: string;
  runCommand: (cmd: string, timeoutMs?: number) => string | null;
}

export const BUNDLE_MARKERS = [
  "install.sh",
  "settings.json",
  "hooks/SecurityPipeline.hook.ts",
  "PAI/PAI-Install/main.ts",
] as const;

const PAI_REPOSITORY_URL = "https://github.com/danielmiessler/PAI.git";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function isCompleteBundle(sourceDir: string): boolean {
  if (!existsSync(sourceDir)) return false;
  return BUNDLE_MARKERS.every((marker) => existsSync(join(sourceDir, marker)));
}

export function findBundleRoot(sourceDir: string): string | null {
  if (isCompleteBundle(sourceDir)) return sourceDir;

  const releaseBundle = join(sourceDir, "Releases", `v${PAI_VERSION}`, ".claude");
  if (isCompleteBundle(releaseBundle)) return releaseBundle;

  return null;
}

function resolveLocalBundle(input: ResolveInstallSourceInput): InstallSource | null {
  if (input.backupPath) {
    const backupBundle = findBundleRoot(input.backupPath);
    if (backupBundle) {
      return { kind: "bundle", sourceDir: backupBundle, reason: "backup" };
    }
  }

  const bundleDir = input.env?.PAI_BUNDLE_DIR;
  if (!bundleDir) return null;

  const envBundle = findBundleRoot(bundleDir);
  if (!envBundle) return null;

  return { kind: "bundle", sourceDir: envBundle, reason: "env" };
}

function cloneRepositoryToSource(input: ResolveInstallSourceInput): InstallSource | null {
  const tempRoot = input.tempDir ?? tmpdir();
  mkdirSync(tempRoot, { recursive: true });
  const cloneDir = mkdtempSync(join(tempRoot, "pai-install-source-"));

  const cloneResult = input.runCommand(
    `git clone ${PAI_REPOSITORY_URL} ${shellQuote(cloneDir)} 2>&1`,
    120000,
  );

  if (cloneResult === null) {
    const initResult = input.runCommand(
      `cd ${shellQuote(cloneDir)} && git init && git remote add origin ${PAI_REPOSITORY_URL} && git fetch origin && git checkout -b main origin/main 2>&1`,
      120000,
    );
    if (initResult === null) return null;
  }

  const bundleRoot = findBundleRoot(cloneDir);
  if (!bundleRoot) return null;

  return { kind: "clone", sourceDir: bundleRoot };
}

export function resolveInstallSource(input: ResolveInstallSourceInput): InstallSource | null {
  return resolveLocalBundle(input) ?? cloneRepositoryToSource(input);
}
