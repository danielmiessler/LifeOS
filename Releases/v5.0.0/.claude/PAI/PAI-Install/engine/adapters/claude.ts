import type {
  AdapterInstallInput,
  AdapterInstallResult,
  AdapterValidateInput,
  AdapterValidationResult,
  HarnessAdapter,
} from "./contract";
import { writeAdapterManifest, type InstalledAdapterManifest } from "./manifest";
import { resolveHarnessPaths } from "./paths";
import { prepareAdapterInstall, validateAdapterState } from "./state";

async function install(input: AdapterInstallInput): Promise<AdapterInstallResult> {
  const { paths, now } = prepareAdapterInstall(input, "claude");

  const manifest: InstalledAdapterManifest = {
    schemaVersion: 1,
    harness: "claude",
    paiVersion: input.paiVersion,
    paiDir: paths.paiDir,
    harnessHome: paths.harnessHome,
    managedFiles: input.managedFiles,
    installedAt: now,
    updatedAt: now,
    validation: {
      status: "unknown",
      checkedAt: now,
      issues: [],
    },
  };

  writeAdapterManifest(paths.manifestPath, manifest);

  return { paths, manifest };
}

async function validate(input: AdapterValidateInput): Promise<AdapterValidationResult> {
  return validateAdapterState(input, "claude", "Claude");
}

export const claudeAdapter: HarnessAdapter = {
  harness: "claude",
  resolvePaths: (input) => resolveHarnessPaths({ ...input, harness: "claude" }),
  install,
  validate,
};
