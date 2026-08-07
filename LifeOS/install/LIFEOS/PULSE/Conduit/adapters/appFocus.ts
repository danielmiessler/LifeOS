/**
 * app-focus adapter — the foreground application at poll time.
 *
 * Uses `osascript` via execFile (argument array, never a shell string — no
 * interpolation, per the security protocol). Captures the app NAME only, no window
 * title (window titles need Screen Recording permission; deferred to v1.1). Cheap:
 * one ~50ms osascript call per poll. Never throws — returns [] on any failure.
 *
 * macOS ONLY, and it says so now. `osascript` does not exist off macOS, so on any
 * other platform every poll used to fall into the bare `catch` and return [] with no
 * log line. That hides the gap indefinitely: capture reports ok, events accumulate,
 * and the whole time model silently reads zero, because rollup derives every minute
 * from app-focus. A failure this total must be audible, so the reason is logged ONCE
 * per process — never is wrong, and every poll would drown the log.
 *
 * There is no drop-in replacement on Wayland: an unprivileged process cannot ask
 * which window has focus. GNOME's org.gnome.Shell.Introspect.GetWindows answers
 * AccessDenied, and xprop sees only XWayland clients, so it would report confidently
 * wrong apps for native ones. A Shell extension exposing focus over D-Bus is the
 * real port. Until then rollup.ts falls back to session-derived time.
 */
import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import type { ConduitConfig } from "../config.ts";
import type { ConduitEvent } from "../types.ts";

const FRONT_APP_SCRIPT =
  'tell application "System Events" to get name of first application process whose frontmost is true';

/** One line per process, not per poll — a 2-minute cron would drown the log. */
let warned = false;
function warnOnce(reason: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[conduit:appFocus] disabled — ${reason}. No app-focus events will be captured; rollup falls back to session-derived time.`);
}

export function capture(config: ConduitConfig): ConduitEvent[] {
  if (platform() !== "darwin") {
    warnOnce(`app-focus requires macOS \`osascript\`, host is ${platform()}`);
    return [];
  }
  try {
    const app = execFileSync("osascript", ["-e", FRONT_APP_SCRIPT], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (!app) return [];
    // Pin the interval this span represents onto the event, so rollup values it at the
    // interval in effect at capture time — not whatever the config says later.
    return [
      {
        ts: new Date().toISOString(),
        type: "app-focus",
        source: "appFocus",
        app,
        detail: { intervalSec: config.pollIntervalSec },
      },
    ];
  } catch (err) {
    // On macOS a throw here is a real fault (Automation permission not granted,
    // System Events unresponsive) — not an expected platform gap, so it is worth
    // saying out loud exactly once.
    warnOnce(`osascript failed: ${String((err as Error)?.message ?? err).slice(0, 120)}`);
    return [];
  }
}
