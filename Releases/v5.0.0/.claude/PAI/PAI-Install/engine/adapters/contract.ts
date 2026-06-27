import type { PaiHarness } from "../types";
export type { PaiHarness } from "../types";
import type { InstalledAdapterManifest } from "./manifest";
import type { ResolveHarnessPathsInput, ResolvedHarnessPaths } from "./paths";

export interface AdapterInstallInput extends ResolveHarnessPathsInput {
  paiVersion: string;
  managedFiles: string[];
  startupInstructionsSource?: string;
  now?: string;
}

export interface AdapterInstallResult {
  paths: ResolvedHarnessPaths;
  manifest: InstalledAdapterManifest;
}

export interface AdapterValidateInput extends ResolveHarnessPathsInput {
  expectedPaiVersion?: string;
}

export interface AdapterValidationIssue {
  check: string;
  message: string;
}

export interface AdapterValidationResult {
  valid: boolean;
  paths: ResolvedHarnessPaths;
  issues: AdapterValidationIssue[];
}

export interface HarnessAdapter {
  harness: PaiHarness;
  resolvePaths(input: ResolveHarnessPathsInput): ResolvedHarnessPaths;
  install(input: AdapterInstallInput): Promise<AdapterInstallResult>;
  validate(input: AdapterValidateInput): Promise<AdapterValidationResult>;
}
