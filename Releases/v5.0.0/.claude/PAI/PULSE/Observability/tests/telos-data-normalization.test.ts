import { describe, test, expect } from "bun:test"
import { TELOS as FALLBACK, type Telos } from "../src/app/telos/_v7/data"

// Documents the merge contract from use-telos-data.ts as a pure testable function.
// This is intentionally a duplicate of the inline hook logic — if the hook changes,
// these tests should also be updated to keep them in sync.
function mergeTelosData(fallback: Telos, data: Record<string, any>): Telos {
  return {
    ...fallback,
    ...(data.owner != null && { owner: data.owner }),
    ...(data.idealState != null && { idealState: data.idealState }),
    ...(data.dimensions != null && { dimensions: data.dimensions }),
    ...(data.snapshot != null && { snapshot: data.snapshot }),
    ...(data.problems != null && data.problems.length > 0 && {
      problems: data.problems.map((p: any) => ({ severity: "med" as const, affects: [], ...p })),
    }),
    ...(data.missions != null && data.missions.length > 0 && {
      missions: data.missions.map((m: any) => ({ horizon: "", active: true, addresses: [], ...m })),
    }),
    ...(data.goals != null && data.goals.length > 0 && {
      goals: data.goals.map((g: any) => ({ kpi: "", target: "", pct: 0, delta: 0, dims: [], metrics: [], ...g })),
    }),
    ...(data.challenges != null && data.challenges.length > 0 && {
      challenges: data.challenges.map((c: any) => ({ note: "", blocks: [], ...c })),
    }),
    ...(data.strategies != null && data.strategies.length > 0 && {
      strategies: data.strategies.map((s: any) => ({ overcomes: [], implements: [], active: true, ...s })),
    }),
    ...(data.subtabs != null && { subtabs: data.subtabs }),
    ...(data.preferences != null && { preferences: data.preferences }),
  }
}

// ─── preferences ─────────────────────────────────────────────────────────────

describe("mergeTelosData — preferences", () => {
  test("preferences: null → uses fallback preferences unchanged", () => {
    const merged = mergeTelosData(FALLBACK, { preferences: null })
    expect(merged.preferences).toBe(FALLBACK.preferences)
  })

  test("preferences: valid object → replaces fallback", () => {
    const custom = {
      books: ["Book A"], films: [], anime: [], characters: [],
      aphorisms: [], hobbies: [], literature: [], music: [],
    }
    const merged = mergeTelosData(FALLBACK, { preferences: custom })
    expect(merged.preferences.books).toEqual(["Book A"])
  })
})

// ─── goals ───────────────────────────────────────────────────────────────────

describe("mergeTelosData — goals", () => {
  test("goals: null → uses fallback goals", () => {
    const merged = mergeTelosData(FALLBACK, { goals: null })
    expect(merged.goals).toBe(FALLBACK.goals)
  })

  test("goals: [] → uses fallback goals (empty array treated as not provided)", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [] })
    expect(merged.goals).toBe(FALLBACK.goals)
  })

  test("goals with missing pct → pct defaults to 0", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [{ id: "G0", title: "Test Goal" }] })
    expect(merged.goals[0].pct).toBe(0)
  })

  test("goals with missing delta → delta defaults to 0", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [{ id: "G0", title: "Test Goal" }] })
    expect(merged.goals[0].delta).toBe(0)
  })

  test("goals with missing dims → dims defaults to []", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [{ id: "G0", title: "Test Goal" }] })
    expect(merged.goals[0].dims).toEqual([])
  })

  test("goals with missing metrics → metrics defaults to []", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [{ id: "G0", title: "Test Goal" }] })
    expect(merged.goals[0].metrics).toEqual([])
  })

  test("goals with provided pct → provided value is not overwritten", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [{ id: "G0", title: "Test", pct: 42 }] })
    expect(merged.goals[0].pct).toBe(42)
  })

  test("goals with provided dims → provided dims are not overwritten", () => {
    const merged = mergeTelosData(FALLBACK, { goals: [{ id: "G0", title: "Test", dims: ["health"] }] })
    expect(merged.goals[0].dims).toEqual(["health"])
  })
})

// ─── challenges ──────────────────────────────────────────────────────────────

describe("mergeTelosData — challenges", () => {
  test("challenges with missing blocks → blocks defaults to []", () => {
    const merged = mergeTelosData(FALLBACK, { challenges: [{ id: "C0", title: "Test Challenge" }] })
    expect(merged.challenges[0].blocks).toEqual([])
  })

  test("challenges with missing note → note defaults to ''", () => {
    const merged = mergeTelosData(FALLBACK, { challenges: [{ id: "C0", title: "Test Challenge" }] })
    expect(merged.challenges[0].note).toBe("")
  })

  test("challenges: [] → uses fallback challenges", () => {
    const merged = mergeTelosData(FALLBACK, { challenges: [] })
    expect(merged.challenges).toBe(FALLBACK.challenges)
  })
})

// ─── missions ────────────────────────────────────────────────────────────────

describe("mergeTelosData — missions", () => {
  test("missions with missing horizon → horizon defaults to ''", () => {
    const merged = mergeTelosData(FALLBACK, { missions: [{ id: "M0", title: "Test Mission" }] })
    expect(merged.missions[0].horizon).toBe("")
  })

  test("missions with missing active → active defaults to true", () => {
    const merged = mergeTelosData(FALLBACK, { missions: [{ id: "M0", title: "Test Mission" }] })
    expect(merged.missions[0].active).toBe(true)
  })

  test("missions with provided horizon → horizon is preserved", () => {
    const merged = mergeTelosData(FALLBACK, { missions: [{ id: "M0", title: "Test", horizon: "2030" }] })
    expect(merged.missions[0].horizon).toBe("2030")
  })
})

// ─── problems ────────────────────────────────────────────────────────────────

describe("mergeTelosData — problems", () => {
  test("problems with missing severity → severity defaults to 'med'", () => {
    const merged = mergeTelosData(FALLBACK, { problems: [{ id: "P0", title: "Test Problem" }] })
    expect(merged.problems[0].severity).toBe("med")
  })

  test("problems with missing affects → affects defaults to []", () => {
    const merged = mergeTelosData(FALLBACK, { problems: [{ id: "P0", title: "Test Problem" }] })
    expect(merged.problems[0].affects).toEqual([])
  })
})

// ─── owner ───────────────────────────────────────────────────────────────────

describe("mergeTelosData — owner", () => {
  test("owner provided → replaces fallback owner name", () => {
    const merged = mergeTelosData(FALLBACK, { owner: { name: "Alex", day: "Mon", streak: 5 } })
    expect(merged.owner.name).toBe("Alex")
  })

  test("owner: null → uses fallback owner unchanged", () => {
    const merged = mergeTelosData(FALLBACK, { owner: null })
    expect(merged.owner).toBe(FALLBACK.owner)
  })
})

// ─── structural guarantees ────────────────────────────────────────────────────

describe("mergeTelosData — structural guarantees", () => {
  test("empty API data → dimensions from fallback is always present", () => {
    const merged = mergeTelosData(FALLBACK, {})
    expect(Array.isArray(merged.dimensions)).toBe(true)
  })

  test("empty API data → subtabs from fallback is always present", () => {
    const merged = mergeTelosData(FALLBACK, {})
    expect(Array.isArray(merged.subtabs)).toBe(true)
  })

  test("empty API data → preferences from fallback is always present", () => {
    const merged = mergeTelosData(FALLBACK, {})
    expect(merged.preferences).not.toBeNull()
  })

  test("all null API fields → merged result has all required Telos keys", () => {
    const merged = mergeTelosData(FALLBACK, {
      owner: null, idealState: null, dimensions: null, goals: null,
      missions: null, problems: null, challenges: null, strategies: null,
      subtabs: null, preferences: null,
    })
    expect(Array.isArray(merged.goals)).toBe(true)
    expect(Array.isArray(merged.missions)).toBe(true)
    expect(Array.isArray(merged.dimensions)).toBe(true)
    expect(merged.owner).not.toBeNull()
    expect(merged.preferences).not.toBeNull()
  })
})
