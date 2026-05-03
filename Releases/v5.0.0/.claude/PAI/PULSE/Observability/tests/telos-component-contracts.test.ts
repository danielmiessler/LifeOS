import { describe, test, expect } from "bun:test"
import { TELOS as FALLBACK } from "../src/app/telos/_v7/data"

// The subtab IDs the API returns — SPARK_SEEDS in subtabs.tsx must have exactly these keys.
// If this list changes (API adds/renames a dimension), the SPARK_SEEDS object must be updated too.
const EXPECTED_SUBTAB_IDS = ["creative", "freedom", "health", "money", "relationships"]

// ─── PreferenceContext shape ──────────────────────────────────────────────────

describe("PreferenceContext — field presence", () => {
  test("FALLBACK preferences.books is an array", () => {
    expect(Array.isArray(FALLBACK.preferences.books)).toBe(true)
  })

  test("FALLBACK preferences.films is an array", () => {
    expect(Array.isArray(FALLBACK.preferences.films)).toBe(true)
  })

  test("FALLBACK preferences.music is an array — regression guard for recently added field", () => {
    expect(Array.isArray((FALLBACK.preferences as any).music)).toBe(true)
  })

  test("FALLBACK preferences.literature is an array", () => {
    expect(Array.isArray(FALLBACK.preferences.literature)).toBe(true)
  })

  test("FALLBACK preferences.books has at least 1 item", () => {
    expect(FALLBACK.preferences.books.length).toBeGreaterThanOrEqual(1)
  })

  test("FALLBACK preferences.films has at least 1 item", () => {
    expect(FALLBACK.preferences.films.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Subtabs shape ────────────────────────────────────────────────────────────

describe("FALLBACK subtabs — shape and count", () => {
  test("FALLBACK has exactly 5 subtabs", () => {
    expect(FALLBACK.subtabs).toHaveLength(5)
  })

  test("each subtab has a numeric velo field", () => {
    for (const t of FALLBACK.subtabs) {
      expect(typeof t.velo).toBe("number")
    }
  })

  test("each subtab has a non-empty label string", () => {
    for (const t of FALLBACK.subtabs) {
      expect(t.label.length).toBeGreaterThan(0)
    }
  })

  test("each subtab has numeric cur and ideal fields", () => {
    for (const t of FALLBACK.subtabs) {
      expect(typeof t.cur).toBe("number")
      expect(typeof t.ideal).toBe("number")
    }
  })
})

// ─── SPARK_SEEDS contract ─────────────────────────────────────────────────────

describe("SPARK_SEEDS contract — subtab ID alignment", () => {
  // SPARK_SEEDS in subtabs.tsx must have exactly these keys so each subtab
  // gets a distinct trend line. This test documents that requirement.
  // If the API returns different subtab IDs, both SPARK_SEEDS and this test need updating.
  test("FALLBACK subtab IDs match the expected set that SPARK_SEEDS must cover", () => {
    const fallbackIds = [...FALLBACK.subtabs].map((t) => t.id).sort()
    expect(fallbackIds).toEqual(EXPECTED_SUBTAB_IDS)
  })
})

// ─── Dimensions shape ─────────────────────────────────────────────────────────

describe("FALLBACK dimensions — shape and count", () => {
  test("FALLBACK has exactly 6 dimensions", () => {
    expect(FALLBACK.dimensions).toHaveLength(6)
  })

  test("dimension IDs include all 6 expected values", () => {
    const ids = new Set(FALLBACK.dimensions.map((d) => d.id))
    for (const expected of ["health", "money", "freedom", "creative", "relationships", "rhythms"]) {
      expect(ids.has(expected)).toBe(true)
    }
  })

  test("each dimension has a color field starting with --", () => {
    for (const d of FALLBACK.dimensions) {
      expect(d.color.startsWith("--")).toBe(true)
    }
  })
})

// ─── Goals shape ──────────────────────────────────────────────────────────────

describe("FALLBACK goals — required field presence", () => {
  test("every goal has a numeric pct field", () => {
    for (const g of FALLBACK.goals) {
      expect(typeof g.pct).toBe("number")
    }
  })

  test("every goal has a numeric delta field", () => {
    for (const g of FALLBACK.goals) {
      expect(typeof g.delta).toBe("number")
    }
  })

  test("every goal has an array dims field", () => {
    for (const g of FALLBACK.goals) {
      expect(Array.isArray(g.dims)).toBe(true)
    }
  })

  test("every goal has an array metrics field", () => {
    for (const g of FALLBACK.goals) {
      expect(Array.isArray(g.metrics)).toBe(true)
    }
  })
})

// ─── Challenges shape ─────────────────────────────────────────────────────────

describe("FALLBACK challenges — required field presence", () => {
  test("every challenge has an array blocks field", () => {
    for (const c of FALLBACK.challenges) {
      expect(Array.isArray(c.blocks)).toBe(true)
    }
  })

  test("every challenge has a string note field", () => {
    for (const c of FALLBACK.challenges) {
      expect(typeof c.note).toBe("string")
    }
  })
})
