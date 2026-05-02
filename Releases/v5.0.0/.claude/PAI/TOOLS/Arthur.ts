#!/usr/bin/env bun
// Arthur — Credential Custodian
// Thin, deterministic TypeScript client + policy engine for PAI credential access.
// Backed by GCP Secret Manager. Persona and voice live in PAI/USER/DA/arthur/.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { getPaiDir } from '../lib/paths';

const PAI_DIR = getPaiDir();
const POLICIES_PATH = join(PAI_DIR, "USER", "ARTHUR", "policies.yaml");
const GCP_PROJECT = process.env.PAI_GCP_PROJECT ?? "";

// ───────────────────────── Types ─────────────────────────

interface Policy {
  allowed_callers?: string[];
  purposes?: string[];
  rate_limit?: string;
  risk?: "low" | "medium" | "high" | "critical";
  require_confirmation?: boolean;
  time_window?: string;
}

interface Policies {
  version: number;
  [key: string]: Policy | number | undefined;
}

interface AccessRequest {
  key: string;
  caller: string;
  purpose: string;
  session_id?: string;
}

type Verdict = "ALLOW" | "DENY" | "CONFIRM";

interface PolicyDecision {
  verdict: Verdict;
  reason: string;
  rule: string;
}

// ───────────────────────── Audit log ─────────────────────────

function securityLogPath(kind: string): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dir = join(PAI_DIR, "MEMORY", "SECURITY", year, month);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `arthur-${kind}-${year}${month}${day}.jsonl`);
}

export function audit(event: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    agent: "arthur",
    ...event,
  };
  const kind = typeof event.event_type === "string" ? event.event_type : "event";
  appendFileSync(securityLogPath(kind), JSON.stringify(entry) + "\n", "utf8");
}

// ───────────────────────── Policy loader ─────────────────────────

let policiesCache: Policies | null = null;
let policiesLoadedAt = 0;
const POLICIES_CACHE_MS = 5_000;

function loadPolicies(): Policies {
  const now = Date.now();
  if (policiesCache && now - policiesLoadedAt < POLICIES_CACHE_MS) return policiesCache;
  const text = readFileSync(POLICIES_PATH, "utf8");
  policiesCache = YAML.parse(text) as Policies;
  policiesLoadedAt = now;
  return policiesCache;
}

function getPolicy(key: string): Policy | null {
  const policies = loadPolicies();
  const p = policies[key];
  if (p && typeof p === "object") return p as Policy;
  return null;
}

// ───────────────────────── Rate limiting (SQLite, in-memory for v1) ─────────────────────────

const rateWindows = new Map<string, number[]>();

function checkRate(key: string, caller: string, limit: string): { ok: boolean; reason?: string } {
  const match = limit.match(/^(\d+)\/(minute|hour|day)$/);
  if (!match) return { ok: true };
  const [, countStr, unit] = match;
  const max = parseInt(countStr, 10);
  const windowMs = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
  const bucket = `${key}|${caller}`;
  const now = Date.now();
  const hits = (rateWindows.get(bucket) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    return { ok: false, reason: `rate limit: ${limit} exceeded (${hits.length} hits)` };
  }
  hits.push(now);
  rateWindows.set(bucket, hits);
  return { ok: true };
}

// ───────────────────────── Time window check ─────────────────────────

function checkTimeWindow(window: string): { ok: boolean; reason?: string } {
  const match = window.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return { ok: true };
  const [, sh, sm, eh, em] = match;
  const now = new Date();
  const ptOffsetMin = -now.getTimezoneOffset(); // TODO: enforce America/Los_Angeles strictly
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMin = parseInt(sh, 10) * 60 + parseInt(sm, 10);
  const endMin = parseInt(eh, 10) * 60 + parseInt(em, 10);
  if (minutesNow < startMin || minutesNow > endMin) {
    return { ok: false, reason: `outside time window ${window} (now ${now.toLocaleTimeString()})` };
  }
  return { ok: true };
}

// ───────────────────────── Policy evaluation ─────────────────────────

export function evaluate(req: AccessRequest): PolicyDecision {
  const policy = getPolicy(req.key);

  // Default-allow for unlisted keys (low-risk bias per v1 design)
  if (!policy) {
    return {
      verdict: "ALLOW",
      reason: "no explicit policy; default-allow for low-risk unlisted keys",
      rule: "default",
    };
  }

  // Caller allowlist check
  if (policy.allowed_callers && !policy.allowed_callers.includes("any")) {
    if (!policy.allowed_callers.includes(req.caller)) {
      return {
        verdict: "DENY",
        reason: `caller '${req.caller}' not in allowlist for ${req.key}`,
        rule: "allowed_callers",
      };
    }
  }

  // Purpose declaration (mandatory if policy specifies purposes)
  if (policy.purposes && policy.purposes.length > 0) {
    if (!req.purpose || req.purpose.length < 3) {
      return {
        verdict: "DENY",
        reason: `purpose required for ${req.key}; none declared`,
        rule: "purpose_required",
      };
    }
    const matched = policy.purposes.some((p) => req.purpose.toLowerCase().includes(p.toLowerCase()));
    if (!matched) {
      return {
        verdict: "DENY",
        reason: `purpose '${req.purpose}' does not match allowed list [${policy.purposes.join(", ")}]`,
        rule: "purpose_match",
      };
    }
  }

  // Rate limit
  if (policy.rate_limit) {
    const rate = checkRate(req.key, req.caller, policy.rate_limit);
    if (!rate.ok) {
      return { verdict: "DENY", reason: rate.reason!, rule: "rate_limit" };
    }
  }

  // Time window
  if (policy.time_window) {
    const win = checkTimeWindow(policy.time_window);
    if (!win.ok) {
      return { verdict: "DENY", reason: win.reason!, rule: "time_window" };
    }
  }

  // High-risk confirmation
  if (policy.require_confirmation) {
    return {
      verdict: "CONFIRM",
      reason: `risk=${policy.risk ?? "high"} requires human confirmation`,
      rule: "require_confirmation",
    };
  }

  return { verdict: "ALLOW", reason: "policy checks passed", rule: "policy_match" };
}

// ───────────────────────── GCP Secret Manager fetch ─────────────────────────

const secretCache = new Map<string, { value: string; fetchedAt: number }>();
const SECRET_CACHE_MS = 60_000;

async function fetchFromGCP(key: string): Promise<string> {
  const cached = secretCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < SECRET_CACHE_MS) return cached.value;

  if (!GCP_PROJECT) {
    throw new Error("PAI_GCP_PROJECT env var not set; Arthur cannot reach the vault");
  }

  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${GCP_PROJECT}/secrets/${key}/versions/latest`,
  });
  const value = version.payload?.data?.toString() ?? "";
  if (!value) throw new Error(`GCP returned empty payload for ${key}`);
  secretCache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

// ───────────────────────── Confirmation channel (v1 stub) ─────────────────────────

async function requestConfirmation(req: AccessRequest, reason: string): Promise<boolean> {
  // v1 stub — sends push via Pulse/Telegram and waits up to 60s for approval
  // TODO: wire to actual Telegram/iMessage push handler
  audit({
    event_type: "confirmation_requested",
    key: req.key,
    caller: req.caller,
    purpose: req.purpose,
    reason,
    session_id: req.session_id,
  });

  if (process.env.PAI_ARTHUR_OVERRIDE === "1") {
    audit({ event_type: "override", key: req.key, caller: req.caller, reason: "PAI_ARTHUR_OVERRIDE=1" });
    return true;
  }

  // v1: conservative default — no auto-approval without human channel wired up.
  console.error(`[Arthur] CONFIRMATION REQUIRED for ${req.key} by ${req.caller}. Set PAI_ARTHUR_OVERRIDE=1 for one-shot approval.`);
  return false;
}

// ───────────────────────── Public API ─────────────────────────

export async function get(
  key: string,
  opts: { caller: string; purpose: string; session_id?: string }
): Promise<string> {
  const req: AccessRequest = { key, caller: opts.caller, purpose: opts.purpose, session_id: opts.session_id };

  // Policy check
  const decision = evaluate(req);
  audit({
    event_type: "credential_request",
    key,
    caller: opts.caller,
    purpose: opts.purpose,
    session_id: opts.session_id,
    verdict: decision.verdict,
    rule: decision.rule,
    reason: decision.reason,
  });

  if (decision.verdict === "DENY") {
    throw new ArthurDeniedError(`Arthur denied ${key} for ${opts.caller}: ${decision.reason}`);
  }

  if (decision.verdict === "CONFIRM") {
    const approved = await requestConfirmation(req, decision.reason);
    if (!approved) {
      audit({ event_type: "credential_deny", key, caller: opts.caller, reason: "confirmation not received" });
      throw new ArthurDeniedError(`Arthur denied ${key} for ${opts.caller}: confirmation not received`);
    }
    audit({ event_type: "confirmation_approved", key, caller: opts.caller });
  }

  // Fetch from vault
  const value = await fetchFromGCP(key);
  audit({
    event_type: "credential_release",
    key,
    caller: opts.caller,
    purpose: opts.purpose,
    session_id: opts.session_id,
    verdict: "ALLOW",
    rule: decision.rule,
  });
  return value;
}

export class ArthurDeniedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ArthurDeniedError";
  }
}

// ───────────────────────── CLI entrypoint ─────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "get") {
    const key = args[1];
    const caller = args.find((a) => a.startsWith("--caller="))?.split("=")[1] ?? "cli";
    const purpose = args.find((a) => a.startsWith("--purpose="))?.split("=")[1] ?? "cli-manual";
    if (!key) {
      console.error("Usage: Arthur.ts get KEY_NAME [--caller=NAME] [--purpose=TEXT]");
      process.exit(1);
    }
    try {
      const value = await get(key, { caller, purpose });
      process.stdout.write(value);
    } catch (err) {
      if (err instanceof ArthurDeniedError) {
        console.error(`Arthur: ${err.message}`);
        process.exit(2);
      }
      throw err;
    }
  } else if (cmd === "status") {
    const key = args[1];
    if (!key) {
      console.error("Usage: Arthur.ts status KEY_NAME");
      process.exit(1);
    }
    const policy = getPolicy(key);
    console.log(JSON.stringify({ key, policy: policy ?? "default-allow" }, null, 2));
  } else if (cmd === "policies") {
    console.log(YAML.stringify(loadPolicies()));
  } else {
    console.error("Arthur CLI commands: get KEY | status KEY | policies");
    process.exit(1);
  }
}
