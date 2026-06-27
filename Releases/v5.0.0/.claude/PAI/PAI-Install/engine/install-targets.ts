import { homedir } from "os";
import { resolveHarnessPaths, type ResolvedHarnessPaths } from "./adapters";
import type { PaiHarness } from "./adapters";

export interface ResolveInstallerAdapterPathsInput {
  env?: Record<string, string | undefined>;
  homeDir?: string;
}

export function resolveInstallerHarness(env: Record<string, string | undefined> = process.env): PaiHarness {
  const harness = env.PAI_HARNESS || "claude";
  if (harness !== "claude" && harness !== "codex") {
    throw new Error(`Unsupported PAI harness: ${harness}`);
  }
  return harness;
}

export function resolveInstallerAdapterPaths(
  input: ResolveInstallerAdapterPathsInput = {},
): ResolvedHarnessPaths {
  const env = input.env ?? process.env;
  const homeDir = input.homeDir ?? homedir();

  return resolveHarnessPaths({
    harness: resolveInstallerHarness(env),
    homeDir,
    paiDir: env.PAI_DIR,
    harnessHome: env.HARNESS_HOME,
  });
}

export function requiresClaudeCodePrerequisite(harness: PaiHarness): boolean {
  return harness === "claude";
}
