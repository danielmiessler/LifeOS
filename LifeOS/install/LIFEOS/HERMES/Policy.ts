#!/usr/bin/env bun
/**
 * Policy — what a mounted Hermes sidecar may never read, and why.
 *
 * The mount is deliberately generous: the agent sees identity, TELOS, memory,
 * projects, and skills, because a front door that can't see those isn't a front
 * door. This file defines the narrow exception — the credential surface.
 *
 * The distinction that makes a full mount safe:
 *
 *   Secrets get USED, never SEEN. LifeOS skills are CLI-first, so the real work
 *   is a `bun .../Tools/X.ts` subprocess that reads its own credentials in its
 *   own memory. The agent invokes the tool and receives the RESULT. A token
 *   does its job without ever entering the model's context — so a successful
 *   prompt injection has nothing to exfiltrate.
 *
 * This is NOT the containment-zone list. Those zones mark what may hold
 * identity for RELEASE purposes and include the whole USER and MEMORY trees —
 * exactly what the sidecar is supposed to read. Conflating the two produces a
 * mount that can't do anything useful.
 *
 * Install-generic by construction: no home paths, no usernames, no instance
 * literals. Patterns resolve against the running install at emit time.
 */

import { writeFileSync } from "node:fs";
import { PULSE_PORT } from "../PULSE/endpoint";

export interface DenyRule {
  /** fnmatch-style glob, matched against the absolute path AND its `~` form. */
  pattern: string;
  /** Shown to the model when a call is blocked, so it can route around it. */
  reason: string;
}

/**
 * Credential and secret material. Blocking a read here costs the agent nothing
 * it legitimately needs — the CLI-first tool path supplies the capability.
 */
export const SENSITIVE_READ_RULES: readonly DenyRule[] = [
  // Environment files anywhere on disk — the single richest credential target.
  { pattern: "**/.env", reason: "environment file with live credentials" },
  { pattern: "**/.env.*", reason: "environment file with live credentials" },
  { pattern: "**/.envrc", reason: "environment file with live credentials" },

  // OAuth/token stores, including this sidecar's own and any sibling agent's.
  { pattern: "**/auth.json", reason: "OAuth token store" },
  { pattern: "**/.credentials.json", reason: "credential store" },
  { pattern: "**/credentials", reason: "credential store" },
  { pattern: "**/credentials.json", reason: "credential store" },
  { pattern: "**/*_token*.json", reason: "token store" },
  { pattern: "**/.netrc", reason: "machine credential file" },

  // OS-level credential directories.
  { pattern: "**/.ssh/**", reason: "SSH private key material" },
  { pattern: "**/.aws/**", reason: "cloud provider credentials" },
  { pattern: "**/.kube/**", reason: "cluster credentials" },
  { pattern: "**/.gnupg/**", reason: "GPG key material" },
  { pattern: "**/.docker/config.json", reason: "registry credentials" },

  // Key material by extension/name.
  { pattern: "**/id_rsa*", reason: "SSH private key" },
  { pattern: "**/id_ed25519*", reason: "SSH private key" },
  { pattern: "**/*.pem", reason: "private key or certificate" },
  { pattern: "**/*.p12", reason: "key bundle" },
  { pattern: "**/*.keystore", reason: "key bundle" },

  // Harness config that carries MCP auth and permission grants.
  { pattern: "**/.claude/settings.json", reason: "harness config containing auth and permission grants" },
  { pattern: "**/.claude/settings.local.json", reason: "harness config containing auth and permission grants" },

  // Operational security state — findings, posture, monitoring detail. Useful
  // to an attacker, never needed to answer the principal.
  { pattern: "**/LIFEOS/USER/SECURITY/**", reason: "security posture and findings" },

  // Sibling agent credential homes.
  { pattern: "**/.codex/**", reason: "sibling agent credential store" },

  // The guard's own control plane. Without these, the agent disarms the guard
  // before it ever fires: Hermes' `terminal` and `execute_code` never consult
  // its write-safety module (`agent/file_safety.py` says so itself), and its
  // write-deny set covers credential dirs but NOT `config.yaml`, `plugins/`,
  // or `cron/`. One `terminal` call writing `plugins: {enabled: []}` and the
  // next process starts unguarded. Deny rules cover read AND write, because
  // `pathBearingTools` includes `write_file`/`patch`/`edit_file`.
  { pattern: "**/.hermes/config.yaml", reason: "sidecar control plane — editing it disarms the guard" },
  { pattern: "**/.hermes/plugins/**", reason: "the guard's own code and policy" },
  { pattern: "**/.hermes/cron/**", reason: "unattended job definitions" },
  { pattern: "**/.hermes/bin/**", reason: "sidecar binaries — self-invocation escapes session taint" },
  { pattern: "**/.hermes/hermes-agent/**", reason: "sidecar runtime — self-invocation escapes session taint" },
];

/**
 * Read-only exceptions, consulted before denyRules but ONLY for the native
 * read-class tools in READ_ONLY_TOOLS — write/edit/patch tools and every shell
 * command still hit the full deny set. Scope is one directory: `cron/output/`
 * is text the sidecar itself produced (job run output the agent needs to answer
 * "what did the morning brief say"), 276 of the first 2,704 audited blocks. The
 * scheduler's job DEFINITIONS (`cron/jobs.json`, the executions db) stay denied
 * to every tool, and every write anywhere under `cron/` stays denied.
 */
export const READ_ALLOW_RULES: readonly DenyRule[] = [
  { pattern: "**/.hermes/cron/output/**", reason: "sidecar-authored job output — readable, never writable" },
];

/** Native tools that can only READ; the read-allow exception applies to these alone. */
export const READ_ONLY_TOOLS: readonly string[] = [
  "read_file",
  "read_file_raw",
  "grep",
  "search_files",
  "list_files",
  "glob",
];

/**
 * Shell commands are guarded separately by Hermes' own `approvals.deny`, which
 * matches command text before any bypass. These are the globs that list ships
 * with — kept here so one file is the whole policy.
 */
export const SHELL_DENY_GLOBS: readonly string[] = [
  // Env files, matched as PATHS rather than as the substring ".env". `*.env*` also matches
  // `os.environ` and `process.env`, so it denied six of the sidecar's first eleven blocked
  // commands — none of which touched a file — and killed the mail-monitor cron outright.
  // A glob that fires on ordinary code trains everyone to route around the guard.
  "*/.env*", // path-qualified: ~/.claude/.env, $HOME/.env, /any/dir/.envrc
  "* .env*", // bare argument: `cat .env`
  "*\".env*", // quoted argument
  "*'.env*",
  "*.ssh*",
  "*.aws*",
  "*.kube*",
  "*.netrc*",
  "*.codex*",
  "*auth.json*",
  "*keychain*",
  "*security find-generic-password*",
  "*security find-internet-password*",

  // The two surfaces the read guard denies but a shell command would otherwise reach, since
  // SENSITIVE_READ_RULES bind path-bearing TOOLS and these globs are the only thing standing
  // in front of `terminal`. Narrow on purpose: an installed config carried `*.claude*` and
  // `*.config/LIFEOS*` instead, which denied every command naming the LifeOS tree — that is
  // every skill CLI, because all of them live under it. The mount's whole premise is invoking
  // those tools, so the blanket globs denied the sidecar its only way to do useful work while
  // looking like ordinary hardening.
  "*.claude/settings*", // harness config carrying auth and permission grants
  "*LIFEOS/USER/SECURITY*", // security posture and findings, via either path or the symlink

  // Self-invocation. Session taint is keyed to a session id, so spawning a
  // FRESH agent launders it: one command, no special knowledge, and everything
  // blocked in the parent runs in the child with a clean ledger. Starting a
  // second agent from inside an agent is never legitimate work here, so it is
  // denied in EVERY session, tainted or not. The install's own launcher is
  // named after its DA, so `launcherGlobs()` adds that name at emit time
  // rather than this file naming anyone.
  "*hermes chat*",
  "*hermes agent*",
  "*hermes -q*",
  "*hermes run*",
  "*hermes-agent*",
  "*launchctl*",

  // Pulse VoiceServer speaker endpoints. Hermes delivers replies over its own
  // channels (iMessage, local output) — a desktop-speaker call from
  // ANY Hermes session is a leak, and cron sessions reading their skill
  // announcements aloud is exactly the 2026-08-14 incident (fifth recurrence:
  // the LifeLog commitment-capture job spoke every SKILL.md "Running the X
  // workflow" curl because the sidecar runtime has none of Claude Code's
  // hooks). Denied wholesale, /voice/health included — the sidecar has no
  // legitimate reason to reach the voice surface at all.
  // Resolved at emit time from the configured Pulse port (#2392) — same
  // parameterize-at-emit pattern as launcherGlobs().
  `*${PULSE_PORT}/notify*`,
  `*${PULSE_PORT}/pai*`,
  `*${PULSE_PORT}/voice*`,
];

/**
 * Deny globs for an install's DA-named launcher. Kept out of the constant so no
 * name ships. Command-POSITION forms only: the earlier catch-all `* <name> *`
 * matched the DA's name as an ordinary word — 168 of the first 2,704 audited
 * blocks were prose like "review new personal work {{DA_NAME}} messages" inside a
 * printf. A launcher can only escape taint by being EXECUTED, which means the
 * name sits at command position: line start, after a separator, inside a
 * substitution, or behind an exec-style prefix. Those forms stay denied.
 */
export function launcherGlobs(launcherName: string): string[] {
  const n = launcherName.trim().toLowerCase();
  if (!n || !/^[a-z0-9_-]+$/.test(n)) return [];
  return [
    `${n} *`, // command line starts with the launcher
    `${n}`, // bare invocation, no args
    `*/${n} *`, // path-qualified: ~/.local/bin/<name>
    `*/${n}`,
    `*;${n} *`, // after a separator
    `*; ${n} *`,
    `*|${n} *`,
    `*| ${n} *`,
    `*&${n} *`,
    `*& ${n} *`,
    `*$(${n} *`, // command substitution
    `*\`${n} *`,
    `*exec ${n} *`, // exec-style prefixes
    `*sudo ${n} *`,
    `*env ${n} *`,
    `*xargs ${n} *`,
    `*nohup ${n} *`,
  ];
}

/**
 * Tools whose arguments carry a filesystem path we must inspect. Maps tool
 * name → the argument keys that may hold a path.
 */
export const PATH_BEARING_TOOLS: Readonly<Record<string, readonly string[]>> = {
  read_file: ["path", "file_path", "filename"],
  read_file_raw: ["path", "file_path", "filename"],
  write_file: ["path", "file_path", "filename"],
  patch: ["path", "file_path", "filename"],
  edit_file: ["path", "file_path", "filename"],
  grep: ["path", "dir", "directory"],
  search_files: ["path", "dir", "directory"],
  list_files: ["path", "dir", "directory"],
  glob: ["path", "dir", "directory"],
};

/**
 * Tools whose whole argument payload is a command or program body.
 *
 * `execute_code` matters as much as `terminal`: a two-line Python snippet reads
 * any file the process can reach, and a guard that only watches the shell is a
 * guard with a documented hole. Tool names verified against the installed tree,
 * not assumed — `bash`/`shell` are aliases kept for other Hermes builds.
 */
export const COMMAND_BEARING_TOOLS: Readonly<Record<string, readonly string[]>> = {
  terminal: ["command", "cmd", "script"],
  read_terminal: ["command", "cmd"],
  execute_code: ["code", "source", "script", "program"],
  bash: ["command", "cmd", "script"],
  shell: ["command", "cmd", "script"],
};

/* ─────────────────────────── Control 4: provenance ───────────────────────────
 *
 * Reading is not the boundary; what can LEAVE is. Controls 1 and 2 stop secrets
 * entering the context. This is the other half: stopping attacker-controlled
 * TEXT from reaching a privileged action.
 *
 * The LifeOS side does this with `Safety.hook.ts`, a Claude Code hook that
 * cannot fire inside a Hermes turn. So the same job is done here, in the one
 * plugin that does run in-process.
 *
 * The shape, and the part that matters: pattern matching is NOT the defense.
 * Patterns decide when to TAINT. The defense is that a tainted turn cannot make
 * a privileged call. A detector alone loses to a patient attacker, because the
 * detector reads the attacker's text too.
 */

/**
 * Tools whose RESULTS carry text an attacker may have written: fetched pages,
 * inbound messages, mail. Anything here taints the turn that reads it.
 */
export const UNTRUSTED_RESULT_TOOLS: readonly string[] = [
  "web_fetch",
  "web_search",
  "fetch_url",
  "browser",
  "browser_tool",
  "read_url",
  "send_to_url",
  "read_message",
  "read_messages",
  "gmail",
  "email_read",
];

/**
 * Shell/exec commands whose OUTPUT is third-party text. LifeOS is CLI-first, so
 * most ingestion is a subprocess rather than a native tool, and a rule watching
 * only native tools has a hole the size of the whole skill library.
 */
export const UNTRUSTED_OUTPUT_COMMAND_GLOBS: readonly string[] = [
  "*_inbox*",
  "*gmail*",
  "*gws*mail*",
  "*/read.ts*",
  "*webfetch*",
  "*curl*",
  "*wget*",
  "*_feed*",
  "*_surface*",
];

/**
 * Native tools that can act on the world. Once a turn is tainted these are
 * refused, because an injected instruction reaching one of them is the whole
 * attack.
 */
export const PRIVILEGED_TOOLS: readonly string[] = [
  "send",
  "send_message",
  "send_to_url",
  "write_file",
  "patch",
  "edit_file",
  "computer_use",
  "skill_manage",
  "cron_create",
  "cron_update",
];

/**
 * Shell commands that act on the world. Same rule, applied to the CLI-first
 * path: outbound comms, publishing, deploying, and anything that mutates a repo.
 */
export const PRIVILEGED_COMMAND_GLOBS: readonly string[] = [
  "*_communication*",
  "*sendemail*",
  "*send_email*",
  "*sendtext*",
  "*twilio*",
  "*_broadcast*",
  "*_socialpost*",
  "*_x/*post*",
  "*discord*",
  "*telegram*",
  "*wrangler*deploy*",
  "*git*push*",
  "*gh*issue*create*",
  "*gh*pr*create*",
  "*rm -rf*",
];

/**
 * Injection SHAPES. Deliberately about instruction-giving grammar rather than
 * any specific payload, since payloads are cheap to vary and shapes are not.
 * A hit taints; it never by itself blocks. False positives therefore cost a
 * blocked privileged call, not a blocked read.
 */
export const INJECTION_SHAPE_PATTERNS: readonly string[] = [
  "(?i)ignore (all |any )?(previous|prior|earlier|above) (instructions|prompts|rules)",
  "(?i)disregard (your|all|any|the) (instructions|rules|system prompt|guidelines)",
  "(?i)(you are|act as|pretend to be) (now |a )?(different|new|dan\\b|admin|developer mode)",
  "(?i)(system|developer) (prompt|message|instruction)\\s*[:>]",
  "(?i)<\\s*/?\\s*(system|instructions?|admin)\\s*>",
  "(?i)\\[\\s*(system|instruction|admin|important)\\s*\\]",
  "(?i)(new|updated|revised) (instructions?|task|directive)s?\\s*[:>]",
  "(?i)(do not|don't) (tell|inform|mention to|alert) (the )?(user|principal|owner|human)",
  "(?i)(send|forward|email|post|upload|exfiltrate) .{0,40}(to|at) [\\w.+-]+@[\\w.-]+",
  "(?i)(reveal|print|output|show|dump) (your|the) (system prompt|instructions|rules|context)",
  "(?i)base64\\s*(-d|--decode|decode)",
  "(?i)curl [^|]*\\|\\s*(bash|sh|zsh|python)",
];

/**
 * Egress hosts whose responses are FIRST-party: the operator's own local
 * services. A curl hitting only these does not mark its output as third-party
 * text. Ship-generic default is loopback alone; an install extends the list
 * via `LIFEOS/USER/CONFIG/hermes-trusted-domains.json` (read by Mount.ts at
 * emit time, never named here). Matching in the guard is exact-or-dot-suffix
 * and fails closed: unlisted host, unparseable URL, or empty list all taint.
 */
export const TRUSTED_EGRESS_DEFAULTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

export interface GuardPolicy {
  version: number;
  denyRules: DenyRule[];
  readAllowRules: DenyRule[];
  readOnlyTools: readonly string[];
  pathBearingTools: Record<string, readonly string[]>;
  commandBearingTools: Record<string, readonly string[]>;
  shellDenyGlobs: readonly string[];
  untrustedResultTools: readonly string[];
  untrustedOutputCommandGlobs: readonly string[];
  privilegedTools: readonly string[];
  privilegedCommandGlobs: readonly string[];
  injectionShapePatterns: readonly string[];
  trustedEgressDomains: readonly string[];
}

export function buildPolicy(opts: { launcherName?: string; trustedEgressDomains?: readonly string[] } = {}): GuardPolicy {
  const extra = (opts.trustedEgressDomains ?? []).map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  return {
    version: 5,
    denyRules: [...SENSITIVE_READ_RULES],
    readAllowRules: [...READ_ALLOW_RULES],
    readOnlyTools: READ_ONLY_TOOLS,
    pathBearingTools: PATH_BEARING_TOOLS,
    commandBearingTools: COMMAND_BEARING_TOOLS,
    shellDenyGlobs: [...SHELL_DENY_GLOBS, ...launcherGlobs(opts.launcherName ?? "")],
    untrustedResultTools: UNTRUSTED_RESULT_TOOLS,
    untrustedOutputCommandGlobs: UNTRUSTED_OUTPUT_COMMAND_GLOBS,
    privilegedTools: PRIVILEGED_TOOLS,
    privilegedCommandGlobs: PRIVILEGED_COMMAND_GLOBS,
    injectionShapePatterns: INJECTION_SHAPE_PATTERNS,
    trustedEgressDomains: [...new Set([...TRUSTED_EGRESS_DEFAULTS, ...extra])],
  };
}

/** Emit the policy as JSON for the Python guard plugin to consume. */
export function emitPolicy(
  destination: string,
  opts: { launcherName?: string; trustedEgressDomains?: readonly string[] } = {},
): GuardPolicy {
  const policy = buildPolicy(opts);
  writeFileSync(destination, JSON.stringify(policy, null, 2) + "\n", "utf8");
  return policy;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const launcherIdx = argv.indexOf("--launcher");
  const launcherName = launcherIdx !== -1 ? (argv[launcherIdx + 1] ?? "") : "";
  const positional = argv.filter((a, i) => a !== "--launcher" && i !== launcherIdx + 1);
  const dest = positional[0];
  if (!dest) {
    process.stdout.write(JSON.stringify(buildPolicy({ launcherName }), null, 2) + "\n");
  } else {
    const p = emitPolicy(dest, { launcherName });
    console.log(`✓ policy v${p.version} — ${p.denyRules.length} read rules → ${dest}`);
  }
}
