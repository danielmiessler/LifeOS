/**
 * V4Outage — evaluates whether an Errata v4 pass suffered an engine outage or failure.
 *
 * Single errors remain non-fatal for shadow stages, but when detect or diagnose fails
 * on at least half of its candidates, or when unhandled errors are returned, the stage
 * is flagged as failed so that scheduled jobs exit non-zero and raise a Vigil alert.
 *
 * Public issue #2789.
 */

export interface V4StageResult {
  errors?: string[];
  detect?: { candidates?: number; written?: number; errors?: number };
  diagnose?: { candidates?: number; written?: number; errors?: number };
}

export interface V4OutageCheck {
  failed: boolean;
  reason?: string;
}

/**
 * Checks whether the v4 stage result represents an engine outage or fatal error.
 * Tolerates single non-fatal errors; flags outages when errors >= 50% of candidates.
 */
export function isV4Outage(result: unknown): V4OutageCheck {
  if (!result || typeof result !== "object") return { failed: false };
  const r = result as V4StageResult;

  if (Array.isArray(r.errors) && r.errors.length > 0) {
    return { failed: true, reason: r.errors.join("; ") };
  }

  const detect = r.detect;
  if (
    typeof detect?.candidates === "number" &&
    detect.candidates > 0 &&
    typeof detect?.errors === "number" &&
    detect.errors >= Math.ceil(detect.candidates / 2)
  ) {
    return {
      failed: true,
      reason: `detect outage: ${detect.errors}/${detect.candidates} candidate errors`,
    };
  }

  const diagnose = r.diagnose;
  if (
    typeof diagnose?.candidates === "number" &&
    diagnose.candidates > 0 &&
    typeof diagnose?.errors === "number" &&
    diagnose.errors >= Math.ceil(diagnose.candidates / 2)
  ) {
    return {
      failed: true,
      reason: `diagnose outage: ${diagnose.errors}/${diagnose.candidates} candidate errors`,
    };
  }

  return { failed: false };
}
