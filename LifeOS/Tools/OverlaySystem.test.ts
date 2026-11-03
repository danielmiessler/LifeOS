/**
 * resolveIdentityVars: a DA genuinely named "Aria" (the scaffold default) stays pending forever
 * unless the config marks the name as a real answer with `confirmed = true`.
 * Run: bun test LifeOS/Tools/OverlaySystem.test.ts
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveIdentityVars } from "./OverlaySystem";

function withConfig(toml: string, fn: (configPath: string, root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "identity-"));
  try {
    const configPath = join(root, "LIFEOS_CONFIG.toml");
    writeFileSync(configPath, toml);
    fn(configPath, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("resolveIdentityVars with a scaffold-equal DA name", () => {
  test("unconfirmed \"Aria\" is still the unanswered default", () => {
    withConfig(`[principal]\nname = "Sam"\n\n[da]\nname = "Aria"\n`, (configPath, root) => {
      const r = resolveIdentityVars(root, root, configPath);
      expect(r.pending).toContain("{{DA_NAME}}");
      expect(r.vars["{{DA_NAME}}"]).toBeUndefined();
    });
  });

  test("confirmed = true renders \"Aria\" as the DA's real name", () => {
    withConfig(`[principal]\nname = "Sam"\n\n[da]\nname = "Aria"\nconfirmed = true\n`, (configPath, root) => {
      const r = resolveIdentityVars(root, root, configPath);
      expect(r.pending).not.toContain("{{DA_NAME}}");
      expect(r.vars["{{DA_NAME}}"]).toBe("Aria");
      expect(r.vars["{{DA_FULL_NAME}}"]).toBe("Aria");
    });
  });

  test("confirmed on [da] does not confirm a scaffold principal name", () => {
    withConfig(`[principal]\nname = "Your Name"\n\n[da]\nname = "Aria"\nconfirmed = true\n`, (configPath, root) => {
      expect(resolveIdentityVars(root, root, configPath).pending).toContain("{{PRINCIPAL_NAME}}");
    });
  });
});
