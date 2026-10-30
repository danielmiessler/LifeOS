import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { applyAtInstallRoot, prBodyFor } from "./Report";
import { attestationLine } from "./Attest";

const git = (cwd: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@localhost", ...args], { cwd, encoding: "utf8" });

// An install-relative patch, the shape diffAllowed accepts and `pr --diff` sends.
const PATCH = [
  "diff --git a/LIFEOS/TOOLS/a.ts b/LIFEOS/TOOLS/a.ts",
  "--- a/LIFEOS/TOOLS/a.ts",
  "+++ b/LIFEOS/TOOLS/a.ts",
  "@@ -1 +1 @@",
  "-export const a = 1;",
  "+export const a = 2;",
  "",
].join("\n");

/** A one-commit repo whose install tree sits at `root` (the release repo uses LifeOS/install). */
function repoWithInstallAt(root: string): { dir: string; patch: string } {
  const dir = mkdtempSync(join(tmpdir(), "report-apply-"));
  mkdirSync(join(dir, root, "LIFEOS", "TOOLS"), { recursive: true });
  writeFileSync(join(dir, root, "LIFEOS", "TOOLS", "a.ts"), "export const a = 1;\n");
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  const patch = join(dir, "..", `${dir.split("/").pop()}.patch`);
  writeFileSync(patch, PATCH);
  return { dir, patch };
}

describe("pr applies an install-relative patch", () => {
  test("to the release repo layout (install tree under LifeOS/install/)", () => {
    const { dir, patch } = repoWithInstallAt("LifeOS/install");
    // What v8.761.0 runs: git apply at the repo root, which matches no file in this layout.
    expect(git(dir, "apply", "--check", patch).status).not.toBe(0);
    const r = applyAtInstallRoot(dir, patch);
    expect(r.ok).toBe(true);
    expect(r.prefix).toBe("LifeOS/install");
    // Staged paths come back install-relative, so stagedDenied judges the same paths the diff gate did.
    expect(r.stagedZ).toBe("LIFEOS/TOOLS/a.ts");
  });

  test("to a repo whose root is the install tree", () => {
    const { dir, patch } = repoWithInstallAt("");
    const r = applyAtInstallRoot(dir, patch);
    expect(r.ok).toBe(true);
    expect(r.prefix).toBe("");
    expect(r.stagedZ).toBe("LIFEOS/TOOLS/a.ts");
  });
});

describe("prBodyFor", () => {
  test("links the issue the report was filed as on the same repo", () => {
    const body = prBodyFor("report\n", "o/r", "https://github.com/o/r/issues/12");
    expect(body.endsWith("\n\nFixes #12\n")).toBe(true);
  });

  test("leaves the body alone when nothing was filed there", () => {
    expect(prBodyFor("report\n", "o/r", undefined)).toBe("report\n");
    expect(prBodyFor("report\n", "o/r", "https://github.com/x/y/issues/12")).toBe("report\n");
    expect(prBodyFor("report\n", "o/r", "https://github.com/o/r/discussions/12")).toBe("report\n");
  });
});

describe("attestationLine", () => {
  test("labels the modified list, never the missing count", () => {
    const line = attestationLine({ status: "modified", reference: "o/r@v1", compared: 3, modified: ["hooks/A.ts"], missing: 2 });
    expect(line).not.toContain("missing:");
    expect(line).toContain("2 system file(s) missing");
    expect(line).toContain("differing files:\n  - hooks/A.ts");
  });
});
