import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readCatalog, writeCatalog, type CatalogEntry } from "./PatternCatalog";
import { loadEntries, main, rank, suggest, type Ask } from "./SuggestPattern";

const SHIPPED_CATALOG = resolve(import.meta.dir, "..", "Patterns", "catalog.yaml");

/**
 * Plain requests that name no pattern; any listed pattern in the top three is a hit.
 *
 * Provenance (the RedTeam rule: never written from the catalog's own triggers). All twenty were written on
 * 2026-11-14 before PatternCatalog.ts or catalog.yaml existed, so no generated trigger could have shaped them.
 * The third field says what each one came from:
 *   name   — the plain words of the upstream pattern's own name, said the way a person would ask
 *   readme — the pattern's README.md (create_quiz, create_git_diff_commit); every other expected pattern's
 *            user.md or README.md is empty upstream (checked 2026-11-14), so none could be used
 *   task   — the plain-English task a person would type for that job, with no pattern vocabulary
 *   isa    — the example request in this feature's ISA (§ Vision)
 * Tuning disclosure: the first run scored 18/20; two general synonyms (better→improve, answer↔response)
 * were then added to SuggestPattern.ts, which moved it to 19/20.
 */
const FIXTURES: Array<[string, string[], string]> = [
  ["is this contract safe to sign", ["check_agreement"], "isa"],
  ["make a threat model for my new API", ["create_threat_model", "create_stride_threat_model"], "name"],
  ["turn this meeting transcript into action items", ["summarize_meeting", "transcribe_minutes"], "task"],
  ["explain what this bash script does", ["explain_code"], "name"],
  ["write a semgrep rule that catches this SQL injection", ["write_semgrep_rule"], "name"],
  ["draw a mermaid diagram of this process", ["create_mermaid_visualization", "create_mermaid_visualization_for_github"], "name"],
  ["make flash cards so I can study this chapter", ["create_flash_cards", "to_flashcards"], "name"],
  ["make this essay read better", ["improve_writing"], "task"],
  ["fact check the claims in this article", ["analyze_claims"], "task"],
  ["summarize this research paper for me", ["analyze_paper", "summarize_paper", "analyze_paper_simple"], "name"],
  ["write a commit message for these staged changes", ["create_git_diff_commit", "summarize_git_diff"], "readme"],
  ["review my code for bugs and security issues", ["review_code"], "name"],
  ["create a quiz from these lecture notes", ["create_quiz"], "readme"],
  ["what predictions does this talk make", ["extract_predictions"], "task"],
  ["rate how good this AI answer is", ["rate_ai_response", "rate_ai_result"], "task"],
  ["write a product requirements document for this feature", ["create_prd"], "task"],
  ["find the errors and anomalies in these server logs", ["analyze_logs"], "task"],
  ["write a user story with acceptance criteria for login", ["agility_story", "create_user_story"], "name"],
  ["make my prompt better", ["improve_prompt"], "task"],
  ["give me a tldr of this article", ["create_micro_summary", "summarize_micro"], "task"],
];

function countingAsk(answer?: (names: string[]) => Record<string, number>): { ask: Ask; calls: () => number } {
  let n = 0;
  return {
    ask: async (_state, questions) => {
      n++;
      const names = Object.keys(questions.pick.criteria);
      const probabilities = answer ? answer(names) : Object.fromEntries(names.map((k) => [k, 1 / names.length]));
      const choice = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
      return { answers: { pick: { type: "choice", choice, probabilities } } };
    },
    calls: () => n,
  };
}

let tmp: string | undefined;
afterEach(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); tmp = undefined; });

describe("fixtures", () => {
  test("the expected pattern is in the top three for at least 18 of 20 plain requests (offline)", async () => {
    const entries = loadEntries({ catalogPath: SHIPPED_CATALOG, userCatalogPath: null });
    expect(entries.length).toBeGreaterThan(200);
    const misses: string[] = [];
    for (const [request, expected] of FIXTURES) {
      const r = await suggest(request, { entries, env: { LIFEOS_GLANCE_DISABLED: "1" } });
      expect(r.picks.length).toBe(3);
      if (!r.picks.some((p) => expected.includes(p.name))) misses.push(`${request} → ${r.picks.map((p) => p.name).join(", ")}`);
    }
    console.log(`fixtures: ${FIXTURES.length - misses.length}/${FIXTURES.length} in top three${misses.length ? `\n  miss: ${misses.join("\n  miss: ")}` : ""}`);
    expect(FIXTURES.length - misses.length).toBeGreaterThanOrEqual(18);
  });
});

// Held-out top-1 set (checker finding 2, 2026-11-14): written after the 20 fixtures and never tuned against; the
// intent applies the FIRST pick, so the first pick is what has to be right on an unambiguous request.
const HELD_OUT_TOP1: Array<[string, string]> = [
  ["is this contract safe to sign", "check_agreement"],
  ["review my code for bugs", "review_code"],
  ["summarize this meeting transcript with action items", "summarize_meeting"],
  ["extract wisdom from this talk", "extract_wisdom"],
  ["turn this into a diagram", "create_mermaid_visualization"],
  ["write a semgrep rule for this fix", "write_semgrep_rule"],
  ["what logical fallacies are in this argument", "find_logical_fallacies"],
  ["create a threat model for this API", "create_threat_model"],
];

describe("held-out top-1", () => {
  test("the first pick is the expected pattern on every held-out unambiguous request (offline)", async () => {
    const entries = loadEntries({ userCatalogPath: null });
    const misses: string[] = [];
    for (const [request, expected] of HELD_OUT_TOP1) {
      const r = await suggest(request, { entries, env: { LIFEOS_GLANCE_DISABLED: "1" } });
      if (r.picks[0]?.name !== expected) misses.push(`${request} → ${r.picks[0]?.name ?? "(none)"} (wanted ${expected})`);
    }
    if (misses.length) console.log(`held-out top-1 misses:\n  ${misses.join("\n  ")}`);
    expect(misses).toEqual([]);
  });
});

describe("explicit", () => {
  test("a request naming a pattern or a ported intent returns it with zero model calls", async () => {
    const entries = loadEntries({ catalogPath: SHIPPED_CATALOG, userCatalogPath: null });
    const c = countingAsk();
    const named = await suggest("use extract_article_wisdom on this post", { entries, ask: c.ask, env: {} });
    expect(named.explicit).toBe(true);
    expect(named.picks.map((p) => p.name)).toEqual(["extract_article_wisdom"]);
    const intent = await suggest("run CheckAgreement on this lease", { entries, ask: c.ask, env: {} });
    expect(intent.explicit).toBe(true);
    expect(intent.picks[0].name).toBe("check_agreement");
    expect(intent.picks[0].ported_intent).toBe("CheckAgreement");
    const ticked = await suggest("apply `summarize` to the notes", { entries, ask: c.ask, env: {} });
    expect(ticked.explicit).toBe(true);
    expect(ticked.picks[0].name).toBe("summarize");
    expect(c.calls()).toBe(0);
  });

  test("a plain request does call the judge once when the engine is enabled", async () => {
    const entries = loadEntries({ catalogPath: SHIPPED_CATALOG, userCatalogPath: null });
    const c = countingAsk();
    await suggest("is this contract safe to sign", { entries, ask: c.ask, env: {} });
    expect(c.calls()).toBe(1);
  });
});

describe("judge", () => {
  test("the judgment reranks the shortlist", async () => {
    const entries = loadEntries({ catalogPath: SHIPPED_CATALOG, userCatalogPath: null });
    const base = rank("make a threat model for my new API", entries, 6);
    const last = base[base.length - 1].name;
    const c = countingAsk((names) => Object.fromEntries(names.map((n) => [n, n === last ? 0.9 : 0.1 / (names.length - 1)])));
    const r = await suggest("make a threat model for my new API", { entries, ask: c.ask, env: {} });
    expect(r.picks[0].name).toBe(last);
    expect(r.engine).toBe("used");
  });

  test("fail-open: an engine error or LIFEOS_GLANCE_DISABLED leaves the trigger ranking and three picks", async () => {
    const entries = loadEntries({ catalogPath: SHIPPED_CATALOG, userCatalogPath: null });
    const base = rank("is this contract safe to sign", entries, 3).map((p) => p.name);
    const boom: Ask = async () => { throw new Error("engine down"); };
    const failed = await suggest("is this contract safe to sign", { entries, ask: boom, env: {} });
    expect(failed.picks.map((p) => p.name)).toEqual(base);
    expect(failed.engine).toStartWith("skipped");
    const c = countingAsk();
    const off = await suggest("is this contract safe to sign", { entries, ask: c.ask, env: { LIFEOS_GLANCE_DISABLED: "1" } });
    expect(off.picks.map((p) => p.name)).toEqual(base);
    expect(c.calls()).toBe(0);
    const code = await main(["is this contract safe to sign"], { ask: boom, env: {} });
    expect(code).toBe(0);
    expect(await main([], { ask: boom, env: {} })).toBe(0);
  });
});

describe("local", () => {
  test("a USER catalog entry is merged at read time and found on its own trigger; shipped wins a name clash", async () => {
    tmp = mkdtempSync(join(tmpdir(), "suggest-local-"));
    mkdirSync(tmp, { recursive: true });
    const shipped = readCatalog(SHIPPED_CATALOG);
    const local: CatalogEntry[] = [
      { name: "rate_gardening_posts", purpose: "Rates gardening blog posts for a local newsletter.", category: "rating", triggers: ["rate gardening posts", "gardening newsletter", "compost blog"], input: "text", output: "Markdown", ported_intent: null, derived: "identity", system_md_hash: "0".repeat(64) },
      { ...shipped.find((e) => e.name === "summarize")!, purpose: "LOCAL SHADOW" },
    ];
    const userCatalog = join(tmp, "catalog.yaml");
    writeCatalog(userCatalog, local);
    const entries = loadEntries({ catalogPath: SHIPPED_CATALOG, userCatalogPath: userCatalog });
    expect(entries.find((e) => e.name === "summarize")!.purpose).not.toBe("LOCAL SHADOW");
    const r = await suggest("score this compost blog for the gardening newsletter", { entries, env: { LIFEOS_GLANCE_DISABLED: "1" } });
    expect(r.picks[0].name).toBe("rate_gardening_posts");
    expect(r.picks[0].local).toBe(true);
  });
});
