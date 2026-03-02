#!/usr/bin/env bun
/**
 * RenderTemplate.ts - PAI Templating Engine
 *
 * Renders Handlebars templates with YAML data sources.
 *
 * Usage:
 *   bun run RenderTemplate.ts --template <path> --data <path> [--output <path>] [--preview]
 *
 * Examples:
 *   bun run RenderTemplate.ts --template Primitives/Roster.hbs --data Data/Agents.yaml
 *   bun run RenderTemplate.ts -t Evals/Judge.hbs -d Data/JudgeConfig.yaml -o Compiled/judge.md
 *   bun run RenderTemplate.ts --template Primitives/Gate.hbs --data Data/Gates.yaml --preview
 */

import Handlebars from 'handlebars';
import { parse as parseYaml } from 'yaml';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { parseArgs } from 'util';

// ============================================================================
// Custom Handlebars Helpers
// ============================================================================

// Uppercase text
Handlebars.registerHelper('uppercase', (str: string) => {
  return str?.toUpperCase() ?? '';
});

// Lowercase text
Handlebars.registerHelper('lowercase', (str: string) => {
  return str?.toLowerCase() ?? '';
});

// Title case text
Handlebars.registerHelper('titlecase', (str: string) => {
  return str?.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  ) ?? '';
});

// Indent text by N spaces
Handlebars.registerHelper('indent', (str: string, spaces: number) => {
  if (!str) return '';
  const indent = ' '.repeat(typeof spaces === 'number' ? spaces : 2);
  return str.split('\n').map(line => indent + line).join('\n');
});

// Join array with separator
Handlebars.registerHelper('join', (arr: string[], separator: string) => {
  if (!Array.isArray(arr)) return '';
  return arr.join(typeof separator === 'string' ? separator : ', ');
});

// Check if value equals another
Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

// Check if value is greater than
Handlebars.registerHelper('gt', (a: number, b: number) => a > b);

// Check if value is less than
Handlebars.registerHelper('lt', (a: number, b: number) => a < b);

// Check if array includes value
Handlebars.registerHelper('includes', (arr: unknown[], value: unknown) => {
  return Array.isArray(arr) && arr.includes(value);
});

// Get current date/time
Handlebars.registerHelper('now', (format?: string) => {
  const now = new Date();
  if (format === 'date') return now.toISOString().split('T')[0];
  if (format === 'time') return now.toTimeString().split(' ')[0];
  return now.toISOString();
});

// Pluralize word based on count
Handlebars.registerHelper('pluralize', (count: number, singular: string, plural?: string) => {
  const pluralForm = typeof plural === 'string' ? plural : `${singular}s`;
  return count === 1 ? singular : pluralForm;
});

// Format number with commas
Handlebars.registerHelper('formatNumber', (num: number) => {
  return num?.toLocaleString() ?? '';
});

// Calculate percentage
Handlebars.registerHelper('percent', (value: number, total: number, decimals = 0) => {
  if (!total) return '0';
  return ((value / total) * 100).toFixed(typeof decimals === 'number' ? decimals : 0);
});

// Truncate text to length
Handlebars.registerHelper('truncate', (str: string, length: number) => {
  if (!str) return '';
  const maxLen = typeof length === 'number' ? length : 100;
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
});

// Default value if undefined
Handlebars.registerHelper('default', (value: unknown, defaultValue: unknown) => {
  return value ?? defaultValue;
});

// JSON stringify
Handlebars.registerHelper('json', (obj: unknown, pretty = false) => {
  return JSON.stringify(obj, null, pretty ? 2 : undefined);
});

// Markdown code block
Handlebars.registerHelper('codeblock', (code: string, language?: string) => {
  const lang = typeof language === 'string' ? language : '';
  return `\`\`\`${lang}\n${code}\n\`\`\``;
});

// Repeat helper for generating repeated content
Handlebars.registerHelper('repeat', (count: number, options: Handlebars.HelperOptions) => {
  let result = '';
  for (let i = 0; i < count; i++) {
    result += options.fn({ index: i, first: i === 0, last: i === count - 1 });
  }
  return result;
});

// ============================================================================
// Template Engine
// ============================================================================

interface RenderOptions {
  templatePath: string;
  dataPath: string;
  outputPath?: string;
  preview?: boolean;
}

function resolveTemplatePath(path: string): string {
  // If absolute, use as-is
  if (path.startsWith('/')) return path;

  // Resolve relative to Templates directory
  const templatesDir = dirname(dirname(import.meta.path));
  return resolve(templatesDir, path);
}

function loadTemplate(templatePath: string): HandlebarsTemplateDelegate {
  const fullPath = resolveTemplatePath(templatePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Template not found: ${fullPath}`);
  }

  const templateSource = readFileSync(fullPath, 'utf-8');
  return Handlebars.compile(templateSource);
}

function loadData(dataPath: string): Record<string, unknown> {
  const fullPath = resolveTemplatePath(dataPath);

  if (!existsSync(fullPath)) {
    throw new Error(`Data file not found: ${fullPath}`);
  }

  const dataSource = readFileSync(fullPath, 'utf-8');

  // Support both YAML and JSON
  if (dataPath.endsWith('.json')) {
    return JSON.parse(dataSource);
  }

  return parseYaml(dataSource) as Record<string, unknown>;
}

function registerPartials(templatesDir: string): void {
  const partialsDir = resolve(templatesDir, 'Partials');

  if (!existsSync(partialsDir)) return;

  const files = Bun.spawnSync(['ls', partialsDir]).stdout.toString().trim().split('\n');

  for (const file of files) {
    if (file.endsWith('.hbs')) {
      const partialName = basename(file, '.hbs');
      const partialPath = resolve(partialsDir, file);
      const partialSource = readFileSync(partialPath, 'utf-8');
      Handlebars.registerPartial(partialName, partialSource);
    }
  }
}

export function renderTemplate(options: RenderOptions): string {
  const templatesDir = dirname(dirname(import.meta.path));

  // Register any partials
  registerPartials(templatesDir);

  // Load and compile template
  const template = loadTemplate(options.templatePath);

  // Load data
  const data = loadData(options.dataPath);

  // Render
  const rendered = template(data);

  // Output
  if (options.preview) {
    console.log('\n=== PREVIEW ===\n');
    console.log(rendered);
    console.log('\n=== END PREVIEW ===\n');
  }

  if (options.outputPath) {
    const outputFullPath = resolveTemplatePath(options.outputPath);
    writeFileSync(outputFullPath, rendered);
    console.log(`✓ Rendered to: ${outputFullPath}`);
  }

  return rendered;
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
      output: { type: 'string', short: 'o' },
      preview: { type: 'boolean', short: 'p' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help || !values.template || !values.data) {
    console.log(`
PAI Template Renderer

Usage:
  bun run RenderTemplate.ts --template <path> --data <path> [options]

Options:
  -t, --template <path>  Template file (.hbs)
  -d, --data <path>      Data file (.yaml or .json)
  -o, --output <path>    Output file (optional, prints to stdout if omitted)
  -p, --preview          Show preview in console
  -h, --help             Show this help

Examples:
  bun run RenderTemplate.ts -t Primitives/Roster.hbs -d Data/Agents.yaml -p
  bun run RenderTemplate.ts -t Evals/Judge.hbs -d Data/JudgeConfig.yaml -o Compiled/judge.md

Available Helpers:
  {{uppercase str}}           - Convert to uppercase
  {{lowercase str}}           - Convert to lowercase
  {{titlecase str}}           - Convert to title case
  {{indent str spaces}}       - Indent text by N spaces
  {{join arr separator}}      - Join array with separator
  {{eq a b}}                  - Check equality
  {{gt a b}} / {{lt a b}}     - Greater/less than
  {{includes arr value}}      - Check if array includes value
  {{now format}}              - Current date/time
  {{pluralize count word}}    - Pluralize based on count
  {{formatNumber num}}        - Format with commas
  {{percent value total}}     - Calculate percentage
  {{truncate str length}}     - Truncate to length
  {{default value fallback}}  - Default value if undefined
  {{json obj pretty}}         - JSON stringify
  {{codeblock code lang}}     - Markdown code block
  {{repeat count}}...{{/repeat}} - Repeat content N times
`);
    process.exit(values.help ? 0 : 1);
  }

  try {
    renderTemplate({
      templatePath: values.template,
      dataPath: values.data,
      outputPath: values.output,
      preview: values.preview,
    });
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
