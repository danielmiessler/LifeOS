import { homedir } from "os";
import { join } from "path";
import type { PaiHarness } from "../types";

export interface ResolveHarnessPathsInput {
  harness: PaiHarness;
  homeDir?: string;
  paiDir?: string;
  harnessHome?: string;
}

export interface ResolvedHarnessPaths {
  harness: PaiHarness;
  homeDir: string;
  harnessHome: string;
  paiDir: string;
  compatibilityLink: string;
  manifestPath: string;
}

function defaultHarnessHome(homeDir: string, harness: PaiHarness): string {
  return join(homeDir, harness === "claude" ? ".claude" : ".codex");
}

export function resolveHarnessPaths(input: ResolveHarnessPathsInput): ResolvedHarnessPaths {
  const homeDir = input.homeDir ?? homedir();
  const harnessHome = input.harnessHome ?? defaultHarnessHome(homeDir, input.harness);
  const paiDir = input.paiDir ?? join(homeDir, ".pai");

  return {
    harness: input.harness,
    homeDir,
    harnessHome,
    paiDir,
    compatibilityLink: join(harnessHome, "PAI"),
    manifestPath: join(harnessHome, ".pai-adapter.json"),
  };
}
