// Per-install glue words for the retriever's query side (public issue #2207).
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installGlueWords, retrievalTerms } from "./MemoryRetriever";

const dir = mkdtempSync(join(tmpdir(), "glue-words-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const list = (name: string, text: string) => { const f = join(dir, name); writeFileSync(f, text); return f; };

test("no file: no extra words, and the query terms are what they were", () => {
  const none = installGlueWords(join(dir, "missing.txt"));
  expect(none.size).toBe(0);
  expect(retrievalTerms("how do I adjust the lithium dose", none)).toEqual(["how", "adjust", "lithium", "dose"]);
  expect(retrievalTerms("go ahead and check the Go build", none)).toEqual(["go", "check", "build"]);
});

test("the listed words leave the query; comments and blank lines are ignored", () => {
  const words = installGlueWords(list("pt.txt", "# Portuguese glue words\nque\nde\n\npara o\ncomo # how\n"));
  expect([...words].sort()).toEqual(["como", "de", "para", "que"]);
  expect(retrievalTerms("como ajustar a dose de litio para o paciente que chegou", words)).toEqual(["ajustar", "dose", "litio", "paciente", "chegou"]);
});

test("each line goes through the same tokenizer as the query", () => {
  const words = installGlueWords(list("tok.txt", "Você\nPOR FAVOR\n"));
  const query = "você pode revisar por favor o laudo";
  expect(retrievalTerms(query, words)).toEqual(retrievalTerms(query, new Set()).filter(t => !words.has(t)));
  expect(retrievalTerms(query, words)).not.toContain("favor");
});

test("a listed word leaves the query even where QUERY_GLUE keeps it", () => {
  expect(retrievalTerms("go ahead and check the Go build", installGlueWords(list("go.txt", "go\n")))).toEqual(["check", "build"]);
});

test("a list that cannot be read throws instead of reading as empty", () => {
  mkdirSync(join(dir, "a-directory.txt"));
  expect(() => installGlueWords(join(dir, "a-directory.txt"))).toThrow();
});

test("an edit to the list is seen by the same process on its next read", () => {
  const f = list("live.txt", "que\n");
  expect([...installGlueWords(f)]).toEqual(["que"]);
  writeFileSync(f, "que\ncomo\nmais\n");
  expect([...installGlueWords(f)].sort()).toEqual(["como", "mais", "que"]);
  rmSync(f);
  expect(installGlueWords(f).size).toBe(0);
});
