import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { extname, join } from "path";
import type { AdapterInstallResult, HarnessAdapter } from "./adapters";
import type { ResolvedHarnessPaths } from "./adapters";
import { CODEX_REWRITE_EXTENSIONS, rewriteCodexPaths } from "./adapters/codex-rewrite";

export interface CopyStats {
  files: number;
  bytes: number;
}

type CopyFileTransform = (srcPath: string, dstPath: string) => boolean;
type CopyEntryExcluder = (name: string, srcPath: string) => boolean;

export interface BundleAdapterInstallInput {
  bundleDir: string;
  adapter: HarnessAdapter;
  paths: ResolvedHarnessPaths;
  paiVersion: string;
  managedFiles: string[];
  now?: string;
}

export interface BundleAdapterInstallResult {
  core: CopyStats;
  harness: CopyStats;
  adapter: AdapterInstallResult;
}

export const BUNDLE_COPY_EXCLUDES = new Set([
  ".git",
  "node_modules",
  "PAI_RELEASES",
  "install-state.json",
  ".DS_Store",
  ".tmp",
  ".next",
  ".quote-cache",
]);

const PAI_SETTINGS_FILE = "settings.json";
const PAI_STARTUP_SOURCE_FILE = "CLAUDE.md";

function shouldExcludeBundleEntry(name: string): boolean {
  return BUNDLE_COPY_EXCLUDES.has(name) ||
    name === "__tests__" ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(name);
}

const PAI_CORE_PROTECTED_EXISTING_ENTRIES = new Set(["USER", "TELIOS"]);

function copyTree(
  src: string,
  dst: string,
  stats: CopyStats = { files: 0, bytes: 0 },
  excludeEntry?: CopyEntryExcluder,
  transformFile?: CopyFileTransform,
): CopyStats {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    if (shouldExcludeBundleEntry(entry.name) || excludeEntry?.(entry.name, srcPath)) continue;

    const dstPath = join(dst, entry.name);

    if (entry.isDirectory()) {
      copyTree(srcPath, dstPath, stats, excludeEntry, transformFile);
    } else if (entry.isSymbolicLink()) {
      try {
        const target = readlinkSync(srcPath);
        if (existsSync(dstPath)) unlinkSync(dstPath);
        symlinkSync(target, dstPath);
      } catch {
        // Skip broken symlinks.
      }
    } else if (entry.isFile()) {
      try {
        const transformed = transformFile?.(srcPath, dstPath) ?? false;
        if (!transformed) cpSync(srcPath, dstPath);
        stats.files++;
        stats.bytes += lstatSync(srcPath).size;
      } catch {
        // Permission errors are non-fatal; validation catches missing critical files.
      }
    }
  }

  return stats;
}

function shouldSkipExistingPaiCoreEntry(name: string, paiDir: string): boolean {
  return PAI_CORE_PROTECTED_EXISTING_ENTRIES.has(name) && existsSync(join(paiDir, name));
}

function copyCodexHarnessFile(srcPath: string, dstPath: string): boolean {
  if (!CODEX_REWRITE_EXTENSIONS.has(extname(srcPath))) return false;

  const current = readFileSync(srcPath, "utf-8");
  const next = rewriteCodexPaths(current) as string;
  writeFileSync(dstPath, next, "utf-8");
  return true;
}

function rewriteCopiedCodexDashboard(paiDir: string): void {
  const dashboardDir = join(paiDir, "PULSE", "Observability", "out");
  if (!existsSync(dashboardDir)) return;

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && CODEX_REWRITE_EXTENSIONS.has(extname(entry.name))) {
        const current = readFileSync(entryPath, "utf-8");
        const next = rewriteCodexPaths(current) as string;
        if (next !== current) writeFileSync(entryPath, next, "utf-8");
      }
    }
  };

  visit(dashboardDir);
}

export async function installBundleForAdapter(
  input: BundleAdapterInstallInput,
): Promise<BundleAdapterInstallResult> {
  const paiCoreSource = join(input.bundleDir, "PAI");
  if (!existsSync(paiCoreSource)) {
    throw new Error(`Bundle is missing PAI core at ${paiCoreSource}`);
  }

  const core = copyTree(
    paiCoreSource,
    input.paths.paiDir,
    { files: 0, bytes: 0 },
    (name) => shouldSkipExistingPaiCoreEntry(name, input.paths.paiDir),
  );
  if (input.adapter.harness === "codex") {
    rewriteCopiedCodexDashboard(input.paths.paiDir);
    const settingsSource = join(input.bundleDir, PAI_SETTINGS_FILE);
    if (existsSync(settingsSource)) {
      cpSync(settingsSource, join(input.paths.paiDir, PAI_SETTINGS_FILE));
    }
  }
  const startupSourcePath = join(input.bundleDir, PAI_STARTUP_SOURCE_FILE);
  const startupInstructionsSource = input.adapter.harness === "codex" && existsSync(startupSourcePath)
    ? readFileSync(startupSourcePath, "utf-8")
    : undefined;
  const harness = copyTree(input.bundleDir, input.paths.harnessHome, { files: 0, bytes: 0 }, (name, srcPath) =>
    name === "PAI" ||
    (
      input.adapter.harness === "codex" &&
      (name === PAI_SETTINGS_FILE || srcPath === startupSourcePath)
    ),
    input.adapter.harness === "codex" ? copyCodexHarnessFile : undefined,
  );
  const adapter = await input.adapter.install({
    harness: input.adapter.harness,
    homeDir: input.paths.homeDir,
    harnessHome: input.paths.harnessHome,
    paiDir: input.paths.paiDir,
    paiVersion: input.paiVersion,
    managedFiles: input.managedFiles,
    startupInstructionsSource,
    now: input.now,
  });

  return { core, harness, adapter };
}
