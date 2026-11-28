import { afterAll, describe, expect, test } from "bun:test";
import { ollamaAttempt, resolveVendor, type VendorConfig } from "./Inference";

// A stand-in Ollama: echoes the request back so each test can see what the lane sent.
let lastBody: any = null;
let reply: (body: any) => Response = () => Response.json({});
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    lastBody = await req.json();
    return reply(lastBody);
  },
});
afterAll(() => server.stop(true));

const cfg: VendorConfig = { default: "anthropic", ollamaModel: "test-model:1b", ollamaUrl: `http://localhost:${server.port}/` };
const ok = (content: string, extra: Record<string, unknown> = {}) =>
  Response.json({ model: "test-model:1b", message: { role: "assistant", content }, done: true, done_reason: "stop", prompt_eval_count: 12, eval_count: 3, ...extra });

describe("ollama lane", () => {
  test("is a known vendor", () => {
    expect(resolveVendor("ollama")).toBe("ollama");
  });

  test("sends system + user to /api/chat with thinking off and returns the answer", async () => {
    reply = () => ok("  hello  ");
    const r = await ollamaAttempt({ systemPrompt: "sys", userPrompt: "hi", level: "low" }, cfg);
    expect(r).toMatchObject({ success: true, output: "hello", vendor: "ollama", executedModel: "test-model:1b", usage: { input_tokens: 12, output_tokens: 3 } });
    expect(lastBody).toMatchObject({ model: "test-model:1b", stream: false, think: false, messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }] });
    expect(lastBody.format).toBeUndefined();
  });

  test("expectJson asks for JSON, strips an inline think trace, and parses", async () => {
    reply = () => ok('<think>hmm</think>{"a":1}');
    const r = await ollamaAttempt({ systemPrompt: "s", userPrompt: "u", level: "low", expectJson: true }, cfg);
    expect(lastBody.format).toBe("json");
    expect(r.success).toBe(true);
    expect(r.parsed).toEqual({ a: 1 });
  });

  test("a server error, a truncated answer and a missing model all fail (so fallback can run)", async () => {
    reply = () => Response.json({ error: "model 'x' not found" }, { status: 404 });
    expect((await ollamaAttempt({ systemPrompt: "s", userPrompt: "u", level: "low" }, cfg)).error).toContain("not found");
    reply = () => ok("partial", { done_reason: "length" });
    expect((await ollamaAttempt({ systemPrompt: "s", userPrompt: "u", level: "low" }, cfg)).success).toBe(false);
    expect((await ollamaAttempt({ systemPrompt: "s", userPrompt: "u", level: "low" }, { default: "anthropic" })).error).toContain("ollamaModel");
  });

  test("an unreachable server fails instead of throwing", async () => {
    const r = await ollamaAttempt({ systemPrompt: "s", userPrompt: "u", level: "low", timeout: 2000 }, { ...cfg, ollamaUrl: "http://127.0.0.1:1" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/^ollama:/);
  });
});
