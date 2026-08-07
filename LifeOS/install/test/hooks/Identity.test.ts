/**
 * Falsifiers for identity resolution (hooks/lib/identity.ts).
 *
 * LifeosConfig refuses to load without a non-empty `[da].name` and
 * `[principal].name`/`timezone`, and setup points the principal at those fields
 * to name their DA. Before this change getIdentity()/getPrincipal() read none of
 * them, so a rename in LIFEOS_CONFIG.toml changed nothing and `[da].color` had
 * no effect at all.
 *
 * Resolution runs in subprocesses because identity.ts derives its identity-file
 * paths at module load, so an in-process env change would not reproduce a real
 * session.
 */
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const INSTALL_DIR = join(import.meta.dir, '..', '..');
const IDENTITY = join(INSTALL_DIR, 'hooks/lib/identity.ts');

const PROBE = `
import { getIdentity, getDAName, getPrincipal } from ${JSON.stringify(IDENTITY)};
const i = getIdentity();
const p = getPrincipal();
console.log(JSON.stringify({
  name: i.name, fullName: i.fullName, displayName: i.displayName,
  color: i.color, voiceId: i.mainDAVoiceID, prosody: i.voice,
  daName: getDAName(),
  principalName: p.name, principalTimezone: p.timezone,
}));
`;

function resolveWith(configPath: string | undefined) {
  const env = { ...process.env };
  if (configPath === undefined) delete env.LIFEOS_CONFIG_PATH;
  else env.LIFEOS_CONFIG_PATH = configPath;

  const r = Bun.spawnSync(['bun', '-e', PROBE], { env, cwd: INSTALL_DIR });
  if (r.exitCode !== 0) {
    throw new Error(`probe exited ${r.exitCode}: ${r.stderr.toString()}`);
  }
  return JSON.parse(r.stdout.toString().trim().split('\n').at(-1)!);
}

function fixtureConfig(daName: string): string {
  const path = join(
    mkdtempSync(join(tmpdir(), 'lifeos-identity-')),
    'LIFEOS_CONFIG.toml',
  );
  writeFileSync(
    path,
    [
      '[principal]',
      'name = "Fixture Principal"',
      'timezone = "UTC"',
      '',
      '[da]',
      `name = "${daName}"`,
      'color = "#123456"',
      '',
      '[da.voices.main]',
      'voice_id = "fixture-voice-id"',
      'stability = 0.5',
      '',
    ].join('\n'),
  );
  return path;
}

describe('DA identity resolution', () => {
  test('[da].name governs the identity, not the placeholder', () => {
    const id = resolveWith(fixtureConfig('Testbot'));
    expect(id.name).toBe('Testbot');
    expect(id.daName).toBe('Testbot');
    // full_name/display_name are optional in config and derive from the
    // configured name — never from DEFAULT_IDENTITY.
    expect(id.fullName).toBe('Testbot');
    expect(id.displayName).toBe('Testbot');
  });

  test('[da].color and [da.voices.main] reach the identity', () => {
    const id = resolveWith(fixtureConfig('Testbot'));
    expect(id.color).toBe('#123456');
    expect(id.voiceId).toBe('fixture-voice-id');
    expect(id.prosody.stability).toBe(0.5);
  });

  test('a rename in config is what a rename means', () => {
    expect(resolveWith(fixtureConfig('First')).name).toBe('First');
    expect(resolveWith(fixtureConfig('Second')).name).toBe('Second');
  });

  test('[principal] governs the principal, not the placeholder', () => {
    const id = resolveWith(fixtureConfig('Testbot'));
    expect(id.principalName).toBe('Fixture Principal');
    expect(id.principalTimezone).toBe('UTC');
  });

  test('an install with no config resolves exactly as before', () => {
    const id = resolveWith(join(tmpdir(), 'lifeos-identity-absent', 'nope.toml'));
    expect(typeof id.name).toBe('string');
    expect(id.name.length).toBeGreaterThan(0);
    expect(id.daName).toBe(id.name);
  });
});
