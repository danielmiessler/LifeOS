import type { HarnessAdapter, PaiHarness } from "./contract";
import { claudeAdapter } from "./claude";
import { codexAdapter } from "./codex";

function isPaiHarness(value: string): value is PaiHarness {
  return value === "claude" || value === "codex";
}

export function selectHarnessAdapter(harness = "claude"): HarnessAdapter {
  if (!isPaiHarness(harness)) {
    throw new Error(`Unsupported PAI harness: ${harness}`);
  }

  return harness === "codex" ? codexAdapter : claudeAdapter;
}
