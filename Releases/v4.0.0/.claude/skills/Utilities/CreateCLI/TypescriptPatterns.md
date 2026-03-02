# TypeScript Patterns for CLI Development

**Production patterns from tsx, vite, turbo, bun, and other modern TypeScript CLIs**

---

## 🎯 Overview

This document captures type safety patterns, modern TypeScript features, and error handling strategies from real-world production CLIs.

**Research Sources:**
- tsx (privatenumber/tsx)
- Vite (vitejs/vite)
- Next.js (vercel/next)
- Turbo (vercel/turbo)
- Bun installer (oven-sh/bun)
- pnpm (pnpm/pnpm)
- Shopify CLI (Shopify/cli)

---

## 1️⃣ TYPE-SAFE ARGUMENT PARSING

### Pattern 1: Schema-Driven Inference (cleye library - used by tsx)

```typescript
import { cli } from 'cleye';

const argv = cli({
  name: 'tsx',
  flags: {
    noCache: {
      type: Boolean,
      description: 'Disable cache',
      default: false,
    },
    tsconfig: {
      type: String,
      description: 'Path to tsconfig.json',
    },
  },
  parameters: ['<script path>'],
});

// TypeScript infers:
// argv.flags.noCache → boolean
// argv.flags.tsconfig → string | undefined
// argv._.scriptPath → string | undefined
```

**Key Insight:** Flags defined as `const` objects enable full type inference.

---

### Pattern 2: Manual Type Annotations (Vite - cac library)

```typescript
interface GlobalCLIOptions {
  '--'?: string[];
  debug?: boolean | string;
  filter?: string;
  config?: string;
}

interface ServerOptions extends GlobalCLIOptions {
  host?: string;
  port?: number;
  open?: boolean | string;
  cors?: boolean;
  strictPort?: boolean;
}

cli
  .command('[root]', 'start dev server')
  .option('--host <host>', 'specify hostname')
  .option('--port <port>', 'specify port', { type: [Number] })
  .option('--open [path]', 'open browser on startup')
  .action(async (root: string, options: ServerOptions) => {
    // options fully typed here
    const server = await createServer({ ...options });
  });
```

**Key Insight:** Explicit interfaces + intersections for type narrowing.

---

### Pattern 3: Discriminated Unions (citty library)

```typescript
type ArgDef =
  | { type: 'boolean'; default?: boolean }
  | { type: 'string'; default?: string }
  | { type: 'number'; default?: number };

type ParsedArgs<T> = {
  [K in keyof T]: T[K] extends { type: 'boolean' }
    ? boolean
    : T[K] extends { type: 'number' }
    ? number
    : string;
};

// Command discriminants for exhaustive switching
type ParsedCLI<Commands> = {
  command: Commands; // literal union type
  flags: Record<string, unknown>;
};

const argv = parse() as ParsedCLI<'build' | 'dev' | 'test'>;

switch (argv.command) {
  case 'build': /* ... */; break;
  case 'dev': /* ... */; break;
  case 'test': /* ... */; break;
  default:
    argv.command satisfies never; // exhaustiveness check
}
```

**Key Insight:** Discriminated unions enable exhaustive compile-time checking.

---

## 2️⃣ MODERN TYPESCRIPT FEATURES (5.x)

### Pattern 1: `satisfies` Operator (Vite/Turbo)

**Exhaustive switch validation (Vite build.ts:1037):**

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function handleLog(level: LogLevel) {
  switch (level) {
    case 'info': /* ... */; break;
    case 'warn': /* ... */; break;
    case 'error': /* ... */; break;
    case 'debug': /* ... */; break;
    default:
      level satisfies never; // new levels = compile error
      throw new Error(`Unknown log level: ${level}`);
  }
}
```

**Typed URL mechanisms (Vite build.ts:1356-1362):**

```typescript
const urlMechanisms = {
  es: (path: string) => `import.meta.url + '${path}'`,
  iife: (path: string) => `document.baseURI + '${path}'`,
  system: (path: string) => `module.meta.url + '${path}'`,
} as const satisfies Record<string, (path: string) => string>;

type Format = keyof typeof urlMechanisms; // 'es' | 'iife' | 'system'
```

**Config typing (Turbo jest.config.ts):**

```typescript
import type { Config } from '@jest/types';

const config = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  verbose: process.env.RUNNER_DEBUG === '1',
} as const satisfies Config;

export default config;
```

**Benefits:**
- ✅ Literal types preserved
- ✅ Type-checked against interface
- ✅ IntelliSense on config object
- ✅ Compile error on typos

---

### Pattern 2: Template Literal Types (Vite)

**Debug scope validation (Vite utils.ts:181-207):**

```typescript
export type ViteDebugScope = `vite:${string}`;

function createDebugger(namespace: ViteDebugScope): void {
  const log = debug(namespace);
  // ...
}

createDebugger('vite:server'); // ✅ Valid
createDebugger('vite:config'); // ✅ Valid
createDebugger('app:server');  // ❌ Type error
```

**CLI command validation:**

```typescript
type CommandName = `${'build' | 'dev' | 'test'}:${string}`;

function runCommand<const T extends CommandName>(name: T) {
  // T preserves literal type
  console.log(`Running: ${name}`);
}

runCommand('build:production'); // ✅
runCommand('dev:local');        // ✅
runCommand('deploy:prod');      // ❌ Type error
```

---

### Pattern 3: Const Type Parameters (TS 5.0)

**Preserve literal types in flag definitions:**

```typescript
function defineFlags<const T extends Record<string, string | boolean>>(
  flags: T
): T {
  return flags;
}

const flags = defineFlags({
  env: 'production',
  watch: false,
  verbose: true,
});

// T is inferred as:
// {
//   readonly env: "production";
//   readonly watch: false;
//   readonly verbose: true;
// }

// Not widened to:
// { env: string; watch: boolean; verbose: boolean }
```

---

## 3️⃣ ERROR HANDLING PATTERNS

### Pattern 1: Custom Error Classes (pnpm)

**Structured errors with metadata (pnpm error/index.ts:3-44):**

```typescript
export class PnpmError extends Error {
  public readonly code: string;
  public readonly hint?: string;
  public attempts?: number;
  public prefix?: string;
  public pkgsStack?: Array<{
    id: string;
    name: string;
    version: string;
  }>;

  constructor(
    code: string,
    message: string,
    opts?: { hint?: string; attempts?: number }
  ) {
    super(message);
    this.code = code.startsWith('ERR_PNPM_') ? code : `ERR_PNPM_${code}`;
    this.hint = opts?.hint;
    this.attempts = opts?.attempts;
    this.name = 'PnpmError';
  }
}

// Usage with typed error codes
throw new PnpmError('NO_LOCKFILE', 'Missing pnpm-lock.yaml', {
  hint: 'Run `pnpm install` to generate lockfile'
});
```

**Benefits:**
- Machine-readable error codes
- Actionable hints for users
- Structured metadata (attempts, stack)
- Type-safe error construction

---

### Pattern 2: Discriminated Fatal Errors (Shopify CLI)

**Fatal error types (Shopify cli-kit/error.ts:9-92):**

```typescript
export enum FatalErrorType {
  Abort,        // User-facing error (bad input)
  AbortSilent,  // Abort without output
  Bug,          // Unexpected error (our fault)
}

export class FatalError extends ExtendableError {
  public type: FatalErrorType;
  public tryMessage?: TokenizedString;
}

export class AbortError extends FatalError {
  constructor(message: string, tryMessage?: string) {
    super(message);
    this.type = FatalErrorType.Abort;
    this.tryMessage = tryMessage;
  }
}

export class BugError extends FatalError {
  constructor(message: string) {
    super(message);
    this.type = FatalErrorType.Bug;
  }
}

// Global error mapper
export function errorMapper(error: unknown): FatalError {
  if (error instanceof FatalError) return error;
  if (error instanceof Error) return new BugError(error.message);
  return new BugError(String(error));
}

// Central handler
export function handler(error: unknown): void {
  const fatalError = errorMapper(error);
  renderFatalError(fatalError);
  process.exitCode = fatalError.type === FatalErrorType.Bug ? 2 : 1;
}
```

**Benefits:**
- Distinguish user errors from bugs
- Different exit codes (1 = user, 2 = bug)
- Centralized error handling
- Type-safe error classification

---

### Pattern 3: Result Type (Shopify CLI)

**Result/Either monad pattern (Shopify cli-kit/result.ts:3-113):**

```typescript
export type Result<TValue, TError> = Ok<TValue, TError> | Err<TValue, TError>;

export const ok = <TValue>(value: TValue) => new Ok(value);
export const err = <TError>(error: TError) => new Err(error);

class Ok<TValue, TError> {
  constructor(readonly value: TValue) {}

  isOk(): this is Ok<TValue, TError> { return true; }
  isErr(): this is Err<TValue, TError> { return false; }

  map<U>(fn: (value: TValue) => U): Result<U, TError> {
    return ok(fn(this.value));
  }

  mapError<E>(_fn: (error: TError) => E): Result<TValue, E> {
    return ok(this.value);
  }

  valueOrAbort(): TValue {
    return this.value;
  }
}

class Err<TValue, TError> {
  constructor(readonly error: TError) {}

  isOk(): this is Ok<TValue, TError> { return false; }
  isErr(): this is Err<TValue, TError> { return true; }

  map<U>(_fn: (value: TValue) => U): Result<U, TError> {
    return err(this.error);
  }

  mapError<E>(fn: (error: TError) => E): Result<TValue, E> {
    return err(fn(this.error));
  }

  valueOrAbort(): never {
    throw new AbortError(String(this.error));
  }
}

// Usage
async function loadConfig(): Promise<Result<Config, string>> {
  try {
    const raw = await readFile('config.json', 'utf-8');
    const config = JSON.parse(raw);
    return ok(config);
  } catch (e) {
    return err('Failed to load config');
  }
}

// Expression-oriented error handling
const config = (await loadConfig())
  .mapError(e => `Config error: ${e}`)
  .valueOrAbort();
```

**Benefits:**
- No try/catch needed
- Explicit error handling in types
- Composable with map/mapError
- Railway-oriented programming

---

### Pattern 4: Signal Handling (tsx)

**Relay signals to child process (tsx cli.ts:24-120):**

```typescript
let waitForSignal: Promise<void> | undefined;

const relaySignalToChild = async (signal: NodeJS.Signals) => {
  if (waitForSignal) {
    return waitForSignal;
  }

  childProcess.kill(signal);

  waitForSignal = new Promise((resolve) => {
    setTimeout(() => {
      const exitCode = osConstants.signals[signal];
      process.exit(128 + exitCode); // POSIX-compliant
    }, 5000); // 5s grace period

    childProcess.on('exit', () => {
      resolve();
    });
  });

  // Force kill after grace period
  setTimeout(() => {
    childProcess.kill('SIGKILL');
  }, 5000);
};

process.on('SIGINT', relaySignalToChild);
process.on('SIGTERM', relaySignalToChild);
```

**Exit code mapping (tsx cli.ts:254):**

```typescript
childProcess.on('close', (code, signal) => {
  if (code !== null) {
    process.exit(code);
  } else if (signal) {
    const exitCode = osConstants.signals[signal];
    process.exit(128 + exitCode); // 130 for SIGINT, 143 for SIGTERM
  }
});
```

**Benefits:**
- Graceful shutdown
- Proper signal propagation
- POSIX-compliant exit codes
- Timeout for hung processes

---

## 4️⃣ TYPE-SAFE CONFIGURATION

### Pattern 1: Zod Validation with Transform

**Parse → Transform → Enrich pattern:**

```typescript
import { z } from 'zod';
import path from 'node:path';

const RawConfigSchema = z.object({
  root: z.string().default('.'),
  mode: z.enum(['dev', 'prod']).default('dev'),
  targets: z.array(z.string()).nonempty(),
  deploy: z.discriminatedUnion('provider', [
    z.object({
      provider: z.literal('s3'),
      bucket: z.string(),
      region: z.string().default('us-east-1'),
    }),
    z.object({
      provider: z.literal('gcs'),
      bucket: z.string(),
      projectId: z.string(),
    }),
  ]),
});

const ConfigSchema = RawConfigSchema.transform((cfg) => ({
  ...cfg,
  root: path.resolve(cfg.root),
  isProd: cfg.mode === 'prod',
  timestamp: Date.now(),
}));

type Config = z.infer<typeof ConfigSchema>;

// Safe parsing with formatted errors
const res = ConfigSchema.safeParse(rawInput);
if (!res.success) {
  const formatted = res.error.issues
    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid config:\n${formatted}`);
}

const config = res.data;
```

---

### Pattern 2: Environment Variable Validation

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DEBUG: z.preprocess(
    (v) => (typeof v === 'string' ? v === 'true' : v),
    z.boolean().default(false)
  ),
  API_KEY: z.string().min(10),
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;

// Usage: env.PORT is guaranteed to be number 1-65535
```

---

## 5️⃣ ASYNC/AWAIT BEST PRACTICES

### Pattern 1: Top-Level Await (Prisma Style)

```typescript
async function main() {
  const args = process.argv.slice(2);
  const result = await runCommand(args);
  return result;
}

void main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
```

**Pure ESM (tsx/bun-friendly):**

```typescript
const args = process.argv.slice(2);
const code = await runCommand(args);
process.exit(code ?? 0);
```

---

### Pattern 2: Parallel Operations

**Fail-fast (Promise.all):**

```typescript
const [config, user, data] = await Promise.all([
  loadConfig(),
  fetchUser(),
  fetchData(),
]);
```

**Best effort (Promise.allSettled):**

```typescript
const results = await Promise.allSettled(
  tasks.map(task => processTask(task))
);

const failures = results.filter(r => r.status === 'rejected');
if (failures.length > 0) {
  failures.forEach(f => console.error(f.reason));
  process.exitCode = 1;
}
```

**Concurrency limiting (p-limit):**

```typescript
import pLimit from 'p-limit';

const limit = pLimit(4); // max 4 concurrent
await Promise.all(
  items.map(item => limit(() => processItem(item)))
);
```

---

### Pattern 3: Cleanup (Prisma Pattern)

```typescript
async function main() {
  const client = await createClient();
  try {
    await client.connect();
    await doWork(client);
  } finally {
    await client.close().catch(() => {}); // swallow close errors
  }
}
```

**Signal-aware teardown (Vercel pattern):**

```typescript
import { onExit } from 'signal-exit';

const cleanup = async () => {
  spinner?.stop();
  await client?.close();
};

onExit(() => { void cleanup(); });

await main().catch(async (err) => {
  await cleanup();
  console.error(err);
  process.exit(1);
});
```

---

## 6️⃣ RECOMMENDED PATTERNS FOR KAI CLIS

### For Tier 1 (llcli-style):

```typescript
#!/usr/bin/env bun

interface Config {
  apiKey: string;
  baseUrl: string;
}

const DEFAULTS = {
  baseUrl: 'https://api.example.com',
  limit: 20,
} as const;

class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

function loadConfig(): Config {
  // ... load from ${PAI_DIR}/.env
  throw new CLIError('API_KEY not found', 'ERR_NO_API_KEY');
}

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || args[0] === '--help') {
    showHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'fetch':
      await fetchData(args[1]);
      break;
    default:
      throw new CLIError(`Unknown command: ${command}`, 'ERR_UNKNOWN_CMD');
  }
}

main().catch(error => {
  if (error instanceof CLIError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    process.exit(error.exitCode);
  }
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

### For Tier 2 (Commander.js):

```typescript
#!/usr/bin/env bun

import { Command } from 'commander';

const program = new Command();

program
  .name('mycli')
  .description('My CLI tool')
  .version('1.0.0');

program
  .command('process <file>')
  .option('-o, --output <path>', 'output path')
  .option('--format <type>', 'output format', 'json')
  .action(async (file: string, options) => {
    try {
      await processFile(file, options);
    } catch (error) {
      console.error('Processing failed:', error);
      process.exit(1);
    }
  });

program.parse();
```

---

## ✅ QUICK REFERENCE CHECKLIST

**Type Safety:**
- [ ] Use strict mode in tsconfig.json
- [ ] Define interfaces for all data structures
- [ ] Avoid `any` types (use `unknown` if needed)
- [ ] Use template literal types for string patterns
- [ ] Use discriminated unions for commands
- [ ] Prefer `as const satisfies` for configs

**Error Handling:**
- [ ] Custom error class with `code` field
- [ ] Actionable error messages with hints
- [ ] Exit code 0 = success, 1 = error, 2 = bug
- [ ] Catch at top level (main().catch())
- [ ] Handle signals (SIGINT, SIGTERM)

**Modern TypeScript:**
- [ ] Use `satisfies` for exhaustiveness checks
- [ ] Use template literals for validation
- [ ] Use const type parameters for literals
- [ ] Prefer `as const` for config objects

**Async/Await:**
- [ ] Top-level await in ESM or void main().catch()
- [ ] Use Promise.allSettled for best-effort parallel
- [ ] Cleanup in finally blocks
- [ ] Set process.exitCode instead of process.exit

---

**Sources:**
- tsx (privatenumber/tsx) - Type safety, signal handling
- Vite (vitejs/vite) - Modern TS features, validation
- Turbo (vercel/turbo) - Config patterns
- Bun (oven-sh/bun) - Async patterns
- pnpm (pnpm/pnpm) - Custom errors
- Shopify CLI (Shopify/cli) - Result types, fatal errors
- Codex research (actual repository analysis)
