/**
 * CacheDir — the one owner-only scratch root for LifeOS tools.
 *
 * `${XDG_CACHE_HOME:-$HOME/.cache}/<name>`, created 0700. Anything a tool keeps between runs
 * that is neither a release artifact nor MEMORY state lives here: isolated codex homes (they hold
 * full session rollouts), per-session counters, statusline caches. Never the shared /tmp: on
 * Linux `tmpdir()` is the sticky world-listable /tmp, so a fixed-name directory there is a
 * transcript sink another local account can list and, for readers, plant into (in-family audit,
 * round 22, 7.52.0 cut). Callers that need a throwaway path still use `mkdtemp`.
 *
 * Fails closed (LOSIntegrity S123): when the directory cannot be created, is a symlink or not a
 * directory, belongs to another user, or cannot be made 0700, cacheDir throws with the reason.
 * It never hands back a path that is not an owner-only real directory, and it checks each
 * component before creating the next, so a link below the root cannot have a directory made
 * through it.
 */
import { chmodSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { invariant } from "../Invariant.ts";
import { hasPosixModes } from "../../../hooks/lib/portable-path";

/** The cache root itself (not created here). */
export function cacheRoot(): string {
  return process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
}

const why = (e: unknown) => (e as NodeJS.ErrnoException)?.code ?? (e as Error)?.message ?? String(e);

/** `<cacheRoot>/<name>` (nested names allowed), created 0700 and returned; throws when it cannot be made private. */
export function cacheDir(...name: string[]): string {
  const parts = name.flatMap((n) => n.split("/")).filter(Boolean);
  if (!parts.length || parts.some((p) => p === "." || p === "..")) throw new Error(`cacheDir: name ${JSON.stringify(name)} must name a directory under the cache root`);
  const root = cacheRoot();
  const dir = join(root, ...parts);
  // The root is the user's own setting (XDG_CACHE_HOME or ~/.cache) and may itself be a link.
  try { mkdirSync(root, { recursive: true, mode: 0o700 }); }
  catch (e) { throw new Error(`cacheDir: cannot create the cache root ${root} (${why(e)}); refusing to use a private cache that does not exist`); }
  // Below the root, one component at a time: each is checked to be a real directory this user owns,
  // and made exactly 0700, BEFORE anything is created inside it. A symlink would carry the chmod and
  // the private files somewhere else, so it is refused before a descendant could be made through it.
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  let cur = root;
  for (const part of parts) {
    cur = join(cur, part);
    try { mkdirSync(cur, { mode: 0o700 }); }
    catch (e) { if ((e as NodeJS.ErrnoException)?.code !== "EEXIST") throw new Error(`cacheDir: cannot create ${cur} (${why(e)}); refusing to use a private cache that does not exist`); }
    let st;
    try { st = lstatSync(cur); } catch (e) { throw new Error(`cacheDir: cannot inspect ${cur} (${why(e)})`); }
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`cacheDir: ${cur} is ${st.isSymbolicLink() ? "a symlink" : "not a directory"}; refusing a private cache there`);
    if (uid !== undefined && st.uid !== uid) throw new Error(`cacheDir: ${cur} belongs to uid ${st.uid}, not ${uid}; refusing a private cache there`);
    // Exactly 0700: group/other bits removed AND the owner's rwx restored (a 0500 directory is private
    // but unusable, and every file a caller writes into it would fail).
    // Windows reports 0o666 for every directory and chmod cannot narrow it; the profile ACL keeps it private there.
    if (hasPosixModes() && (st.mode & 0o7777) !== 0o700) {
      try { chmodSync(cur, 0o700); } catch (e) { throw new Error(`cacheDir: cannot make ${cur} owner-only (${why(e)})`); }
    }
  }
  // The path as resolved must be the components just checked under the root as resolved: nothing
  // swapped a checked directory for a link between the checks.
  let real: string, rootReal: string;
  try { real = realpathSync(dir); rootReal = realpathSync(root); } catch (e) { throw new Error(`cacheDir: cannot resolve ${dir} (${why(e)})`); }
  if (real !== join(rootReal, ...parts)) throw new Error(`cacheDir: ${dir} resolves to ${real}, outside the checked path; refusing a private cache there`);
  const final = lstatSync(dir);
  invariant(final.isDirectory() && !final.isSymbolicLink() && (!hasPosixModes() || (final.mode & 0o777) === 0o700), `cacheDir: ${dir} is not an owner-only directory after setup (mode ${(final.mode & 0o777).toString(8)})`);
  return dir;
}

/** Where the isolated per-agent codex homes live: `<cacheRoot>/lifeos-codex-homes/<agent>`. */
export const CODEX_HOMES_DIRNAME = "lifeos-codex-homes";
export function codexHomesRoot(): string { return cacheDir(CODEX_HOMES_DIRNAME); }
