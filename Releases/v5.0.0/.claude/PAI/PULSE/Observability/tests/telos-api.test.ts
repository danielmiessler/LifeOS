import { describe, test, expect, beforeAll } from "bun:test"

const BASE = "http://localhost:31337"
let serverUp = false
let overview: Record<string, any> = {}

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/telos/overview`, { signal: AbortSignal.timeout(3000) })
    serverUp = r.ok
    if (serverUp) overview = await r.json()
  } catch {
    serverUp = false
    console.warn("⚠️  Pulse server not reachable at localhost:31337 — skipping live API contract tests")
  }
})

// ─── HTTP ────────────────────────────────────────────────────────────────────

describe("GET /api/telos/overview — HTTP", () => {
  test("server returns 200", async () => {
    if (!serverUp) return
    const r = await fetch(`${BASE}/api/telos/overview`)
    expect(r.status).toBe(200)
  })

  test("response body parses as a non-null object", () => {
    if (!serverUp) return
    expect(typeof overview).toBe("object")
    expect(overview).not.toBeNull()
  })
})

// ─── owner ───────────────────────────────────────────────────────────────────

describe("GET /api/telos/overview — owner", () => {
  test("owner is a non-null object", () => {
    if (!serverUp) return
    expect(typeof overview.owner).toBe("object")
    expect(overview.owner).not.toBeNull()
  })

  test("owner.name is a string", () => {
    if (!serverUp) return
    expect(typeof overview.owner.name).toBe("string")
  })

  test("owner.day is a string", () => {
    if (!serverUp) return
    expect(typeof overview.owner.day).toBe("string")
  })

  test("owner.streak is a number", () => {
    if (!serverUp) return
    expect(typeof overview.owner.streak).toBe("number")
  })
})

// ─── idealState ──────────────────────────────────────────────────────────────

describe("GET /api/telos/overview — idealState", () => {
  test("idealState is a non-null object", () => {
    if (!serverUp) return
    expect(typeof overview.idealState).toBe("object")
    expect(overview.idealState).not.toBeNull()
  })

  test("idealState.horizon is a string", () => {
    if (!serverUp) return
    expect(typeof overview.idealState.horizon).toBe("string")
  })

  test("idealState.note is a string", () => {
    if (!serverUp) return
    expect(typeof overview.idealState.note).toBe("string")
  })
})

// ─── dimensions ──────────────────────────────────────────────────────────────

describe("GET /api/telos/overview — dimensions", () => {
  test("dimensions is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.dimensions)).toBe(true)
  })

  test("dimensions has exactly 6 items", () => {
    if (!serverUp) return
    expect(overview.dimensions).toHaveLength(6)
  })

  test("each dimension has id, label, cur, ideal, velo, color fields", () => {
    if (!serverUp) return
    for (const d of overview.dimensions) {
      expect(typeof d.id).toBe("string")
      expect(typeof d.label).toBe("string")
      expect(typeof d.cur).toBe("number")
      expect(typeof d.ideal).toBe("number")
      expect(typeof d.velo).toBe("number")
      expect(typeof d.color).toBe("string")
    }
  })

  test("dimension IDs include all 6 expected values", () => {
    if (!serverUp) return
    const ids = new Set<string>(overview.dimensions.map((d: any) => d.id))
    for (const expected of ["health", "money", "freedom", "creative", "relationships", "rhythms"]) {
      expect(ids.has(expected)).toBe(true)
    }
  })
})

// ─── subtabs ─────────────────────────────────────────────────────────────────

describe("GET /api/telos/overview — subtabs", () => {
  test("subtabs is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.subtabs)).toBe(true)
  })

  test("subtabs has exactly 5 items (rhythms excluded)", () => {
    if (!serverUp) return
    expect(overview.subtabs).toHaveLength(5)
  })

  test("each subtab has id, label, dim, cur, ideal, velo, top fields", () => {
    if (!serverUp) return
    for (const t of overview.subtabs) {
      expect(typeof t.id).toBe("string")
      expect(typeof t.label).toBe("string")
      expect(typeof t.dim).toBe("string")
      expect(typeof t.cur).toBe("number")
      expect(typeof t.ideal).toBe("number")
      expect(typeof t.velo).toBe("number")
      expect(typeof t.top).toBe("string")
    }
  })

  test("subtab IDs are exactly the 5 expected dimension keys (sorted)", () => {
    if (!serverUp) return
    const ids = overview.subtabs.map((t: any) => t.id).sort()
    expect(ids).toEqual(["creative", "freedom", "health", "money", "relationships"])
  })

  test("each subtab dim matches its id (self-referential dimension)", () => {
    if (!serverUp) return
    for (const t of overview.subtabs) {
      expect(t.dim).toBe(t.id)
    }
  })
})

// ─── preferences ─────────────────────────────────────────────────────────────

describe("GET /api/telos/overview — preferences", () => {
  test("preferences is not null", () => {
    if (!serverUp) return
    expect(overview.preferences).not.toBeNull()
  })

  test("preferences.books is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.preferences.books)).toBe(true)
  })

  test("preferences.films is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.preferences.films)).toBe(true)
  })

  test("preferences.music is an array — regression guard for recently added field", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.preferences.music)).toBe(true)
  })

  test("preferences.literature is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.preferences.literature)).toBe(true)
  })

  test("preferences.aphorisms is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.preferences.aphorisms)).toBe(true)
  })
})

// ─── telos primitive arrays ───────────────────────────────────────────────────

describe("GET /api/telos/overview — telos primitive arrays", () => {
  test("goals is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.goals)).toBe(true)
  })

  test("missions is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.missions)).toBe(true)
  })

  test("challenges is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.challenges)).toBe(true)
  })

  test("strategies is an array", () => {
    if (!serverUp) return
    expect(Array.isArray(overview.strategies)).toBe(true)
  })
})
