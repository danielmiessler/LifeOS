/**
 * Test for shipped Python deny rules in settings.system.json.
 * Validates that inline Python via -c, stdin dash, heredoc, and pipeline are denied,
 * while executing existing script files remains permitted.
 *
 * Issue #2797
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Python deny rules in settings.system.json", () => {
  const settingsPath = join(import.meta.dir, "settings.system.json");
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const deny: string[] = settings.permissions?.deny ?? [];
  const globs = deny
    .filter((r) => r.startsWith("Bash(") && /python/.test(r))
    .map((r) => r.slice(5, -1));

  const deniedOne = (cmd: string) =>
    globs.some((g) =>
      new RegExp(
        "^" +
          g
            .split("*")
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*") +
          "$",
        "s"
      ).test(cmd)
    );

  const denied = (cmd: string) =>
    cmd.split(/\s*(?:\|\||&&|\||;)\s*/).some((part) => deniedOne(part.trim()));

  test("shipped python deny rules are present", () => {
    expect(globs.length).toBeGreaterThan(0);
  });

  test("control: inline -c is denied", () => {
    expect(denied(`python3 -c "open('f','w').write('x')"`)).toBe(true);
    expect(denied(`python -c "print(1)"`)).toBe(true);
  });

  test("control: stdin dash is denied", () => {
    expect(denied(`python3 - < script.py`)).toBe(true);
    expect(denied(`python -`)).toBe(true);
    expect(denied(`python3 -`)).toBe(true);
  });

  test("control: running an existing script file stays allowed", () => {
    expect(denied("python3 tool.py --input data.csv")).toBe(false);
    expect(denied("python script.py")).toBe(false);
    expect(denied("python3 -u tool.py")).toBe(false);
  });

  test("a heredoc program on stdin is denied like -c", () => {
    expect(denied(`python3 <<'PY'\nopen('f','w').write('x')\nPY`)).toBe(true);
    expect(denied(`python <<'PY'\nprint(1)\nPY`)).toBe(true);
    expect(denied(`python3 <<EOF\nprint(1)\nEOF`)).toBe(true);
  });

  test("a piped program on stdin is denied like -c", () => {
    expect(denied(`echo "open('f','w').write('x')" | python3`)).toBe(true);
    expect(denied(`cat script.py | python`)).toBe(true);
  });
});
