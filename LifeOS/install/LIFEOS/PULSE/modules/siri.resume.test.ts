/**
 * Verifies that the second Siri turn passes the first session id to query()
 * inside options.resume rather than beside options.
 *
 * Issue #2795
 */
import { test, expect, mock } from "bun:test";
import { join } from "node:path";
import { homedir } from "node:os";

const pulse = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "LIFEOS", "PULSE");
const calls: any[] = [];
mock.module(Bun.resolveSync("@anthropic-ai/claude-agent-sdk", join(pulse, "modules")), () => ({
  query: (args: any) => {
    calls.push(args);
    return (async function* () {
      yield { type: "system", subtype: "init", session_id: "sess-1" };
      yield { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } };
    })();
  },
}));
mock.module(join(pulse, "lib", "lifeos-context.ts"), () => ({ buildLifeosContextBlock: async () => "" }));
mock.module(join(pulse, "lib", "mcp-allowlist.ts"), () => ({ loadRemoteMcpServers: () => ({}), mcpStatusPromptLine: () => "" }));
mock.module(join(pulse, "..", "..", "hooks", "lib", "identity.ts"), () => ({ getDAName: () => "DA", getPrincipalName: () => "Principal" }));

const TEST_BEARER = "probe";
process.env.SIRI_API_KEY = TEST_BEARER;

const { handleSiriRequest } = await import("./siri.ts");
const turn = (text: string) =>
  handleSiriRequest(
    new Request("http://localhost/api/siri/turn", {
      method: "POST",
      headers: { authorization: `Bearer ${TEST_BEARER}`, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
    "/api/siri/turn"
  );

test("second Siri turn passes the first session id to query() as options.resume", async () => {
  await turn("first");
  await turn("second");
  expect(calls.length).toBe(2);
  expect(calls[1].options?.resume).toBe("sess-1");
  expect(calls[1].options?.permissionMode).toBe("default");
});