/**
 * Tests for V4Outage error detection.
 * Validates that single non-fatal errors are tolerated while engine outages
 * (>= 50% errors on candidates) and fatal errors fail the stage.
 *
 * Issue #2789
 */
import { describe, expect, test } from "bun:test";
import { isV4Outage } from "./V4Outage";

describe("isV4Outage error detection (#2789)", () => {
  test("clean run with no errors is not an outage", () => {
    const res = { detect: { candidates: 30, written: 30, errors: 0 }, diagnose: { candidates: 20, errors: 0 }, errors: [] };
    expect(isV4Outage(res).failed).toBe(false);
  });

  test("single non-fatal errors (< 50%) are tolerated", () => {
    const res = { detect: { candidates: 30, errors: 2 }, diagnose: { candidates: 20, errors: 1 }, errors: [] };
    expect(isV4Outage(res).failed).toBe(false);
  });

  test("detect engine total outage (e.g. 30/30 errors) triggers failure", () => {
    const res = { detect: { candidates: 30, written: 30, errors: 30 }, diagnose: { candidates: 0, errors: 0 }, errors: [] };
    const outage = isV4Outage(res);
    expect(outage.failed).toBe(true);
    expect(outage.reason).toContain("detect outage: 30/30 candidate errors");
  });

  test("diagnose engine outage (>= 50% errors) triggers failure", () => {
    const res = { detect: { candidates: 30, errors: 0 }, diagnose: { candidates: 10, errors: 5 }, errors: [] };
    const outage = isV4Outage(res);
    expect(outage.failed).toBe(true);
    expect(outage.reason).toContain("diagnose outage: 5/10 candidate errors");
  });

  test("explicit error entries trigger failure", () => {
    const res = { errors: ["api.cloudflare.com timeout"] };
    const outage = isV4Outage(res);
    expect(outage.failed).toBe(true);
    expect(outage.reason).toBe("api.cloudflare.com timeout");
  });

  test("zero candidates (nothing to process) is not an outage", () => {
    const res = { detect: { candidates: 0, errors: 0 }, diagnose: { candidates: 0, errors: 0 }, errors: [] };
    expect(isV4Outage(res).failed).toBe(false);
  });
});
