import { existsSync, readFileSync, realpathSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join, resolve } from "path";

export type PaiHarness = "claude" | "codex";

function homeDir(): string {
  return process.env.HOME || homedir();
}

function expandHome(value: string): string {
  if (value === "~") return homeDir();
  if (value.startsWith("~/")) return join(homeDir(), value.slice(2));
  return value;
}

function resolveExisting(path: string): string {
  return existsSync(path) ? realpathSync(path) : path;
}

function scriptPath(): string | undefined {
  const arg = process.argv[1];
  return arg ? resolve(expandHome(arg)) : undefined;
}

function envHarness(): PaiHarness | undefined {
  const harness = process.env.PAI_HARNESS;
  if (harness === "claude" || harness === "codex") return harness;
  return undefined;
}

function defaultHarnessFromPaiDir(paiDir: string): PaiHarness | undefined {
  try {
    const harness = readFileSync(join(paiDir, ".pai-harness"), "utf-8").trim();
    if (harness === "claude" || harness === "codex") return harness;
  } catch {}
  return undefined;
}

function harnessFromHome(path: string): PaiHarness | undefined {
  const name = basename(path);
  if (name === ".claude") return "claude";
  if (name === ".codex") return "codex";
  return undefined;
}

function harnessHomeFromPaiChild(path?: string): string | undefined {
  if (!path) return undefined;
  const separator = process.platform === "win32" ? "\\" : "/";
  const marker = `${separator}PAI${separator}`;
  const index = path.lastIndexOf(marker);
  return index >= 0 ? path.slice(0, index) : undefined;
}

function looksLikePaiRoot(path: string): boolean {
  return existsSync(join(path, "ALGORITHM")) ||
    existsSync(join(path, "PULSE")) ||
    existsSync(join(path, "TOOLS")) ||
    existsSync(join(path, "USER"));
}

function findPaiRoot(startPath?: string): string | undefined {
  if (!startPath) return undefined;
  let current = resolve(expandHome(startPath));
  if (!existsSync(current) || !looksLikePaiRoot(current)) {
    current = dirname(current);
  }

  for (;;) {
    if (looksLikePaiRoot(current)) return resolveExisting(current);
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function getPaiDir(metaDir?: string): string {
  if (process.env.PAI_DIR) {
    return resolveExisting(resolve(expandHome(process.env.PAI_DIR)));
  }

  const scriptHarnessHome = harnessHomeFromPaiChild(scriptPath());
  if (scriptHarnessHome) {
    return resolveExisting(join(scriptHarnessHome, "PAI"));
  }

  const scriptPaiRoot = findPaiRoot(scriptPath());
  if (scriptPaiRoot) return scriptPaiRoot;

  if (metaDir) {
    const metaPaiRoot = findPaiRoot(metaDir);
    if (metaPaiRoot) return metaPaiRoot;
  }

  return join(homeDir(), ".pai");
}

export function getHarnessHome(): string {
  if (process.env.HARNESS_HOME) {
    return resolve(expandHome(process.env.HARNESS_HOME));
  }

  const harness = envHarness();
  if (harness) return join(homeDir(), harness === "claude" ? ".claude" : ".codex");

  const paiDir = getPaiDir();
  const defaultHarness = defaultHarnessFromPaiDir(paiDir);
  if (defaultHarness) {
    const candidate = join(homeDir(), defaultHarness === "claude" ? ".claude" : ".codex");
    const link = join(candidate, "PAI");
    if (!existsSync(link) || resolveExisting(link) === resolveExisting(paiDir)) {
      return candidate;
    }
  }

  const scriptHarnessHome = harnessHomeFromPaiChild(scriptPath());
  if (scriptHarnessHome) return scriptHarnessHome;

  for (const candidate of [join(homeDir(), ".codex"), join(homeDir(), ".claude")]) {
    const link = join(candidate, "PAI");
    if (existsSync(link) && resolveExisting(link) === resolveExisting(paiDir)) {
      return candidate;
    }
  }

  return join(homeDir(), ".claude");
}

export function getHarnessKind(harnessHome = getHarnessHome()): PaiHarness {
  return envHarness() ?? harnessFromHome(harnessHome) ?? "claude";
}

export function getRuntimePaths(metaDir?: string) {
  const paiDir = getPaiDir(metaDir);
  const harnessHome = getHarnessHome();
  return {
    paiDir,
    harnessHome,
    harness: getHarnessKind(harnessHome),
  };
}
