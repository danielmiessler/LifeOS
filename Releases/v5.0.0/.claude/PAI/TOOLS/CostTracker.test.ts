import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  baselineKey,
  classifyCallSite,
  isDependencyManifest,
  RISK_PATTERNS,
  type CallSite,
  type RiskPattern,
} from "./CostTracker";

function risk(id: string): RiskPattern {
  const pattern = RISK_PATTERNS.find((candidate) => candidate.id === id);
  if (!pattern) throw new Error(`Missing risk pattern fixture: ${id}`);
  return pattern;
}

describe("CostTracker classification", () => {
  test("SDK dependency in package.json is legit with manifest note", () => {
    const result = classifyCallSite("PULSE/package.json", risk("claude-agent-sdk"));

    expect(result.classification).toBe("legit");
    expect(result.note).toContain("dependency manifest");
  });

  test("--bare in package.json is bypass, not manifest-exempt", () => {
    const result = classifyCallSite("PULSE/package.json", risk("claude-bare"));

    expect(result.classification).toBe("bypass");
    expect(result.note).toContain("--bare");
  });

  test("raw x-api-key in package.json is bypass, not manifest-exempt", () => {
    const result = classifyCallSite("PULSE/package.json", risk("raw-http-x-api-key"));

    expect(result.classification).toBe("bypass");
    expect(result.note).toContain("raw Anthropic HTTP");
  });

  test("Evals package.json SDK hit keeps the specific Evals legit note", () => {
    const result = classifyCallSite("skills/Evals/package.json", risk("anthropic-sdk"));

    expect(result.classification).toBe("legit");
    expect(result.note).toContain("Evals");
    expect(result.note).toContain("EVALS_ALLOW_API_BILLING");
  });

  test("mypackage.json is not manifest-exempt by suffix", () => {
    const result = classifyCallSite("PULSE/mypackage.json", risk("anthropic-sdk"));

    expect(isDependencyManifest("PULSE/mypackage.json")).toBe(false);
    expect(result.classification).toBe("bypass");
  });

  test("deno.json with --bare remains bypass", () => {
    const result = classifyCallSite("PULSE/deno.json", risk("claude-bare"));

    expect(result.classification).toBe("bypass");
  });

  test("deno.json / composer.json SDK hit is NOT manifest-exempt (config-with-scripts)", () => {
    expect(isDependencyManifest("PULSE/deno.json")).toBe(false);
    expect(isDependencyManifest("PULSE/composer.json")).toBe(false);
    expect(classifyCallSite("PULSE/deno.json", risk("anthropic-sdk")).classification).toBe("bypass");
    expect(classifyCallSite("PULSE/composer.json", risk("anthropic-sdk")).classification).toBe("bypass");
  });

  test(".ts SDK caller without guard is bypass; with guard is legit", () => {
    const unguarded = classifyCallSite("PULSE/caller.ts", risk("anthropic-sdk"));
    expect(unguarded.classification).toBe("bypass");

    const tempDir = mkdtempSync(join(tmpdir(), "cost-tracker-"));
    try {
      const guardedFile = join(tempDir, "guarded.ts");
      writeFileSync(guardedFile, "delete process.env.ANTHROPIC_API_KEY;\n");

      const guarded = classifyCallSite(guardedFile, risk("anthropic-sdk"));
      expect(guarded.classification).toBe("legit");
      expect(guarded.note).toContain("delete process.env.ANTHROPIC_API_KEY");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("direct Anthropic messages endpoint is bypass", () => {
    const result = classifyCallSite("PULSE/http-client.ts", risk("raw-http-messages-endpoint"));

    expect(result.classification).toBe("bypass");
  });

  test(".md file with an SDK string is legit", () => {
    const result = classifyCallSite("docs/README.md", risk("anthropic-sdk"));

    expect(result.classification).toBe("legit");
    expect(result.note).toContain("markdown");
  });
});

describe("CostTracker baseline identity", () => {
  test("same file, line, and pattern keep the same key when note/classification changes", () => {
    const original: CallSite = {
      file: "PULSE/client.ts",
      line: 42,
      match: "import Anthropic from '@anthropic-ai/sdk'",
      classification: "unknown",
      patternId: "anthropic-sdk",
      reason: "old note",
    };
    const revised: CallSite = {
      ...original,
      classification: "bypass",
      reason: "new note",
    };

    expect(baselineKey(original)).toBe(baselineKey(revised));
  });
});

describe("CostTracker risk regexes", () => {
  test("x-api-key pattern matches sk-ant and anthropic alternatives without a literal pipe", () => {
    const pattern = new RegExp(risk("raw-http-x-api-key").pattern);

    expect(pattern.test('headers["x-api-key"] = "sk-ant-test"')).toBe(true);
    expect(pattern.test('headers["x-api-key"] = anthropicApiKey')).toBe(true);
    expect(pattern.test('headers["x-api-key"] = "abc|def"')).toBe(false);
  });

  test("claude --bare pattern matches an argv line", () => {
    const pattern = new RegExp(risk("claude-bare").pattern);

    expect(pattern.test('const argv = ["claude", "--bare"];')).toBe(true);
  });
});
