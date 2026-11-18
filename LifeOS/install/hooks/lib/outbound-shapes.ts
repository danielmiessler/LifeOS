/**
 * @version 1.8.1
 * outbound-shapes.ts — the fixed list of Bash shapes that send, publish, deploy,
 * push, or touch secrets. TaintGuard asks about these while a mark stands,
 * except secret operations and unattended or UNKNOWN-state calls, which deny.
 *
 * PURE: no imports, no I/O. Extracted from TaintGuard.hook.ts on 2026-09-05 so
 * the LifeOSHooks function-hook plugin can carry a byte-identical copy (see
 * egress-shapes.ts for why a copy and not an import). TaintGuard re-exports
 * from here; parity is held by skills/LifeOSHooks/tests/parity.test.ts. Edit
 * HERE, then run `bun skills/LifeOSHooks/scripts/SyncCores.ts`.
 *
 * Owned-host resolution deliberately stays OUT of this file (it reads the infra
 * inventory from disk): `outboundClass` takes the caller's answer to "does this
 * command name a host we do not own" as an argument.
 *
 * 1.8.0 (p1b2 S014, S015, S016): every POSIX-family shell's -c body is read (dash, ksh and
 * friends classified nothing); an inline JS body is read for computed subprocess calls and for
 * network sends, which become a request segment judged like curl; an argv array from any
 * interpreter is re-read as shell words, so wrappers peel as they do on the command line; and a
 * network client's destinations are judged even without a scheme, with an unresolved or
 * redirected destination counted as a send to a host we do not own.
 * Review round 1 of the same change: a JS subprocess call is still read the way 1.7.0 read it (its
 * leading literals), so a concatenated `.env` write or secrets call keeps its mandatory denial; a
 * concatenation, a bracket-property call (`cp["spawnSync"](…)`) and an alias of a subprocess
 * function are read or counted unresolved; fetch options are judged by what the object holds, not
 * by how its keys are spelled; a call spelled inside a JS string is not a call; and the wrapper
 * table carries every wrapper the shared shell-commands walker peels (xcrun, rtk, unbuffer, script),
 * held by a parity test because this file cannot import it.
 * Final round: every inline program flag is read (an earlier `--eval=` hid a later `-e`); HEAD's
 * write-flag reading is the floor under the client grammar; a request loaded from a config file or
 * startup command, and a write that follows redirects, count as sends to a host we do not own; in a
 * JS body a literal bracket key reads as dot access, module names are read with escapes decoded, Bun
 * used as a value is unresolved execution, and loading a network module is an unresolved send.
 * Final round 2: a flag in an inline-program flag's value slot (`node -p -e body`) is read as the
 * flag it is, so the body is not lost; and a wrapper never takes a redirection for its own option
 * value or argument (`script > .env` is still an .env write), the redirection riding after the command.
 * Closing pass: an `.env` write is judged at every match, not the first; a wrapper's value slot is also
 * read as the command, as HEAD read it; and the stdin-program test is HEAD's again.
 * 1.8.1: the lexer's work is bounded. A wrapper's value slot read as the command re-lexed the rest of the
 * line under the same wrapper, so a chain of m `sudo -u sudo` pairs produced 2^m segments (65536 at m=16,
 * half a second; seconds at m=20) before the depth cap stopped it at m=33. Identical nested texts are now
 * lexed once per command, and a command that still needs more than NESTED_LIMIT nested lexes throws, which
 * every caller already treats as a refusal. The gmail/gcal rows read each option word one way.
 */

/** Nested lexes one command may need before classification gives up (fail-closed in every caller). A real
 * command line nests a handful: `sh -c`, `xargs`, one inline program. The 2^m chain above hits this at m=8. */
const NESTED_LIMIT = 256;

/** Outbound / irreversible Bash shapes. Order is irrelevant; first match names the class. */
/** Desktop browsers an `open -a` may name; a quoted multi-word name stays one word. */
const BROWSER_APPS = /Google Chrome|Chromium|Brave Browser|Microsoft Edge|Safari|Firefox|Arc|Vivaldi|Opera/;
const BROWSER_APP_WORD = new RegExp(`^(?:${BROWSER_APPS.source})$`);

export const OUTBOUND_SHAPES: ReadonlyArray<[RegExp, string]> = [
  [/(^|[\s;&|])git\s+(?:-C\s+\S+\s+)?push\b/, "git push"],
  [/(^|[\s;&|])(?:bunx\s+)?wrangler(?:@\S+)?\s+(?:deploy|publish|secret|pages\s+deploy|d1\s+execute)\b/, "wrangler deploy/secret"],
  [/(^|[\s;&|])bun\s+run\s+deploy\b/, "bun run deploy"],
  [/(^|[\s;&|])(?:bash\s+)?(?:\S*\/)?deploy\.sh\b/, "deploy.sh"],
  [/CfEnv\.ts\s+deploy\b/, "CfEnv deploy"],
  // cf CLI (replaced Wrangler 2026-09-29): deploys, secret ops, remote D1/KV/R2 writes, and any `cf … delete`.
  // The wrangler row above stays for old transcripts and other repos. CfEnv.ts forwards any cf verb (a leading
  // `cf` is optional) and translates `secret put` to `workers secrets update`.
  [/(^|[\s;&|])(?:bunx\s+)?cf(?:@\S+)?\s+(?:deploy|(?:pages|previews|workers\s+triggers)\s+deploy|builds\s+create|workers\s+(?:secrets|versions\s+create|deployments\s+create)|d1\s+(?:query|raw|import|migrations\s+apply|time-travel\s+restore)|(?:kv\s+(?:keys|bulk)|r2\s+objects)\s+(?:put|delete)|(?:[\w-]+\s+){1,3}(?:delete|bulk-delete))\b/, "cf deploy/secret/write"],
  [/CfEnv\.ts\s+(?:cf\s+)?(?:secret\b|(?:deploy|(?:pages|previews|workers\s+triggers)\s+deploy|builds\s+create|workers\s+(?:secrets|versions\s+create|deployments\s+create)|d1\s+(?:query|raw|import|migrations\s+apply|time-travel\s+restore)|(?:kv\s+(?:keys|bulk)|r2\s+objects)\s+(?:put|delete)|(?:[\w-]+\s+){1,3}(?:delete|bulk-delete))\b)/, "CfEnv deploy/secret/write"],
  [/(^|[\s;&|])gh\s+(?:issue|pr|release|repo|discussion)\s+(?:create|comment|close|edit|merge|delete|reopen|label|transfer)\b/, "gh write"],
  [/(^|[\s;&|])gh\s+api\b[^\n]*(?:-X\s*(?:POST|PUT|PATCH|DELETE)|--method\s+(?:POST|PUT|PATCH|DELETE)|-f\s|-F\s|--input\b)/i, "gh api write"],
  // Skill tools that send or publish, matched by what the tool is called, never by which skill
  // owns it: a shipped list of private skill paths is an inventory (in-family audit, round 10,
  // 7.52.0 cut). Exact private rows ride LIFEOS/USER/SECURITY/outbound-shapes.json (see
  // TaintGuard.hook.ts loadOutboundOverlay).
  // 1.4.0: whole name-words only. A substring match asked on KeynoteMedia, ContextSearch
  // (conTEXT), TextFit, TwitterText, HarvestEmail. A send verb anywhere in the name as its
  // own word, or a channel noun as the whole name (media.ts, email.ts), still matches.
  [/skills\/[A-Za-z0-9_]+\/Tools\/(?:(?:(?:[A-Za-z0-9]*[-_])*(?:post|publish|send|broadcast|reply|upload)|[A-Za-z0-9_-]*(?:Post|Publish|Send|Broadcast|Reply|Upload))(?=[A-Z0-9_.-])[A-Za-z0-9_-]*|(?:thread|article|media|message|email|text|discord|substack)s?)\.ts\b/, "send/publish tool"],
  // The direct-API mail and calendar tools (LIFEOS/TOOLS/gmail.ts, the calendar skill's gcal.ts)
  // replaced gws; the ingest side (untrusted-bash-sources.ts) knew, this side did not.
  // 1.8.1: an option's value never starts with `--`, so each word has one reading (`--n -5` is still an option
  // with its value). The old group let every `--x` word be read as an option or as the previous option's
  // value, and a non-matching command of about 40 such words took seconds (about 1.6x per added word).
  [/\bgmail\.ts\s+(?:--\S+(?:\s+(?!--)\S+)?\s+)*send\b/, "gmail send"],
  [/\bgcal\.ts\s+(?:--\S+(?:\s+(?!--)\S+)?\s+)*(?:create|update|delete)\b/, "calendar write"],
  // 1.5.0: a Sonar lookup (LIFEOS/SONAR/<entry>.ts, run directly) sends a query to an outside vendor, so a
  // marked session asks before each one and an injected instruction cannot drive queries (Sonar ISA A8, ISC-20).
  // Only a file directly under SONAR/ matches, so `bun test ./LIFEOS/SONAR/tests/…` is not a lookup.
  [/\bLIFEOS\/SONAR\/[A-Za-z0-9_.-]+\.ts\b/, "sonar lookup"],
  [/(^|[\s;&|])gws\s+gmail\s+(?:messages\s+)?(?:send|reply|drafts?\s+send)\b/, "gmail send"],
  [/(^|[\s;&|])gws\s+calendar\s+(?:events\s+)?(?:create|insert|update|delete|patch)\b/, "calendar write"],
  [/(^|[\s;&|])(?:ssh|scp|rsync)\s+(?!-i\s+\S+\s+localhost)\S/, "remote shell/copy"],
  [/(^|[\s;&|])stripe\s+(?!listen\b)(?:\S+\s+)*(?:create|update|delete|refund|cancel|pay)\b/, "stripe write"],
  // Any desktop browser, so the rule holds whichever one the install uses.
  [new RegExp(`(^|[\\s;&|])open\\s+-a\\s+"?(?:${BROWSER_APPS.source})(?:"|(?=\\s|$))`), "open in principal's browser"],
  [/LIFEOS\/TOOLS\/Secrets\.ts\s+(?:seal|unseal|export-identity)\b/, "secrets"],
  [/(?:>>?|tee\s+(?:-a\s+)?)\s*["']?[^\s"']*\/?\.env(?:\.[A-Za-z0-9_-]+)?\b/, ".env write"],
];

/**
 * The outbound class of a command, or null. `namesNonOwnedHost` answers whether
 * the command carries a URL whose host we do not own (the caller resolves it).
 */
export function outboundClass(command: string, namesNonOwnedHost: (text: string) => boolean, extra: ReadonlyArray<[RegExp, string]> = []): string | null {
  const classes = outboundSegments(command, namesNonOwnedHost, extra).flatMap(s => s.classes);
  // A compound command cannot hide a deny-kept operation behind an ask.
  return classes.find(c => c === "secrets" || c === ".env write") ?? classes[0] ?? null;
}

/**
 * Every command the shell would execute, in order, with the outbound classes it
 * carries (empty when none). Callers that judge WHERE an outbound action lands
 * need each one's own words, and the plain commands (cd) around them.
 */
export function outboundSegments(command: string, namesNonOwnedHost: (text: string) => boolean, extra: ReadonlyArray<[RegExp, string]> = []): Array<{ words: string[]; classes: string[]; prefix: string[] }> {
  return executionWords(command).map(words => {
    const normalized = shapeText(words);
    const classes: string[] = [];
    for (const [re, name] of [...OUTBOUND_SHAPES, ...extra]) {
      if (matchesExecution(re, name, normalized, words)) classes.push(name);
    }
    const parsed = parsedOutbound(words, namesNonOwnedHost);
    if (parsed) classes.push(parsed);
    return { words, classes, prefix: ((words as string[] & { prefix?: string[] }).prefix ?? []) };
  });
}

/** Preserve word boundaries: a quoted payload cannot become another executable. */
function shapeText(words: string[]): string {
  return words.map(w => ((/\s/.test(w) && !BROWSER_APP_WORD.test(w)) || (/[;|<>]/.test(w) && !/^[<>]+$/.test(w))) ? "__shell_argument__" : w).join(" ");
}

function matchesExecution(re: RegExp, name: string, text: string, words: string[]): boolean {
  re.lastIndex = 0;
  const match = re.exec(text);
  if (!match) return false;
  // Every match is judged, not only the first (closing pass, S015 parity): a wrapper's redirection now
  // rides after the command, so an earlier `tee .env` argument that runs nothing must not hide it.
  if (name === ".env write") return [...text.matchAll(new RegExp(re.source, "g"))].some(m => !/^tee\s/.test(m[0]) || words[0] === "tee");
  if (/deploy\/secret\/write$/.test(name) && /\bd1\s+(?:query|raw)\b/.test(match[0]) && readOnlyD1(words)) return false;
  const script = scriptRunner(words[0]);
  const executableEnd = (words[0]?.length ?? 0) + (script ? 1 + (words[1]?.length ?? 0) : 0);
  return match.index < executableEnd;
}

/** 1.4.0: a D1 query whose literal SQL only reads is not a write. Anything the
 * shell could still expand ($, substitution), a --file, or any write keyword asks. */
function readOnlyD1(words: string[]): boolean {
  if (words.some(w => w === "--file" || w.startsWith("--file="))) return false;
  const i = words.findIndex(w => w === "--sql" || w === "--command");
  const sql = i >= 0 ? words[i + 1] : words.find(w => /^--(?:sql|command)=/.test(w))?.replace(/^--\w+=/, "");
  if (!sql || /[$`]/.test(sql)) return false;
  const statements = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").split(";").map(s => s.trim()).filter(Boolean);
  return statements.length > 0
    && statements.every(s => /^(?:SELECT|EXPLAIN|WITH)\b/i.test(s) || /^PRAGMA\s+[\w.]+(?:\s*\([^)]*\))?$/i.test(s))
    && !/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|VACUUM|REINDEX)\b|\bREPLACE\s+INTO\b/i.test(sql);
}

export function mustDenyOutbound(command: string, shape: string): boolean {
  return shape === "secrets" || shape === ".env write" || executionWords(command).some(words =>
    /^(?:bunx\s+)?wrangler(?:@\S+)?\s+secret\b/.test(shapeText(words))
    || /^(?:bunx\s+)?cf(?:@\S+)?\s+workers\s+secrets\b/.test(shapeText(words))
    || /^(?:bun|node)\s+\S*CfEnv\.ts\s+(?:cf\s+)?(?:secret|workers\s+secrets)\b/.test(shapeText(words)));
}

/** Shells whose -c body is a shell program (1.8.0, p1b2 S014: dash, ksh and their kin were not read). */
const SHELLS = /^(?:bash|sh|zsh|dash|ksh|ksh93|mksh|pdksh|oksh|ash|yash|posh|rbash|fish|csh|tcsh)$/;
/** JavaScript runtimes whose -e/-p body is JavaScript, read for subprocess and network calls. */
const JS_RUNTIMES = /^(?:bun|node|nodejs)$/;
/** A shell or JS runtime: its inline body, stdin program or script path is what runs. */
function scriptRunner(exe: string | undefined): boolean {
  return SHELLS.test(exe ?? "") || JS_RUNTIMES.test(exe ?? "");
}

/**
 * Every inline program a shell (-c) or JS runtime (-e, -p, --eval, --print) is given. All of them are
 * read, not the first: Node runs the last `-e` of several, so reading only the first let an earlier
 * harmless `--eval=` hide the program that runs (final round; HEAD read the `-e` one).
 */
function inlinePrograms(words: string[]): string[] {
  const js = JS_RUNTIMES.test(words[0] ?? "");
  const programs: string[] = [];
  for (let k = 1; k < words.length; k++) {
    const w = words[k]!;
    if (js && /^--(?:eval|print)=/.test(w)) { programs.push(w.slice(w.indexOf("=") + 1)); continue; }
    if (/^-(?:[a-z]*c|e)$/.test(w) || w === "--eval" || (js && (/^-[ep]+$/.test(w) || w === "--print"))) {
      // A flag in the value slot is the next option, not the program: `node -p -e body` runs body, and
      // taking `-e` for -p's program lost it (final round 2; HEAD read the -e one). It is read as a
      // program too (an over-read, never an under-read), and then as the flag it is.
      const value = words[k + 1];
      if (value) programs.push(value);
      if (!value?.startsWith("-")) { k++; continue; }
      // A shell runs the first operand after its options as the -c program (`bash -c -x 'body'`).
      if (!js) {
        for (let j = k + 1; j < words.length; j++) {
          const o = words[j]!;
          if (/^[-+][oO]$/.test(o)) { j++; continue; }
          if (/^[-+]/.test(o)) continue;
          programs.push(o);
          break;
        }
      }
    }
  }
  return programs;
}

/** One argv word as a single-quoted shell word, so re-lexing it yields exactly that word. */
function shellQuote(word: string): string {
  return `'${word.replace(/'/g, `'\\''`)}'`;
}

/** Lex shell commands, retaining data only as individual arguments. Heredoc
 * bodies are programs only for an executing interpreter; substitutions execute
 * even inside double quotes or unquoted heredocs. No shell code is evaluated.
 */
/** Work shared by every nested lex of one command: the texts already lexed and how many lexes ran. */
interface LexBudget { seen: Set<string>; nested: number }

function executionWords(command: string, depth = 0, budget: LexBudget = { seen: new Set(), nested: 0 }): string[][] {
  if (depth > 32) throw new Error("shell nesting exceeds classification limit");
  const result: string[][] = [];
  let words: string[] = [], word = "", quote = "", active = false;
  let pipeInput: string | undefined;
  // Cast, not an annotation: flush() assigns it inside a closure, and an annotated null initializer narrows it to never at the use sites.
  let heredoc = null as { delimiter: string; quoted: boolean; tabs: boolean; owner: string[] } | null;
  const pending: NonNullable<typeof heredoc>[] = [];
  const flush = () => {
    if (!active) return;
    if (heredoc) { heredoc.delimiter = word; pending.push(heredoc); heredoc = null; }
    else words.push(/^[<>]+$/.test(word) ? "__shell_argument__" : word);
    word = ""; active = false;
  };
  // 1.8.1: a text already lexed for this command contributes nothing new (the wrapper value-slot reading
  // reaches the same suffix from several paths), and the count of nested lexes is capped.
  const nested = (text: string) => {
    if (budget.seen.has(text)) return;
    budget.seen.add(text);
    if (++budget.nested > NESTED_LIMIT) throw new Error("shell nesting exceeds classification budget");
    result.push(...executionWords(text, depth + 1, budget));
  };
  const finish = () => {
    flush();
    if (!words.length) return;
    // Command wrappers, package runners and assignment prefixes do not change the
    // executable: peel them to the program that actually runs (1.6.0, LOSIntegrity
    // — `command -p git push`, `npx wrangler deploy`, `bun x …`,
    // `xargs git push` and `nice git push` used to classify as nothing).
    // Every peeled wrapper except a package runner rides in `prefix`, so owned-destination
    // (which clears only inert prefixes) never judges a wrapped outbound call as owned.
    const prefix: string[] = [];
    // 1.7.0: a reserved word that opens or continues a compound
    // command is not the program. `if true; then git push; fi` lexed `then` as the executable and
    // classified nothing; the body is the command. A `for`/`select`/`case` header runs nothing itself
    // (its substitutions were already lexed as their own segments), so the header words are dropped.
    for (;;) {
      const head = words[0] ?? "";
      if (CONTROL_PREFIX.has(head)) { words.shift(); continue; }
      if (head === "function") { words.splice(0, 2); continue; }
      if (CONTROL_HEADER.has(head)) { words.length = 0; break; }
      break;
    }
    for (;;) {
      if (/^[A-Za-z_][\w]*=/.test(words[0] ?? "")) { prefix.push(words.shift()!); continue; }
      if (CONTROL_PREFIX.has(words[0] ?? "")) { words.shift(); continue; }
      if (!peelWrapper(words, prefix, nested)) break;
    }
    if (words.length) {
      if (!words[0]!.endsWith(".ts")) words[0] = words[0]!.split("/").pop()!;
      // Stripped wrappers and assignments ride along, unenumerated, for callers
      // that must know the command runs under a changed environment.
      Object.defineProperty(words, "prefix", { value: prefix });
      result.push(words);
      const exe = words[0];
      if (exe === "eval") nested(words.slice(1).join(" "));
      else if (OTHER_INTERPRETERS.test(exe!)) {
        // 1.7.0: an inline Python, Perl, Ruby or PHP body is read
        // for the calls that start processes; a literal command is classified as its own segment and
        // anything computed becomes an unresolved-execution segment, which TaintGuard asks about.
        const flag = words.findIndex((w, k) => k > 0 && (/^-[A-Za-z]*[ceE]$/.test(w) || w === "-r" || w === "--eval"));
        if (flag >= 0 && words[flag + 1] !== undefined) inspectInterpreterBody(exe!, words[flag + 1]!, nested, result);
        const stdin = words.indexOf("<<<");
        if (stdin >= 0 && words[stdin + 1]) inspectInterpreterBody(exe!, words[stdin + 1]!, nested, result);
        if (pipeInput !== undefined && flag < 0) inspectInterpreterBody(exe!, pipeInput, nested, result);
      }
      else if (scriptRunner(exe)) {
        for (const program of inlinePrograms(words)) {
          // 1.4.0: a JS program is not shell. Lexing it as shell read regex and
          // string literals as commands (a `bun -e` file edit that mentioned
          // `wrangler d1 execute` asked as a deploy). JS runs shell only through
          // subprocess APIs and Bun.$, and sends only through network APIs, so those are inspected.
          if (JS_RUNTIMES.test(exe!)) inspectJsBody(exe!, program, nested, result);
          else nested(program);
        }
        // A program fed on stdin is still lexed as shell, as before 1.8.0 (never fewer segments);
        // a JS runtime's is also read as JS.
        const stdin = words.indexOf("<<<");
        if (stdin >= 0 && words[stdin + 1]) {
          nested(words[stdin + 1]!);
          if (JS_RUNTIMES.test(exe!)) inspectJsBody(exe!, words[stdin + 1]!, nested, result);
        }
        if (pipeInput !== undefined && readsProgramFromStdin(words)) {
          nested(pipeInput);
          if (JS_RUNTIMES.test(exe!)) inspectJsBody(exe!, pipeInput, nested, result);
        }
      }
    } else if (prefix.length && prefix.every(p => /^[A-Za-z_][\w]*=/.test(p))) {
      // 1.3.0: a bare `NAME=value` statement is an empty segment carrying its
      // assignments, so callers that resolve `cd $NAME` can see what NAME holds.
      const assignment: string[] = [];
      Object.defineProperty(assignment, "prefix", { value: prefix });
      result.push(assignment);
    }
    pipeInput = undefined;
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!;
    if (c === "\\" && quote !== "'") {
      const next = command[++i];
      if (next !== undefined && next !== "\n") { word += next; active = true; }
    } else if (quote !== "'" && (c === "`" || (c === "$" && command[i + 1] === "("))) {
      const start = i + (c === "`" ? 1 : 2);
      let j = start, level = 1, innerQuote = "";
      for (; j < command.length; j++) {
        const t = command[j]!;
        if (t === "\\") { j++; continue; }
        if (c === "`") { if (t === "`") break; continue; }
        if (innerQuote) { if (t === innerQuote) innerQuote = ""; continue; }
        if (t === "'" || t === '"') { innerQuote = t; continue; }
        if (t === "(") level++;
        if (t === ")" && --level === 0) break;
      }
      nested(command.slice(start, j));
      word += "${__substitution__}"; active = true; i = j;
    } else if (quote) {
      if (c === quote) quote = ""; else word += c;
    } else if (c === "'" || c === '"') { quote = c; active = true; if (heredoc) heredoc.quoted = true; }
    else if (c === "#" && !active) {
      const end = command.indexOf("\n", i);
      i = end < 0 ? command.length : end - 1;
    } else if (c === "<" && command[i + 1] === "<" && command[i + 2] !== "<") {
      flush(); i++;
      const tabs = command[i + 1] === "-";
      if (tabs) i++;
      heredoc = { delimiter: "", quoted: false, tabs, owner: words };
    } else if (c === "\n") {
      finish();
      for (const doc of pending.splice(0)) {
        let body = "";
        while (i + 1 < command.length) {
          const start = i + 1, end = command.indexOf("\n", start);
          const line = command.slice(start, end < 0 ? command.length : end);
          i = end < 0 ? command.length : end;
          if ((doc.tabs ? line.replace(/^\t+/, "") : line) === doc.delimiter) break;
          body += line + "\n";
        }
        if (OTHER_INTERPRETERS.test(doc.owner[0] ?? "") && !doc.owner.some((w, k) => k > 0 && /^-[A-Za-z]*[ceE]$|^-r$|^--eval$/.test(w))) inspectInterpreterBody(doc.owner[0]!, body, nested, result);
        else if (readsProgramFromStdin(doc.owner)) {
          nested(body);
          if (JS_RUNTIMES.test(doc.owner[0] ?? "")) inspectJsBody(doc.owner[0]!, body, nested, result);
        }
        else if (!doc.quoted) {
          // In an expanding heredoc only substitutions execute, not its prose.
          nested('echo "' + body.replace(/(?<!\\)"/g, '\\"') + '"');
        }
      }
    } else if (/[;&|()]/.test(c)) {
      flush();
      const producer = [...words];
      finish();
      if (c === "|" && command[i + 1] !== "|" && command[i - 1] !== "|") {
        if (producer[0] === "echo") pipeInput = producer.slice(1).join(" ");
        if (producer[0] === "printf") {
          const args = producer.slice(2);
          pipeInput = (producer[1] ?? "").replace(/%s/g, () => args.shift() ?? "").replace(/\\n/g, "\n");
        }
      }
    }
    else if (c === ">" || c === "<") {
      flush();
      let operator = c;
      while (command[i + 1] === c) { operator += c; i++; }
      words.push(operator);
    } else if (/\s/.test(c)) { flush();
    } else { word += c; active = true; }
  }
  finish();
  return result;
}

/**
 * A wrapper runs the command that follows its own options. `arg` lists options
 * that take a separate value; `positional` counts plain arguments the wrapper
 * itself consumes (timeout's duration, script's file); `split` options carry a whole command
 * line as one value; `shell` options carry a shell program, classified as its
 * own segment. A `runner` only picks which binary runs, so it is not recorded as
 * a prefix; every other wrapper is (env -C, sudo -D and xargs change where or
 * with what arguments the command runs, and a prefix keeps it from clearing).
 *
 * This file cannot import hooks/lib/shell-commands.ts (the plugin copy must stay import-free), so
 * this table is held to that walker's wrapper set by a parity test (hooks/tests/p1b2/hooks-lib-2):
 * every form the walker reads as a command, this table must peel to the same command.
 */
interface WrapperSpec { arg?: readonly string[]; positional?: number; split?: readonly string[]; shell?: readonly string[]; runner?: boolean }
const WRAPPERS: Readonly<Record<string, WrapperSpec>> = {
  env: { arg: ["-u", "--unset", "-C", "--chdir", "-P", "-S", "--split-string"], split: ["-S", "--split-string"] },
  sudo: { arg: ["-u", "-g", "--user", "--group", "-h", "--host", "-p", "--prompt", "-C", "--close-from", "-D", "--chdir", "-r", "--role", "-t", "--type", "-U", "--other-user", "-T", "--command-timeout"] },
  doas: { arg: ["-u", "-C"] },
  command: {},
  builtin: {},
  exec: { arg: ["-a"] },
  time: { arg: ["-f", "--format", "-o", "--output"] },
  nice: { arg: ["-n", "--adjustment"] },
  nohup: {},
  setsid: {},
  chronic: {},
  unbuffer: {},
  rtk: {},
  caffeinate: { arg: ["-t", "-w"] },
  timeout: { arg: ["-s", "--signal", "-k", "--kill-after"], positional: 1 },
  gtimeout: { arg: ["-s", "--signal", "-k", "--kill-after"], positional: 1 },
  stdbuf: { arg: ["-i", "-o", "-e", "--input", "--output", "--error"] },
  ionice: { arg: ["-c", "--class", "-n", "--classdata", "-p", "-P", "-u"] },
  arch: { arg: ["-d", "-e"] },
  busybox: {},
  xcrun: { arg: ["--sdk", "-sdk", "--toolchain", "-toolchain"] },
  script: { arg: ["-t", "-T", "-F"], positional: 1 },
  xargs: { arg: ["-I", "-J", "-n", "-L", "-P", "-s", "-E", "-d", "-a", "-R", "-S", "--max-args", "--max-lines", "--max-procs", "--max-chars", "--eof", "--delimiter", "--arg-file", "--replace", "--process-slot-var"] },
  npx: { arg: ["-p", "--package"], shell: ["-c", "--call"], runner: true },
  pnpx: { arg: ["-p", "--package"], shell: ["-c", "--call"], runner: true },
  bunx: { arg: ["-p", "--package"], runner: true },
};
/** Two-word runners: `bun x`, `npm exec`, `pnpm dlx`, `yarn dlx` and the like. */
const RUNNERS: Readonly<Record<string, readonly string[]>> = {
  bun: ["x"], npm: ["exec", "x"], pnpm: ["dlx", "exec"], yarn: ["dlx", "exec"],
};
const RUNNER_SPEC: WrapperSpec = { arg: ["-p", "--package"], shell: ["-c", "--call"], runner: true };

/** Peel one wrapper off `words` in place. Returns false when words[0] is not a wrapper. */
function peelWrapper(words: string[], prefix: string[], nested: (text: string) => void): boolean {
  const head = (words[0] ?? "").split("/").pop() ?? "";
  let spec = Object.prototype.hasOwnProperty.call(WRAPPERS, head) ? WRAPPERS[head] : undefined;
  if (!spec && Object.prototype.hasOwnProperty.call(RUNNERS, head) && RUNNERS[head]!.includes(words[1] ?? "")) { spec = RUNNER_SPEC; words.shift(); }
  if (!spec) return false;
  words.shift();
  if (!spec.runner) prefix.push(head);
  // A redirection belongs to the whole command, never to the wrapper: taking `>` for script's file
  // argument turned `script > .env` into a bare `.env` and lost the write (final round 2). Each one
  // met among the wrapper's own words is set aside with its target and put back after the command.
  const redirects: string[] = [];
  const setAside = () => { while (REDIRECT_OP.test(words[0] ?? "")) redirects.push(...words.splice(0, 2)); };
  setAside();
  while (words.length && words[0]!.startsWith("-")) {
    const option = words.shift()!;
    if (option === "--") break;
    const eq = option.indexOf("=");
    const flag = option.startsWith("--") && eq > 0 ? option.slice(0, eq) : option;
    const takesArg = (spec.arg?.includes(flag) || spec.shell?.includes(flag)) ?? false;
    if (takesArg && flag === option) setAside();
    const value = !takesArg ? undefined : flag !== option ? option.slice(eq + 1) : words.shift();
    // A separate value is also read as the command (closing pass, S015 parity): HEAD did not know that
    // arch -d/-e or xargs -J/-R/-S take a value, so HEAD read the word after the flag as the command. Both readings
    // are kept, the second under the same wrapper so it still rides as a prefix.
    if (value !== undefined && flag === option && !spec.runner && spec.arg?.includes(flag) && !spec.split?.includes(flag) && !value.startsWith("-")) {
      nested([head, value, ...words].map(shellQuote).join(" "));
    }
    if (value !== undefined && spec.split?.includes(flag)) words.unshift(...value.split(/\s+/).filter(Boolean));
    if (value !== undefined && spec.shell?.includes(flag)) nested(value);
    setAside();
  }
  for (let n = 0; n < (spec.positional ?? 0); n++) {
    setAside();
    if (!words.length) break;
    words.shift();
  }
  setAside();
  words.push(...redirects);
  return true;
}

/** A redirection operator the lexer leaves as its own word (`>`, `>>`, `<`, `<<<`); the next word is its target. */
const REDIRECT_OP = /^[<>]+$/;

/** Reserved words that open or continue a compound command; the command after them is what runs. */
const CONTROL_PREFIX: ReadonlySet<string> = new Set(["if", "then", "elif", "else", "while", "until", "do", "!", "{", "}", "fi", "done", "esac", "[[", "]]"]);
/** Compound-command headers whose remaining words are not a command. */
const CONTROL_HEADER: ReadonlySet<string> = new Set(["for", "select", "case"]);
/** Interpreters other than shell and JS whose inline bodies can start processes. */
const OTHER_INTERPRETERS = /^(?:python[\d.]*|pypy[\d.]*|perl[\d.]*|ruby[\d.]*|php[\d.]*)$/;

/** Calls that start a process from Python, Perl, Ruby or PHP; group 1 names the call. */
const INTERPRETER_EXEC_CALL = /(?<![\w$])(?:(?:subprocess|os|pty|commands|sh|Open3|IO|Kernel|Process|asyncio)\s*(?:\.|::)\s*)?(system|popen[234]?|Popen|run|call|check_call|check_output|getoutput|getstatusoutput|spawn[lvpe]*|exec[lv]?p?e?|execvpe|posix_spawnp?|create_subprocess_(?:exec|shell)|capture[23]e?|pipeline\w*|shell_exec|passthru|proc_open|pcntl_exec|syscall|fork)\b\s*(\(|\s)/g;
/** Constructs that run code the scanner cannot see: dynamic evaluation and dynamic import. */
const INTERPRETER_UNRESOLVED = /(?<![\w$.])(?:eval|exec|compile|__import__|getattr|importlib|globals|locals|vars|ctypes|cffi|send|public_send|instance_eval|class_eval|create_function|call_user_func\w*)\b/;
/** Perl, Ruby and PHP shell-out syntax: backticks, qx and %x. */
const SHELL_OUT_SYNTAX = /`|(?<![\w$])(?:qx\s*[^\s\w]|%x\s*[^\s\w])/;

/**
 * The string literals of a Python/Perl/Ruby/PHP argument list or string, or null when anything in
 * it is not a plain literal (a variable, an f-string or interpolation, a call, concatenation).
 */
function literalArgs(text: string): string[] | null {
  const t = text.trim();
  const lit = /^(?:[rRbBuU]{0,2})('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/;
  const out: string[] = [];
  let rest = t;
  if (/^[[(]/.test(rest)) rest = rest.slice(1);
  for (;;) {
    rest = rest.replace(/^[\s,]+/, "");
    if (rest === "" || /^[\])]/.test(rest)) return out.length ? out : null;
    const m = lit.exec(rest);
    if (!m) return null;
    const raw = m[1]!;
    const body = raw.startsWith("'''") || raw.startsWith('"""') ? raw.slice(3, -3) : raw.slice(1, -1);
    // Interpolation in double-quoted Perl/Ruby/PHP strings and `{…}` in a Python f-string are computed.
    if (raw.startsWith('"') && /[$@]\w|#\{|\$\{/.test(body)) return null;
    out.push(body.replace(/\\(["'\\])/g, "$1"));
    rest = rest.slice(rest.indexOf(raw) + raw.length);
    if (/^\s*(?:\+|\.|%|\*|\[)/.test(rest)) return null;
  }
}

/** The text of the first argument list of a call whose name ends at `open` (an opening paren or a space). */
function callArguments(program: string, at: number, open: string): string {
  if (open !== "(") {
    const end = program.slice(at).search(/[;\n]|\bif\b|\bor\b|\band\b/);
    return program.slice(at, end < 0 ? undefined : at + end);
  }
  let depth = 1, quote = "";
  for (let i = at; i < program.length; i++) {
    const c = program[i]!;
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]" || c === "}") && --depth === 0) return program.slice(at, i);
  }
  return program.slice(at);
}

/**
 * Read an inline Python/Perl/Ruby/PHP body for process starts. A literal argument list becomes an
 * argv segment, a literal string a shell segment (an over-read for an argv-only call, never an
 * under-read); anything computed, and any dynamic evaluation, adds one unresolved-execution segment.
 * 1.8.0 (p1b2 S015): an argv list is re-read as quoted shell words, so a wrapper in it (`env`,
 * `nice`, `sudo`, `xcrun`) peels and rides as a prefix exactly as it does on the command line.
 */
function inspectInterpreterBody(exe: string, program: string, nested: (text: string) => void, result: string[][]): void {
  const python = /^(?:python|pypy)/.test(exe);
  let unresolved = INTERPRETER_UNRESOLVED.test(program) || (!python && SHELL_OUT_SYNTAX.test(program));
  for (const match of program.matchAll(INTERPRETER_EXEC_CALL)) {
    if (python && match[2] !== "(") continue;
    const args = callArguments(program, match.index! + match[0].length, match[2]!);
    // Python: the first argument only, since later ones (cwd=, env=, shell=) do not name the program.
    // Perl, Ruby and PHP take a list of words as separate arguments (`system("git", "x")`).
    const first = python ? splitFirstArgument(args) : args;
    const literals = literalArgs(first);
    if (!literals) { unresolved = true; continue; }
    // An argv list is pushed as 1.7.0 pushed it (so nothing it classified is lost) and re-read as
    // quoted shell words, so its wrappers peel.
    if ((!python && literals.length > 1) || /^\s*[[(]/.test(first)) { result.push(literals); nested(literals.map(shellQuote).join(" ")); }
    else for (const l of literals) nested(l);
  }
  if (unresolved) result.push([UNRESOLVED_EXECUTION, exe]);
}

/** child_process and Bun process starters. */
const JS_EXEC_NAMES = "execSync|exec|execFileSync|execFile|spawnSync|spawn|fork";
/**
 * A call to one of them, by dot (`cp.spawnSync(`, `Bun?.spawn(`), bare name, or bracket property with a
 * literal key (`cp["spawnSync"](`, `Bun["spawn"](`), optional call included. Groups: 1/3 Bun, 2/5 the name.
 */
const JS_EXEC_CALL = new RegExp(
  `(?<!\\w)(?:(Bun)\\s*\\??\\.\\s*)?(${JS_EXEC_NAMES})\\s*(?:\\?\\.)?\\s*\\(`
  + `|(?:(Bun)\\s*(?:\\?\\.)?\\s*)?\\[\\s*(["'\`])(${JS_EXEC_NAMES})\\4\\s*\\]\\s*(?:\\?\\.)?\\s*\\(`, "g");
/** Every mention of a process-starter name, call or not. */
const JS_EXEC_NAME = new RegExp(`(?<!\\w)(?:${JS_EXEC_NAMES})(?![\\w$])`, "g");
/** A bracket-property call; its key must be a literal starter name where child_process is loaded. */
const JS_BRACKET_CALL = /\[([^\]]*)\]\s*(?:\?\.)?\s*\(/g;
/** References to Bun's process starters and shell, and any bracket access on Bun. */
const BUN_REF = /(?<![\w$])Bun\s*(?:\?\.)?\s*(?:\.\s*(?:spawnSync|spawn|\$)(?![\w$])|\[)/g;
/** A Bun shell template, bare `$` or `Bun.$`; group 1 is its text. */
const BUN_SHELL = /(?:\bBun\.|(?<![\w$.]))\$`((?:\\.|[^`\\])*)`/g;
/** JS that runs code the scanner cannot see: dynamic require/import/builtin loads, eval, Function,
 * code strings handed to vm or a worker, native bindings, and computed member access on the globals
 * that reach a loader. Read on the code view, so a mention inside a string literal does not count. */
const JS_UNRESOLVED = /(?<![\w$.])(?:eval|Function)\s*\(|\bnew\s+Function\b|(?<![\w$])(?:require|getBuiltinModule)\s*\(\s*(?!["'`][^"'`$]*["'`]\s*\))|(?<![\w$.])import\s*\(\s*(?!["'`][^"'`$]*["'`]\s*\))|\bprocess\s*\.\s*(?:binding|dlopen)\b|\bcreateRequire\b|\brunIn(?:New|This)?Context\b|\bcompileFunction\b|\bnew\s+(?:[\w$]+\s*\.\s*)?(?:Script|Worker|SourceTextModule)\b|\bset(?:Timeout|Interval|Immediate)\s*\(\s*["'`]|(?<![\w$.])(?:globalThis|global|self|window|process|module|require|Bun)\s*(?:\?\.)?\s*\[\s*(?!["'`][\w$ ]*["'`]\s*\])/;
/** JS network APIs whose destination and payload the scanner does not resolve. Read on the code view. */
const JS_NETWORK = /\bnew\s+(?:WebSocket|XMLHttpRequest|EventSource)\b|\bsendBeacon\s*\(|\.\s*(?:request|connect|createConnection|udpSocket|createSocket)\s*\(/;
/** A fetch call or a Request built with options; read on the code view. */
const JS_FETCH_CALL = /(?<![\w$])fetch\s*(?:\?\.)?\s*\(|\bnew\s+Request\s*\(/g;
/** Every mention of fetch, call or not (an alias sends where the scanner cannot see). */
const JS_FETCH_NAME = /(?<![\w$])fetch(?![\w$])/g;
/** Fetch option keys that do not send a body or change the method or the route. */
const FETCH_READ_ONLY_KEYS: ReadonlySet<string> = new Set(["headers", "signal", "redirect", "cache", "credentials", "mode", "referrer", "referrerPolicy", "integrity", "priority", "keepalive", "window", "verbose", "timeout", "decompress"]);
/** The placeholder a computed part of a JS string becomes; shell lexing keeps it a computed word. */
const COMPUTED = "${__substitution__}";
/** A whole JS string literal at the start of a text. */
const JS_LITERAL = /^(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/;
/** Every JS string literal in a text. */
const JS_LITERAL_ANY = /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;

/** The value of one JS string literal token; a template's interpolations become COMPUTED. */
function literalBody(raw: string): { body: string; computed: boolean } {
  let body = raw.slice(1, -1);
  let computed = false;
  if (raw.startsWith("`")) body = body.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, () => { computed = true; return COMPUTED; });
  return { body: body.replace(/\\([\\"'`])/g, "$1"), computed };
}

/** A literal token's text with only its quotes and escapes removed (how 1.7.0 read it). */
function unquoteLiteral(raw: string): string {
  return raw.slice(1, -1).replace(/\\([\\"'`])/g, "$1");
}

/** Index of the bracket that closes the one at `open`, skipping strings, or -1. */
function closingIndex(text: string, open: number): number {
  let depth = 0, quote = "";
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]" || c === "}") && --depth === 0) return i;
  }
  return -1;
}

/** `text` split on `sep` where it stands outside brackets and strings. */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = "", start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === sep && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

/**
 * A JS expression built from string literals with `+`: its value with each non-literal operand as
 * COMPUTED, or null when no operand is a literal (a bare variable or call names nothing).
 */
function jsExpression(expr: string): { value: string; computed: boolean } | null {
  let value = "", computed = false, literal = false;
  for (const part of splitTopLevel(expr, "+").map(p => p.trim())) {
    const m = JS_LITERAL.exec(part);
    if (m && m[1]!.length === part.length) {
      const l = literalBody(m[1]!);
      value += l.body; computed ||= l.computed; literal = true;
    } else { value += COMPUTED; computed = true; }
  }
  return literal ? { value, computed } : null;
}

/** The string values of a JS argument (one expression, or an array of them), or null when it holds no literal. */
function jsArgument(text: string): { values: string[]; computed: boolean } | null {
  const t = text.trim();
  if (!t.startsWith("[")) {
    const v = jsExpression(t);
    return v ? { values: [v.value], computed: v.computed } : null;
  }
  const close = closingIndex(t, 0);
  if (close < 0) return null;
  let computed = t.slice(close + 1).trim() !== "";
  const values: string[] = [];
  for (const element of splitTopLevel(t.slice(1, close), ",").map(e => e.trim()).filter(Boolean)) {
    const v = element.startsWith("...") ? null : jsExpression(element);
    if (v) { values.push(v.value); computed ||= v.computed; } else { values.push(COMPUTED); computed = true; }
  }
  return values.length ? { values, computed } : null;
}

/** The literals 1.7.0 read from an argument: the one it starts with, or every literal of the array it starts with. */
function leadingLiterals(text: string): string[] {
  const t = text.trim();
  if (t.startsWith("[")) {
    const end = t.indexOf("]");
    return [...t.slice(0, end < 0 ? undefined : end + 1).matchAll(JS_LITERAL_ANY)].map(m => unquoteLiteral(m[0]));
  }
  const m = JS_LITERAL.exec(t);
  return m ? [unquoteLiteral(m[1]!)] : [];
}

/**
 * The code view of a JS program: string and template text and comments blanked to spaces (same
 * length, so an index into it is an index into the program), template substitutions kept as code.
 * A call spelled inside a string is then not a call. JS tokenizing is ambiguous only at a `/` that
 * might start a regex literal, so a program with a `/` outside strings and comments, or with a string
 * left open, is returned unchanged: read whole, as before, rather than risk blanking real code.
 */
function jsCodeView(program: string): string {
  const out = program.split("");
  const blank = (a: number, b: number) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };
  /** Open contexts: a template, or a substitution with its own brace depth. */
  const stack: Array<{ template: true } | { braces: number }> = [];
  for (let i = 0; i < program.length;) {
    const c = program[i]!;
    const top = stack[stack.length - 1];
    if (top && "template" in top) {
      if (c === "\\") { blank(i, i + 2); i += 2; continue; }
      if (c === "`") { stack.pop(); i++; continue; }
      if (c === "$" && program[i + 1] === "{") { stack.push({ braces: 0 }); i += 2; continue; }
      blank(i, i + 1); i++; continue;
    }
    if (c === "`") { stack.push({ template: true }); i++; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < program.length && program[j] !== c && program[j] !== "\n") j += program[j] === "\\" ? 2 : 1;
      if (j >= program.length || program[j] !== c) return program;
      blank(i + 1, j); i = j + 1; continue;
    }
    if (c === "/" && program[i + 1] === "/") {
      const end = program.indexOf("\n", i);
      const stop = end < 0 ? program.length : end;
      blank(i, stop); i = stop; continue;
    }
    if (c === "/" && program[i + 1] === "*") {
      const end = program.indexOf("*/", i + 2);
      if (end < 0) return program;
      blank(i, end + 2); i = end + 2; continue;
    }
    if (c === "/") return program;
    if (top && "braces" in top) {
      if (c === "{") top.braces++;
      else if (c === "}") { if (top.braces === 0) stack.pop(); else top.braces--; }
    }
    i++;
  }
  return stack.length ? program : out.join("");
}

/** True when a fetch/Request options argument sends: anything but an object literal of read-only keys and a GET-like method. */
function fetchOptionsSend(options: string): boolean {
  const t = options.trim();
  if (t === "") return false;
  if (!t.startsWith("{")) return true;
  const close = closingIndex(t, 0);
  if (close < 0 || t.slice(close + 1).trim() !== "") return true;
  for (const property of splitTopLevel(t.slice(1, close), ",").map(p => p.trim()).filter(Boolean)) {
    const m = /^(?:([A-Za-z_$][\w$]*)|"([^"\\]*)"|'([^'\\]*)'|`([^`\\$]*)`)\s*(?::([\s\S]*))?$/.exec(property);
    if (!m) return true; // a spread, a computed key, a method or a getter
    const key = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    if (key === "method") {
      if (m[5] === undefined) return true;
      const value = m[5].trim();
      const literal = JS_LITERAL.exec(value);
      if (!literal || literal[1]!.length !== value.length) return true;
      const method = literalBody(literal[1]!);
      if (method.computed || !/^(?:GET|HEAD|OPTIONS)$/i.test(method.body)) return true;
      continue;
    }
    if (!FETCH_READ_ONLY_KEYS.has(key)) return true;
  }
  return false;
}

/**
 * Read an inline JS body (1.8.0, p1b2 S014). A subprocess call is read twice: as 1.7.0 read it (the
 * literals its argument starts with), so nothing it classified is lost, and by value, a `+`
 * concatenation or template folded with its computed parts marked. A computed argument, a starter
 * referenced anywhere but a call (an alias, `.call`, a renamed binding), a computed bracket call, or
 * child_process loaded with no call the scanner can read adds an unresolved-execution segment where
 * child_process is loaded or Bun is the caller. A fetch or Request that sends (a body, a write method,
 * or any option that is not read-only) becomes a request segment judged by parsedOutbound like
 * `curl -X POST <url>`; any other socket or request API, or fetch used other than as a call, adds an
 * unresolved-network segment. Network calls are read on the code view, so one spelled inside a string
 * is not a call.
 */
function inspectJsBody(exe: string, source: string, nested: (text: string) => void, result: string[][]): void {
  // Final round: `x["name"]` is `x.name`, so every check below reads one spelling (`globalThis["fetch"](…)`
  // sent while `globalThis.fetch(…)` was judged), and module names are read with their escapes decoded
  // (`require("child_process")` is child_process).
  const program = dotLiteralKeys(source);
  const code = jsCodeView(program);
  const decoded = decodeJsEscapes(program);
  let unresolved = JS_UNRESOLVED.test(code) || JS_BUN_VALUE.test(code);
  const childProcess = /(["'`])(?:node:)?child_process\1/.test(decoded);
  // Loads are found on the code view (a load spelled inside a string is not a load), names read from the program and decoded.
  const networkModule = [...code.matchAll(JS_MODULE_LOAD)].some(m => {
    const at = m.index! + m[0].length - m[2]!.length - 2;
    return JS_NETWORK_MODULE.test(decodeJsEscapes(program.slice(at + 1, m.index! + m[0].length - 1)));
  });
  /** Shell text the call runs; a program word the shell would expand is a computed program. */
  const shellText = (text: string) => {
    const before = result.length;
    nested(text);
    if (result.slice(before).some(w => /[$`]/.test(w[0] ?? ""))) unresolved = true;
  };
  /** A call's first argument and the second one when it is an array. */
  const callParts = (text: string, match: RegExpMatchArray) => {
    const args = callArguments(text, match.index! + match[0].length, "(");
    const first = splitFirstArgument(args);
    const rest = args.slice(first.length).replace(/^\s*,/, "").trim();
    return { first, second: splitFirstArgument(rest).trim() };
  };
  // The 1.7.0 reading, kept as a floor and applied exactly as 1.7.0 applied it, on the text as written:
  // the first literal of a shell call is lexed as shell, an argv call's literals are pushed as one
  // segment as they stand. A literal is always read (an over-read for a regex `.exec("…")`).
  for (const match of source.matchAll(JS_EXEC_CALL)) {
    const name = (match[2] ?? match[5])!;
    const { first, second } = callParts(source, match);
    const floor = [...leadingLiterals(first), ...(second.startsWith("[") ? leadingLiterals(second) : [])];
    if ((name === "exec" || name === "execSync") && floor[0] !== undefined) shellText(floor[0]);
    else if (name !== "exec" && name !== "execSync" && floor.length) result.push(floor);
  }
  const calls = [...program.matchAll(JS_EXEC_CALL)];
  for (const match of calls) {
    const bun = Boolean(match[1] ?? match[3]);
    const name = (match[2] ?? match[5])!;
    const shell = name === "exec" || name === "execSync";
    const context = bun || childProcess;
    const { first, second } = callParts(program, match);
    // The reading by value. A computed argument counts as a computed program only where child_process
    // is loaded or the call is Bun's own: a regex `.exec(text)` elsewhere is not a subprocess.
    const value = jsArgument(first);
    if (!value) { if (context) unresolved = true; continue; }
    if (value.computed && context) unresolved = true;
    if (shell) { shellText(value.values[0]!); continue; }
    const argv = [...value.values];
    if (!first.trim().startsWith("[")) {
      if (second.startsWith("[")) {
        const more = jsArgument(second);
        if (more) { argv.push(...more.values); if (more.computed && context) unresolved = true; } else unresolved = true;
      } else if (second !== "" && !second.startsWith("{")) unresolved = true;
      // A program string with spaces runs through a shell under `shell: true`: read it as shell too.
      if (/\s/.test(value.values[0]!)) shellText(value.values[0]!);
    }
    shellText(argv.map(shellQuote).join(" "));
  }
  if (childProcess) {
    // Loaded, but used where the scanner cannot follow: no readable call, a starter referenced other
    // than as a call or a same-name binding, or a bracket call whose key is not a literal starter name.
    if (calls.length === 0) unresolved = true;
    for (const m of program.matchAll(JS_EXEC_NAME)) {
      const after = program.slice(m.index! + m[0].length);
      if (/^["'`]?\s*\]?\s*(?:\?\.)?\s*\(/.test(after)) continue;
      if (/^\s*[,}]/.test(after) && !/:\s*$/.test(program.slice(0, m.index!))) continue;
      unresolved = true;
    }
    for (const m of program.matchAll(JS_BRACKET_CALL)) {
      if (!new RegExp(`^\\s*(["'\`])(?:${JS_EXEC_NAMES})\\1\\s*$`).test(m[1]!)) unresolved = true;
    }
  }
  const bunShell = [...program.matchAll(BUN_SHELL)];
  for (const match of bunShell) shellText(match[1]!);
  // Bun's starters and shell referenced other than as a readable call or template (an alias, a bracket key).
  const bunCovered = calls.filter(m => m[1] ?? m[3]).length + bunShell.filter(m => m[0].startsWith("Bun")).length;
  if ((program.match(BUN_REF) ?? []).length > bunCovered) unresolved = true;
  const fetches = [...code.matchAll(JS_FETCH_CALL)];
  for (const match of fetches) {
    const args = callArguments(program, match.index! + match[0].length, "(");
    const first = splitFirstArgument(args);
    const options = splitFirstArgument(args.slice(first.length).replace(/^\s*,/, ""));
    if (!fetchOptionsSend(options)) continue;
    const url = jsArgument(first);
    result.push(["curl", "-X", "POST", url && url.values.length === 1 && !url.computed && !first.trim().startsWith("[") ? url.values[0]! : "${__unresolved_destination__}"]);
  }
  const fetchCalls = fetches.filter(m => /fetch/.test(m[0])).length;
  if (networkModule || JS_NETWORK.test(code) || (code.match(JS_FETCH_NAME) ?? []).length > fetchCalls) result.push([UNRESOLVED_NETWORK, exe]);
  if (unresolved) result.push([UNRESOLVED_EXECUTION, exe]);
}

/** Bun itself used as a value (destructured, aliased, passed): its starters then run under names the scanner cannot see. */
const JS_BUN_VALUE = /(?<![\w$])(?<!\btypeof\s+)Bun(?![\w$])(?!\s*(?:\?\.|\.|\[))/;
/** A module loaded by a literal name (require, import, getBuiltinModule, `from`); group 2 is the name. */
const JS_MODULE_LOAD = /(?:\b(?:require|getBuiltinModule|import)\s*\(\s*|\bfrom\s*|\bimport\s+)(["'`])([^"'`\n]*)\1/g;
/** Modules that open sockets or send requests: loading one counts as a send whose destination the scanner does not resolve. */
const JS_NETWORK_MODULE = /^(?:node:)?(?:https?|http2|net|tls|dgram|dns(?:\/promises)?|undici|ws|node-fetch|axios|got|socket\.io-client)$/;
/** Words after which `[` opens an array literal, not a property access. */
const JS_KEYWORDS: ReadonlySet<string> = new Set(["return", "typeof", "case", "in", "of", "yield", "await", "void", "delete", "throw", "new", "else", "do", "instanceof"]);

/** `x["name"]` and `x?.["name"]` rewritten as `x.name` and `x?.name` where the brackets are code and the key is an identifier. */
function dotLiteralKeys(program: string): string {
  const code = jsCodeView(program);
  let out = "", last = 0;
  for (const m of code.matchAll(/\[\s*(["'`])[^\]]*?\1\s*\]/g)) {
    const start = m.index!, end = start + m[0].length;
    const key = /^\[\s*(["'`])([A-Za-z_$][\w$]*)\1\s*\]$/.exec(program.slice(start, end));
    if (!key) continue;
    const before = code.slice(0, start).trimEnd();
    const word = /[\w$]+$/.exec(before)?.[0];
    if (!/(?:[\w$)\]]|\?\.)$/.test(before) || (word !== undefined && JS_KEYWORDS.has(word))) continue;
    out += program.slice(last, start) + (before.endsWith("?.") ? "" : ".") + key[2];
    last = end;
  }
  return out + program.slice(last);
}

/** JS string escapes decoded (\u{…}, \uXXXX, \xXX, legacy octal, and an escaped plain character), for reading module names only. */
function decodeJsEscapes(text: string): string {
  return text.replace(/\\(?:u\{([0-9A-Fa-f]{1,6})\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|([0-7]{1,3})|([\s\S]))/g, (_m, braced?: string, u?: string, x?: string, octal?: string, plain?: string) => {
    if (plain !== undefined) return plain;
    const point = parseInt(braced ?? u ?? x ?? octal!, braced ?? u ?? x ? 16 : 8);
    return point <= 0x10ffff ? String.fromCodePoint(point) : "";
  });
}

/** The first top-level argument of an argument list (up to its first comma outside brackets and quotes). */
function splitFirstArgument(args: string): string {
  return splitTopLevel(args, ",")[0]!;
}

/** Program word of the segment an interpreter body adds when it starts a process the scanner cannot resolve. */
const UNRESOLVED_EXECUTION = "__unresolved_interpreter_execution__";
/** Program word of the segment a JS body adds when it opens a socket or request the scanner cannot resolve. */
const UNRESOLVED_NETWORK = "__unresolved_interpreter_network__";

function readsProgramFromStdin(words: string[]): boolean {
  if (!scriptRunner(words[0])) return false;
  const args = words.slice(1);
  // HEAD's test, unchanged (closing pass, S014 parity): counting `--print=`/`--eval=` programs here
  // dropped the stdin program HEAD read (an over-read kept, never an under-read).
  if (args.some(w => /^-[a-z]*c$/.test(w) || w === "-e" || w === "--eval")) return false;
  return args.length === 0 || args[0] === "-" || args.includes("-s") || args.every(w => w.startsWith("-"));
}

/**
 * Per network client: short options that always take a value, long options that take one, and the
 * options that send the request somewhere other than the destinations the command names (a proxy, a
 * resolve override, a config or input file). A value is never read as a destination; an option the
 * lists do not know is treated as bare, so its value is judged as a destination (an over-read).
 */
interface ClientGrammar { shortValue: string; shortRedirect: string; longValue: ReadonlySet<string>; longRedirect: ReadonlySet<string> }
const CLIENT_GRAMMAR: Readonly<Record<string, ClientGrammar>> = {
  curl: {
    shortValue: "dFTXouHAbeUxwmKcErYyzCDQt",
    shortRedirect: "xK",
    longValue: new Set(["data", "data-binary", "data-raw", "data-urlencode", "data-ascii", "form", "form-string", "upload-file", "json", "request", "header", "user-agent", "output", "user", "referer", "cookie", "cookie-jar", "cert", "key", "cacert", "capath", "write-out", "max-time", "connect-timeout", "retry", "retry-delay", "retry-max-time", "range", "dump-header", "oauth2-bearer", "limit-rate", "interface", "proto", "proto-redir", "url-query", "variable", "trace", "trace-ascii", "stderr", "max-filesize", "speed-limit", "speed-time", "time-cond", "continue-at", "quote", "telnet-option", "output-dir", "aws-sigv4", "keepalive-time", "local-port", "ciphers", "pass", "pinnedpubkey", "cert-type", "key-type", "request-target", "mail-from", "mail-rcpt", "mail-auth", "proxy-user", "proxy-header", "tls-max", "expect100-timeout", "happy-eyeballs-timeout-ms", "netrc-file", "create-file-mode"]),
    longRedirect: new Set(["proxy", "preproxy", "socks4", "socks4a", "socks5", "socks5-hostname", "resolve", "connect-to", "unix-socket", "abstract-unix-socket", "doh-url", "config"]),
  },
  wget: {
    shortValue: "OoaeiBtTwQPUY",
    shortRedirect: "ieB",
    longValue: new Set(["post-data", "post-file", "body-data", "body-file", "method", "header", "output-document", "output-file", "append-output", "user", "password", "http-user", "http-password", "user-agent", "referer", "tries", "timeout", "wait", "directory-prefix", "load-cookies", "save-cookies", "ca-certificate", "certificate", "private-key", "limit-rate", "quota", "bind-address", "accept", "reject", "domains", "level", "dns-timeout", "connect-timeout", "read-timeout", "waitretry", "progress", "max-redirect"]),
    longRedirect: new Set(["input-file", "base", "execute", "config", "proxy", "use-askpass"]),
  },
  xh: {
    shortValue: "aAo",
    shortRedirect: "",
    longValue: new Set(["auth", "auth-type", "output", "bearer", "verify", "cert", "cert-key", "timeout", "max-redirects", "ssl", "http-version", "interface", "session", "session-read-only", "format-options", "style", "pretty", "print", "response-charset", "response-mime", "default-scheme"]),
    longRedirect: new Set(["proxy", "resolve", "unix-socket"]),
  },
  gh: { shortValue: "ouHAbeUxtwmX", shortRedirect: "", longValue: new Set(["request", "method"]), longRedirect: new Set() },
};
/** A destination word with no scheme: a host (name, IPv4 or bracketed IPv6), an optional port and path. */
const HOST_LIKE = /^(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?)(?::\d*)?(?:[/?#][\s\S]*)?$/;
const SEND_TO_FOREIGN_HOST = "POST to a host we don't own";

/** A destination word resolves to a host we own: literal, host-shaped, and owned under any scheme. */
function destinationOwned(word: string, namesNonOwnedHost: (text: string) => boolean): boolean {
  if (/[$`]/.test(word)) return false;
  const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([\s\S]*)$/.exec(word);
  if (!scheme && !HOST_LIKE.test(word)) return false;
  return !namesNonOwnedHost(`https://${scheme ? scheme[1] : word}`);
}

function parsedOutbound(words: string[], namesNonOwnedHost: (text: string) => boolean): string | null {
  // Only executable position is inspected; arguments remain data.
  const exe = words[0]?.split("/").pop();
  const args = words.slice(1);
  if (exe === UNRESOLVED_EXECUTION) return "unresolved interpreter execution";
  if (exe === UNRESOLVED_NETWORK) return "unresolved interpreter network send";
  if (["nc", "ncat", "netcat", "socat", "telnet", "ftp", "sftp"].includes(exe ?? "")) return "network transport";
  if (exe === "openssl" && args[0] === "s_client") return "network transport";
  if (exe === "git") {
    let j = 0;
    while (j < args.length && args[j]!.startsWith("-")) {
      const arg = args[j++]!;
      if (["-c", "-C", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix", "--exec-path"].includes(arg)) j++;
      if (arg === "--") break;
    }
    if (args[j] === "push") return "git push";
  }
  // Network clients also support attached values and combined short options.
  if (!exe || !Object.prototype.hasOwnProperty.call(CLIENT_GRAMMAR, exe)) return null;
  const grammar = CLIENT_GRAMMAR[exe]!;
  // HEAD's reading is the floor: a write flag it saw stays a write even where the grammar takes that word
  // for an option's value (`curl --output --data <url>` asked before the grammar existed; final round).
  let writes = legacyWrites(exe, args), redirected = false, loadsRequest = false, options = true;
  // wget follows redirects unless told not to; curl and xh only when asked.
  let follows = exe === "wget";
  const positional: string[] = [];
  for (let j = 0; j < args.length; j++) {
    const arg = args[j]!;
    if (!options || arg === "-" || !arg.startsWith("-")) { positional.push(arg); continue; }
    if (arg === "--") { options = false; continue; }
    const [flag, attached] = arg.split(/=(.*)/s);
    if (arg.startsWith("--")) {
      const name = flag!.slice(2);
      if (/^--(?:data(?:-binary|-raw|-urlencode|-ascii)?|form(?:-string)?|upload-file|json|post-data|post-file|body-data|body-file|input|field|raw-field)$/.test(flag!)) writes = true;
      if (["--request", "--method"].includes(flag!) && /^(POST|PUT|PATCH|DELETE)$/i.test(attached ?? args[j + 1] ?? "")) writes = true;
      if (grammar.longRedirect.has(name)) redirected = true;
      if (LOADS_REQUEST[exe]!.long.includes(name)) loadsRequest = true;
      if (FOLLOWS_REDIRECTS[exe]!.long.includes(name)) follows = true;
      if (exe === "wget" && name === "max-redirect") follows = (attached ?? args[j + 1] ?? "") !== "0";
      if (name === "url" && exe === "curl") { const v = attached ?? args[++j]; if (v !== undefined) positional.push(v); continue; }
      if (attached === undefined && (grammar.longValue.has(name) || grammar.longRedirect.has(name))) j++;
      continue;
    }
    for (let k = 1; k < arg.length; k++) {
      const option = arg[k]!;
      if ((exe === "gh" ? "fF" : "dFT").includes(option)) writes = true;
      if (option === "X" && /^(POST|PUT|PATCH|DELETE)$/i.test(arg.slice(k + 1) || args[j + 1] || "")) writes = true;
      if (grammar.shortRedirect.includes(option)) redirected = true;
      if (LOADS_REQUEST[exe]!.short.includes(option)) loadsRequest = true;
      if (FOLLOWS_REDIRECTS[exe]!.short.includes(option)) follows = true;
      // These options consume the remainder or next argument, so its
      // characters cannot be interpreted as more short flags.
      if (grammar.shortValue.includes(option)) { if (k === arg.length - 1) j++; break; }
    }
  }
  let destinations = positional;
  if (exe === "xh") {
    // xh [METHOD] URL [ITEM...]: a data item (`k=v`, `k:=json`, `k@file`) sends a body.
    const m = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(positional[0] ?? "") ? 1 : 0;
    if (m && /^(POST|PUT|PATCH|DELETE)$/i.test(positional[0]!)) writes = true;
    if (positional.slice(m + 1).some(item => /^[^=:@\s]*(?::=@?|=@?(?!=)|@)/.test(item))) writes = true;
    destinations = positional.slice(m, m + 1);
  }
  if (writes && exe === "gh" && args[0] === "api") return "gh api write";
  if (exe === "gh") return null;
  // A request read from a config file or a startup command can carry a body and a URL the line never shows.
  if (loadsRequest) return SEND_TO_FOREIGN_HOST;
  if (!writes) return null;
  if (namesNonOwnedHost(words.join(" "))) return SEND_TO_FOREIGN_HOST;
  // A destination the command does not name literally, a request sent through somewhere else, or a write
  // that follows redirects (a 307/308 resends the body to wherever the server says) is not ours.
  if (redirected || follows || destinations.length === 0) return SEND_TO_FOREIGN_HOST;
  return destinations.every(d => destinationOwned(d, namesNonOwnedHost)) ? null : SEND_TO_FOREIGN_HOST;
}

/** Options that load a request (body, method, URL) from somewhere the line does not show. */
const LOADS_REQUEST: Readonly<Record<string, { short: string; long: readonly string[] }>> = {
  curl: { short: "K", long: ["config"] },
  wget: { short: "e", long: ["config", "execute"] },
  xh: { short: "", long: [] },
  gh: { short: "", long: [] },
};
/** Options that make a client follow redirects (wget follows by default; `--max-redirect=0` stops it). */
const FOLLOWS_REDIRECTS: Readonly<Record<string, { short: string; long: readonly string[] }>> = {
  curl: { short: "L", long: ["location", "location-trusted"] },
  wget: { short: "", long: [] },
  xh: { short: "F", long: ["follow"] },
  gh: { short: "", long: [] },
};

/** HEAD's (1.7.0) write reading, verbatim: every flag it took for a write still counts as one. */
function legacyWrites(exe: string, args: string[]): boolean {
  let writes = false;
  for (let j = 0; j < args.length; j++) {
    const arg = args[j]!;
    if (arg === "--") break;
    const [flag, attached] = arg.split(/=(.*)/s);
    if (/^--(?:data(?:-binary|-raw|-urlencode|-ascii)?|form(?:-string)?|upload-file|json|post-data|post-file|body-data|body-file|input|field|raw-field)$/.test(flag!)) writes = true;
    if (["--request", "--method"].includes(flag!) && /^(POST|PUT|PATCH|DELETE)$/i.test(attached ?? args[++j] ?? "")) writes = true;
    if (/^-[^-]/.test(arg)) {
      for (let k = 1; k < arg.length; k++) {
        const option = arg[k]!;
        if ((exe === "gh" ? "fF" : "dFT").includes(option)) { writes = true; break; }
        if (option === "X") {
          if (/^(POST|PUT|PATCH|DELETE)$/i.test(arg.slice(k + 1) || args[++j] || "")) writes = true;
          break;
        }
        if ("ouHAbeUxtwm".includes(option)) { if (k === arg.length - 1) j++; break; }
      }
    }
    if (exe === "xh" && /^(POST|PUT|PATCH|DELETE)$/i.test(arg)) writes = true;
  }
  return writes;
}
