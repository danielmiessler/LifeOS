#!/usr/bin/env bun
/**
 * ValidateTemplate.ts - Template Syntax Validator
 *
 * Validates Handlebars templates for syntax errors and missing variables.
 *
 * Usage:
 *   bun run ValidateTemplate.ts --template <path> [--data <path>] [--strict]
 *
 * Examples:
 *   bun run ValidateTemplate.ts --template Primitives/Roster.hbs
 *   bun run ValidateTemplate.ts -t Evals/Judge.hbs -d Data/JudgeConfig.yaml --strict
 */

import Handlebars from 'handlebars';
import { parse as parseYaml } from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { parseArgs } from 'util';

// ============================================================================
// Types
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
  helpers: string[];
  partials: string[];
}

interface ValidateOptions {
  templatePath: string;
  dataPath?: string;
  strict?: boolean;
}

// ============================================================================
// Validator
// ============================================================================

function resolveTemplatePath(path: string): string {
  if (path.startsWith('/')) return path;
  const templatesDir = dirname(dirname(import.meta.path));
  return resolve(templatesDir, path);
}

function extractVariables(source: string): string[] {
  const variables: Set<string> = new Set();

  // Match {{variable}} and {{object.property}}
  const simpleVars = source.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g);
  for (const match of simpleVars) {
    variables.add(match[1]);
  }

  // Match {{#each items}} and {{#if condition}}
  const blockVars = source.matchAll(/\{\{#(?:each|if|unless|with)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g);
  for (const match of blockVars) {
    variables.add(match[1]);
  }

  return Array.from(variables).sort();
}

function extractHelpers(source: string): string[] {
  const helpers: Set<string> = new Set();

  // Match {{helperName ...}}
  const helperCalls = source.matchAll(/\{\{([a-z][a-zA-Z]+)\s/g);
  for (const match of helperCalls) {
    const name = match[1];
    // Filter out built-in block helpers
    if (!['if', 'unless', 'each', 'with', 'else'].includes(name)) {
      helpers.add(name);
    }
  }

  return Array.from(helpers).sort();
}

function extractPartials(source: string): string[] {
  const partials: Set<string> = new Set();

  // Match {{> partialName}}
  const partialCalls = source.matchAll(/\{\{>\s*([a-zA-Z_][a-zA-Z0-9_-]*)/g);
  for (const match of partialCalls) {
    partials.add(match[1]);
  }

  return Array.from(partials).sort();
}

function checkUnbalancedBlocks(source: string): string[] {
  const errors: string[] = [];
  const blockStack: { name: string; line: number }[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Opening blocks
    const opens = line.matchAll(/\{\{#([a-z]+)/g);
    for (const match of opens) {
      blockStack.push({ name: match[1], line: lineNum });
    }

    // Closing blocks
    const closes = line.matchAll(/\{\{\/([a-z]+)\}\}/g);
    for (const match of closes) {
      const closer = match[1];
      if (blockStack.length === 0) {
        errors.push(`Line ${lineNum}: Unexpected closing block {{/${closer}}}`);
      } else {
        const opener = blockStack.pop()!;
        if (opener.name !== closer) {
          errors.push(
            `Line ${lineNum}: Mismatched block - expected {{/${opener.name}}} (opened on line ${opener.line}), got {{/${closer}}}`
          );
        }
      }
    }
  }

  // Unclosed blocks
  for (const opener of blockStack) {
    errors.push(`Line ${opener.line}: Unclosed block {{#${opener.name}}}`);
  }

  return errors;
}

function checkMissingVariables(
  variables: string[],
  data: Record<string, unknown>
): string[] {
  const warnings: string[] = [];

  function hasPath(obj: Record<string, unknown>, path: string): boolean {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return false;
      if (typeof current !== 'object') return false;
      current = (current as Record<string, unknown>)[part];
    }

    return current !== undefined;
  }

  for (const variable of variables) {
    // Skip special variables
    if (['this', '@index', '@key', '@first', '@last', '@root'].some(s => variable.startsWith(s))) {
      continue;
    }

    if (!hasPath(data, variable)) {
      warnings.push(`Variable "${variable}" not found in data`);
    }
  }

  return warnings;
}

export function validateTemplate(options: ValidateOptions): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    variables: [],
    helpers: [],
    partials: [],
  };

  // Load template
  const fullPath = resolveTemplatePath(options.templatePath);
  if (!existsSync(fullPath)) {
    result.valid = false;
    result.errors.push(`Template not found: ${fullPath}`);
    return result;
  }

  const source = readFileSync(fullPath, 'utf-8');

  // Extract metadata
  result.variables = extractVariables(source);
  result.helpers = extractHelpers(source);
  result.partials = extractPartials(source);

  // Check for syntax errors by attempting to compile
  try {
    Handlebars.compile(source);
  } catch (error) {
    result.valid = false;
    result.errors.push(`Syntax error: ${(error as Error).message}`);
    return result;
  }

  // Check for unbalanced blocks
  const blockErrors = checkUnbalancedBlocks(source);
  if (blockErrors.length > 0) {
    result.valid = false;
    result.errors.push(...blockErrors);
  }

  // If data provided, check for missing variables
  if (options.dataPath) {
    const dataFullPath = resolveTemplatePath(options.dataPath);
    if (!existsSync(dataFullPath)) {
      result.warnings.push(`Data file not found: ${dataFullPath}`);
    } else {
      const dataSource = readFileSync(dataFullPath, 'utf-8');
      const data = options.dataPath.endsWith('.json')
        ? JSON.parse(dataSource)
        : parseYaml(dataSource);

      const missingVars = checkMissingVariables(result.variables, data as Record<string, unknown>);
      if (options.strict) {
        result.errors.push(...missingVars.map(w => w.replace('Variable', 'Missing variable')));
        if (missingVars.length > 0) result.valid = false;
      } else {
        result.warnings.push(...missingVars);
      }
    }
  }

  return result;
}

// ============================================================================
// CLI Interface
// ============================================================================

function main(): void {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      template: { type: 'string', short: 't' },
      data: { type: 'string', short: 'd' },
      strict: { type: 'boolean', short: 's' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help || !values.template) {
    console.log(`
PAI Template Validator

Usage:
  bun run ValidateTemplate.ts --template <path> [options]

Options:
  -t, --template <path>  Template file (.hbs)
  -d, --data <path>      Data file (.yaml or .json) for variable checking
  -s, --strict           Treat missing variables as errors (not warnings)
  -h, --help             Show this help

Examples:
  bun run ValidateTemplate.ts -t Primitives/Roster.hbs
  bun run ValidateTemplate.ts -t Evals/Judge.hbs -d Data/JudgeConfig.yaml --strict
`);
    process.exit(values.help ? 0 : 1);
  }

  const result = validateTemplate({
    templatePath: values.template,
    dataPath: values.data,
    strict: values.strict,
  });

  // Output results
  console.log('\n=== Template Validation ===\n');
  console.log(`Template: ${values.template}`);
  console.log(`Status: ${result.valid ? '✓ Valid' : '✗ Invalid'}`);

  if (result.variables.length > 0) {
    console.log(`\nVariables (${result.variables.length}):`);
    result.variables.forEach(v => console.log(`  - ${v}`));
  }

  if (result.helpers.length > 0) {
    console.log(`\nHelpers Used (${result.helpers.length}):`);
    result.helpers.forEach(h => console.log(`  - ${h}`));
  }

  if (result.partials.length > 0) {
    console.log(`\nPartials (${result.partials.length}):`);
    result.partials.forEach(p => console.log(`  - ${p}`));
  }

  if (result.errors.length > 0) {
    console.log(`\n✗ Errors (${result.errors.length}):`);
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠ Warnings (${result.warnings.length}):`);
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('');
  process.exit(result.valid ? 0 : 1);
}

if (import.meta.main) {
  main();
}
