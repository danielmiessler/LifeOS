#!/usr/bin/env bun
/**
 * @version 1.0.0
 * Er.ts — file one erratum from the principal's words (the /er command).
 *
 *   bun Er.ts [--product] [--channel <channel>] [--system <name>] [--session <id>] [--transcript <path>] "<text>"
 *
 * A leading tag sets the kind (bug: feature: praise: question: incident:);
 * default is complaint. The text after the tag is written verbatim.
 */
import { outputIdsSince, readTranscript, tildePath, writeReactionLabels } from "../../../LIFEOS/ERRATA/Capture";
import { ErrataStore } from "../../../LIFEOS/ERRATA/Store";
import { frustrationRead } from "../../../LIFEOS/ERRATA/Signals";
import { CHANNELS, SYSTEMS, type Channel, type Kind, type System } from "../../../LIFEOS/ERRATA/Schema";

export const USAGE = `usage: bun Er.ts [--product] [--channel <channel>] [--system <name>] [--session <id>] [--transcript <path>] "<text>"`;

const TAGS: Record<string, Kind> = {
  bug: "bug", feature: "feature-request", feat: "feature-request", praise: "praise",
  question: "question", q: "question", incident: "incident", complaint: "complaint",
};

export function parseErArgs(argv: string[]): { text: string; kind: Kind; product: boolean; system: System; session?: string; transcript?: string; channel: Channel } {
  let product = false; let channel: Channel = "er-command"; let system: System = "lifeos"; let session: string | undefined; let transcript: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--product") product = true;
    else if (a === "--system") { const v = argv[++i]; if (!(SYSTEMS as readonly string[]).includes(v)) throw new Error(`unknown system: ${v}`); system = v as System; }
    else if (a === "--channel") { const v = argv[++i]; if (!(CHANNELS as readonly string[]).includes(v)) throw new Error(`unknown channel: ${v}`); channel = v as Channel; }
    else if (a === "--session") session = argv[++i];
    else if (a === "--transcript") transcript = argv[++i];
    // Before any text, an unknown --word is a mistyped option, not feedback: filing it would record the typo.
    else if (rest.length === 0 && /^--[a-z][a-z-]*$/i.test(a)) throw new Error(`unknown option: ${a}\n${USAGE}`);
    else rest.push(a);
  }
  let text = rest.join(" ").trim();
  let kind: Kind = "complaint";
  const m = text.match(/^([a-z]+):\s*/i);
  if (m && TAGS[m[1].toLowerCase()]) { kind = TAGS[m[1].toLowerCase()]; text = text.slice(m[0].length).trim(); }
  if (!text) throw new Error("nothing to file");
  return { text, kind, product, system, session, transcript, channel };
}

export function fileErratum(argv: string[], store = new ErrataStore()) {
  const a = parseErArgs(argv);
  const t = readTranscript(a.transcript);
  const fr = frustrationRead(a.text);
  const sessionId = a.session ?? process.env.CLAUDE_SESSION_ID ?? null;
  const row = store.append({
    system: a.system,
    target: a.product ? "lifeos-product" : "instance",
    source: "principal",
    channel: a.channel,
    kind: a.kind,
    frustration: a.kind === "praise" ? 0 : fr.score,
    complaint: a.text,
    context: {
      requested: t.requested, doing: t.tool_calls.length ? t.tool_calls.map((c) => `${c.name}: ${c.summary}`).join(" · ") : null,
      response_preview: t.response_preview, response_hash: t.response_hash,
      session_id: sessionId, output_ids: outputIdsSince(sessionId, t.requested_ts), cwd: t.cwd ?? tildePath(process.cwd()), model: t.model, tool_calls: t.tool_calls,
    },
    reporter: { id: "principal", role: "principal" },
  });
  if (row) writeReactionLabels(row);
  return row;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === "--help" || argv[0] === "-h") { console.log(USAGE); process.exit(0); }
  try {
    const e = fileErratum(argv);
    if (!e) { console.error("duplicate; nothing filed"); process.exit(1); }
    console.log(`${e.id} · ${e.kind} · ${e.system}${e.target === "lifeos-product" ? " · product" : ""}`);
  } catch (err) {
    console.error(`er: ${err instanceof Error ? err.message : err}`); process.exit(2);
  }
}
