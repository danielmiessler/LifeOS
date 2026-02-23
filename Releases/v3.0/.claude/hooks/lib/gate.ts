/**
 * PAI Activation Gate
 *
 * Import this as the FIRST import in any PAI hook to skip execution
 * when claude is invoked directly (without the 'pai' wrapper).
 *
 * Usage: import './lib/gate';
 *
 * The 'pai' CLI sets PAI_ACTIVE=1 before spawning claude.
 * Without it, hooks exit silently so bare 'claude' runs clean.
 */
if (process.env.PAI_ACTIVE !== '1') {
  process.exit(0);
}
