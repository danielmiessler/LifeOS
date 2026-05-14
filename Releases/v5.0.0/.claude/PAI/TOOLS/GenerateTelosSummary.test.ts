#!/usr/bin/env bun
/**
 * Fixture test for GenerateTelosSummary.ts
 *
 * Validates the four parser fixes against a representative TELOS shape:
 *   1. parseItems regex matches "- **ID:** text" bullets
 *   2. parseStrategies reads bullet format (S0, S1, ...)
 *   3. parseModels reads ID-less bold bullets
 *   4. title is sourced from PRINCIPAL_IDENTITY
 *
 * Run: bun test Releases/v5.0.0/.claude/PAI/TOOLS/GenerateTelosSummary.test.ts
 */

import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const TMP_HOME = join(tmpdir(), `telos-summary-test-${process.pid}`);
const TELOS_DIR = join(TMP_HOME, '.claude/PAI/USER/TELOS');
const IDENTITY_PATH = join(TMP_HOME, '.claude/PAI/USER/PRINCIPAL_IDENTITY.md');
const OUTPUT_PATH = join(TELOS_DIR, 'PRINCIPAL_TELOS.md');
const SCRIPT_PATH = join(import.meta.dir, 'GenerateTelosSummary.ts');

function writeFixture(name: string, body: string) {
  writeFileSync(join(TELOS_DIR, name), body);
}

beforeAll(() => {
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true, force: true });
  mkdirSync(TELOS_DIR, { recursive: true });

  writeFileSync(IDENTITY_PATH, [
    '# Principal Identity — TestUser',
    '',
    '## Quick Reference',
    '',
    '- **Name:** TestUser',
    '- **Pronunciation:** TestUser',
    '',
  ].join('\n'));

  writeFixture('MISSION.md', [
    '# Mission',
    '',
    '- **M0:** Build tools that move agency to individuals.',
    '',
  ].join('\n'));

  writeFixture('GOALS.md', [
    '# Goals',
    '',
    '- **G0:** Ship product MVP — measurable outcome required.',
    '- **G1:** Publish weekly newsletter.',
    '- **G2:** Older deferred goal that should not be active.',
    '',
  ].join('\n'));

  writeFixture('PROBLEMS.md', [
    '# Problems',
    '',
    '## P0: Tools fight the user instead of helping',
    '',
    'Body text.',
    '',
    '## P1: Information access is uneven (legacy systems)',
    '',
    'Body text.',
    '',
  ].join('\n'));

  writeFixture('STRATEGIES.md', [
    '# Strategies',
    '',
    '- **S0:** Ship the crappy version, then iterate in public.',
    '- **S1:** Write before building.',
    '',
  ].join('\n'));

  writeFixture('NARRATIVES.md', [
    '# Narratives',
    '',
    '- **N0:** I build tools that move power to individuals.',
    '- **N1:** Pattern-spotter who ships.',
    '- **N2:** Secondary narrative that gets compressed.',
    '',
  ].join('\n'));

  writeFixture('CHALLENGES.md', [
    '# Challenges',
    '',
    '- **C0:** I start more projects than I finish.',
    '',
  ].join('\n'));

  writeFixture('MODELS.md', [
    '# Mental Models',
    '',
    '- **First principles** — break problems down to fundamentals rather than analogy.',
    '- **Systems thinking** — behaviour comes from structure.',
    '- **Pareto** — most outcomes from a small share of inputs.',
    '',
  ].join('\n'));

  const result = spawnSync('bun', ['run', SCRIPT_PATH], {
    env: { ...process.env, HOME: TMP_HOME },
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    throw new Error(`Generator exited ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
});

afterAll(() => {
  rmSync(TMP_HOME, { recursive: true, force: true });
});

test('title sources principal name from PRINCIPAL_IDENTITY.md', () => {
  const out = readFileSync(OUTPUT_PATH, 'utf-8');
  expect(out).toMatch(/^# Principal TELOS — TestUser/m);
});

test('parseItems reads `- **ID:** text` mission bullets', () => {
  const out = readFileSync(OUTPUT_PATH, 'utf-8');
  expect(out).toMatch(/\*\*M0\*\*: Build tools that move agency to individuals/);
});

test('parseStrategies reads bullet format (S0, S1)', () => {
  const out = readFileSync(OUTPUT_PATH, 'utf-8');
  expect(out).toMatch(/\*\*S0\*\*: Ship the crappy version/);
  expect(out).toMatch(/\*\*S1\*\*: Write before building/);
});

test('parseModels reads ID-less bold bullets', () => {
  const out = readFileSync(OUTPUT_PATH, 'utf-8');
  expect(out).toMatch(/\*\*First principles\*\* — break problems down to fundamentals/);
  expect(out).toMatch(/\*\*Systems thinking\*\* — behaviour comes from structure/);
});

test('problems parsed from `## P0:` headers', () => {
  const out = readFileSync(OUTPUT_PATH, 'utf-8');
  expect(out).toMatch(/\*\*P0\*\*: Tools fight the user instead of helping/);
  expect(out).toMatch(/\*\*P1\*\*: Information access is uneven/);
});

test('active vs deferred goal split', () => {
  const out = readFileSync(OUTPUT_PATH, 'utf-8');
  expect(out).toMatch(/\*\*G0\*\*: Ship product MVP/);
  expect(out).toMatch(/\*\*G1\*\*: Publish weekly newsletter/);
  expect(out).toMatch(/Deferred.*G2/);
});
