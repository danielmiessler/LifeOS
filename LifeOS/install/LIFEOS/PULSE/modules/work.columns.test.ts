/**
 * Verifies that deriveColumn checks configured KANBAN_COLUMNS before applying
 * LEGACY_STATUS_ALIASES, allowing custom columns matching raw statuses (e.g. Ready).
 *
 * Issue #2796
 */
import { describe, expect, test } from "bun:test";
import { deriveColumn } from "./work.ts";

const columnsWithReady = ["Triage", "Ready", "Queued", "Blocked", "In-Progress", "In-Review", "Complete"];
const defaultColumns = ["Queued", "Blocked", "In-Progress", "In-Review", "Complete"];

describe("deriveColumn", () => {
  test("a configured column matching raw status takes precedence over legacy alias", () => {
    expect(deriveColumn({ labels: ["Status:ready"], state: "OPEN" }, columnsWithReady)).toBe("Ready");
  });

  test("legacy aliases still apply when no configured column matches", () => {
    expect(deriveColumn({ labels: ["Status:ready"], state: "OPEN" }, defaultColumns)).toBe("Queued");
  });
});