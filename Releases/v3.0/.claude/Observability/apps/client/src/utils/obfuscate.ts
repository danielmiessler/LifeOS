/**
 * Security utility for obfuscating sensitive data in displayed output
 * Prevents API keys, tokens, and other secrets from being visible in recordings
 */

/**
 * Patterns for detecting sensitive data
 */
const SENSITIVE_PATTERNS = [
  // API Keys
  { name: 'OpenAI API Key', pattern: /sk-proj-[a-zA-Z0-9_-]{20,}/g },
  { name: 'OpenAI API Key (legacy)', pattern: /sk-[a-zA-Z0-9]{48}/g },
  { name: 'Anthropic API Key', pattern: /sk-ant-api03-[a-zA-Z0-9_-]{95}/g },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Generic API Key', pattern: /[a-zA-Z0-9]{32,}/g }, // Catch-all for long alphanumeric strings

  // Tokens
  { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },
  { name: 'Bearer Token', pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/gi },

  // Passwords and secrets
  { name: 'Password Field', pattern: /(password|passwd|pwd)["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi },
  { name: 'Secret Field', pattern: /(secret|token|key)["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi },

  // AWS Secrets
  { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/g },

  // Email addresses (optionally obfuscate)
  { name: 'Email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },

  // IP addresses (internal networks)
  { name: 'Private IP', pattern: /\b(?:10|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g },

  // Credit card numbers
  { name: 'Credit Card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },

  // Social Security Numbers
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
];

/**
 * Key names that indicate sensitive data
 */
const SENSITIVE_KEY_NAMES = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'access_token',
  'refresh_token',
  'private_key',
  'privatekey',
  'auth',
  'authorization',
  'credential',
  'credentials',
  'aws_access_key_id',
  'aws_secret_access_key',
  'stripe_key',
  'anthropic_api_key',
  'openai_api_key',
];

/**
 * Obfuscate a single value
 */
function obfuscateValue(value: string, showChars: number = 4): string {
  if (value.length <= showChars * 2) {
    return '*'.repeat(value.length);
  }

  const start = value.slice(0, showChars);
  const end = value.slice(-showChars);
  const middle = '*'.repeat(Math.min(20, value.length - showChars * 2)); // Cap at 20 stars

  return `${start}${middle}${end}`;
}

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKeyName(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEY_NAMES.some(sensitive => lowerKey.includes(sensitive));
}

/**
 * Check if string is a file path in .claude directory
 */
function isClaudeDirectoryPath(text: string): boolean {
  // Check for any .claude directory path (platform-agnostic)
  return text.includes('/.claude/') || /\/Users\/[^/]+\/.claude/.test(text) || /\/home\/[^/]+\/.claude/.test(text);
}

/**
 * Obfuscate sensitive data in a string
 */
export function obfuscateString(text: string): string {
  // Don't obfuscate file paths in .claude directory
  if (isClaudeDirectoryPath(text)) {
    return text;
  }

  let result = text;

  // Apply each pattern
  for (const { pattern } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Don't obfuscate very short matches (likely false positives)
      if (match.length < 10) return match;

      return obfuscateValue(match);
    });
  }

  return result;
}

/**
 * Obfuscate sensitive data in a JSON object (recursively)
 */
export function obfuscateObject(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return obj;

  if (obj === null || obj === undefined) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => obfuscateObject(item, depth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key name suggests sensitive data
      if (isSensitiveKeyName(key)) {
        if (typeof value === 'string') {
          result[key] = obfuscateValue(value);
        } else {
          result[key] = '***REDACTED***';
        }
      } else if (typeof value === 'string') {
        // Check string value for sensitive patterns
        result[key] = obfuscateString(value);
      } else if (typeof value === 'object') {
        // Recursively process nested objects
        result[key] = obfuscateObject(value, depth + 1);
      } else {
        // Pass through other types (numbers, booleans, etc.)
        result[key] = value;
      }
    }

    return result;
  }

  // Handle primitive strings
  if (typeof obj === 'string') {
    return obfuscateString(obj);
  }

  // Pass through other primitives
  return obj;
}

/**
 * Obfuscate sensitive data in JSON string
 */
export function obfuscateJSON(jsonString: string): string {
  try {
    const obj = JSON.parse(jsonString);
    const obfuscated = obfuscateObject(obj);
    return JSON.stringify(obfuscated, null, 2);
  } catch (error) {
    // If not valid JSON, treat as plain text
    return obfuscateString(jsonString);
  }
}

/**
 * Quick check if text contains potentially sensitive data
 */
export function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some(({ pattern }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    return regex.test(text);
  });
}
