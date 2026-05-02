"use client";

import { useCallback, useEffect, useState } from "react";
import { TELOS as FALLBACK, type Telos } from "./data";

type Dict = Record<string, unknown>;

const asString = (v: unknown): string => String(v ?? "");
const asNumber = (v: unknown): number => (typeof v === "number" ? v : 0);
const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const asNumberArray = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : []);

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(String(v)) ? (v as T) : fallback;

function mergeTelosData(fallback: Telos, api: Partial<Dict>): Telos {
  const merged: Telos = { ...fallback };

  if (api.owner && typeof api.owner === "object") {
    const o = api.owner as Dict;
    merged.owner = {
      name: asString(o.name),
      day: asString(o.day),
      streak: asNumber(o.streak),
    };
  }

  if (api.idealState && typeof api.idealState === "object") {
    const i = api.idealState as Dict;
    merged.idealState = {
      horizon: asString(i.horizon),
      note: asString(i.note),
    };
  }

  if (Array.isArray(api.dimensions) && api.dimensions.length > 0) {
    merged.dimensions = (api.dimensions as Dict[]).map((d) => ({
      id: asString(d.id),
      label: asString(d.label),
      cur: asNumber(d.cur),
      ideal: asNumber(d.ideal),
      velo: asNumber(d.velo),
      color: asString(d.color),
    }));
  }

  if (Array.isArray(api.snapshot) && api.snapshot.length > 0) {
    merged.snapshot = (api.snapshot as Dict[]).map((s) => ({
      id: asString(s.id),
      label: asString(s.label),
      v: asNumber(s.v),
      of: asNumber(s.of),
    }));
  }

  if (Array.isArray(api.problems) && api.problems.length > 0) {
    merged.problems = (api.problems as Dict[]).map((p) => ({
      id: asString(p.id),
      title: asString(p.title),
      note: asString(p.note),
      severity: oneOf(p.severity, ["high", "med", "low"] as const, "med"),
      affects: asStringArray(p.affects),
    }));
  }

  if (Array.isArray(api.missions) && api.missions.length > 0) {
    merged.missions = (api.missions as Dict[]).map((m) => ({
      id: asString(m.id),
      title: asString(m.title),
      horizon: asString(m.horizon),
      active: Boolean(m.active),
      addresses: asStringArray(m.addresses),
    }));
  }

  if (Array.isArray(api.goals) && api.goals.length > 0) {
    merged.goals = (api.goals as Dict[]).map((g) => ({
      id: asString(g.id),
      title: asString(g.title),
      kpi: asString(g.kpi),
      target: asString(g.target),
      pct: asNumber(g.pct),
      delta: asNumber(g.delta),
      dims: asStringArray(g.dims),
      metrics: asStringArray(g.metrics),
    }));
  }

  if (Array.isArray(api.metrics) && api.metrics.length > 0) {
    merged.metrics = (api.metrics as Dict[]).map((m) => ({
      id: asString(m.id),
      label: asString(m.label),
      value: asString(m.value),
      unit: asString(m.unit),
      trend: asNumber(m.trend),
      spark: asNumberArray(m.spark),
      feeds: asStringArray(m.feeds),
      color: asString(m.color),
    }));
  }

  if (Array.isArray(api.challenges) && api.challenges.length > 0) {
    merged.challenges = (api.challenges as Dict[]).map((c) => ({
      id: asString(c.id),
      title: asString(c.title),
      note: asString(c.note),
      blocks: asStringArray(c.blocks),
    }));
  }

  if (Array.isArray(api.strategies) && api.strategies.length > 0) {
    merged.strategies = (api.strategies as Dict[]).map((s) => ({
      id: asString(s.id),
      title: asString(s.title),
      overcomes: asStringArray(s.overcomes),
      implements: asStringArray(s.implements),
      active: Boolean(s.active),
    }));
  }

  if (Array.isArray(api.projects) && api.projects.length > 0) {
    merged.projects = (api.projects as Dict[]).map((p) => ({
      id: asString(p.id),
      title: asString(p.title),
      strategy: asString(p.strategy),
      dims: asStringArray(p.dims),
      status: oneOf(p.status, ["green", "amber", "red"] as const, "green"),
      work: Array.isArray(p.work)
        ? (p.work as Dict[]).map((w) => ({
            id: asString(w.id),
            title: asString(w.title),
            strategy: asString(w.strategy),
            eta: asString(w.eta),
            status: oneOf(w.status, ["green", "amber", "red"] as const, "green"),
            owner: asString(w.owner),
          }))
        : [],
      team: Array.isArray(p.team) ? (p.team as string[]) : undefined,
    }));
  }

  if (Array.isArray(api.team) && api.team.length > 0) {
    merged.team = (api.team as Dict[]).map((t) => ({
      id: asString(t.id),
      name: asString(t.name),
      role: asString(t.role),
      kind: oneOf(t.kind, ["human", "agent"] as const, "human"),
      owns: asStringArray(t.owns),
      avatar: asString(t.avatar),
      note: asString(t.note),
    }));
  }

  if (Array.isArray(api.budget) && api.budget.length > 0) {
    merged.budget = (api.budget as Dict[]).map((b) => ({
      id: asString(b.id),
      kind: oneOf(b.kind, ["money", "time", "attention"] as const, "money"),
      label: asString(b.label),
      value: asString(b.value),
      of: asString(b.of),
      pct: asNumber(b.pct),
      funds: asStringArray(b.funds),
      note: asString(b.note),
      warn: typeof b.warn === "boolean" ? b.warn : undefined,
    }));
  }

  if (Array.isArray(api.recommendations) && api.recommendations.length > 0) {
    merged.recommendations = (api.recommendations as Dict[]).map((r) => ({
      id: asString(r.id),
      action: asString(r.action),
      because: asString(r.because),
      upstream: asStringArray(r.upstream),
      effort: asString(r.effort),
      impact: oneOf(r.impact, ["high", "med", "low"] as const, "med"),
    }));
  }

  if (api.stranded && typeof api.stranded === "object") {
    const s = api.stranded as Dict;
    merged.stranded = {
      work_no_goal: Array.isArray(s.work_no_goal)
        ? (s.work_no_goal as Dict[]).map((w) => ({
            id: asString(w.id),
            title: asString(w.title),
            owner: asString(w.owner),
            age: asString(w.age),
          }))
        : [],
      goals_no_strategy: Array.isArray(s.goals_no_strategy)
        ? (s.goals_no_strategy as Dict[]).map((g) => ({
            id: asString(g.id),
            title: asString(g.title),
            reason: asString(g.reason),
          }))
        : [],
      strategies_idle: Array.isArray(s.strategies_idle)
        ? (s.strategies_idle as Dict[]).map((st) => ({
            id: asString(st.id),
            title: asString(st.title),
            reason: asString(st.reason),
          }))
        : [],
    };
  }

  if (Array.isArray(api.subtabs) && api.subtabs.length > 0) {
    merged.subtabs = (api.subtabs as Dict[]).map((s) => ({
      id: asString(s.id),
      label: asString(s.label),
      dim: asString(s.dim),
      cur: asNumber(s.cur),
      ideal: asNumber(s.ideal),
      velo: asNumber(s.velo),
      target: asString(s.target),
      top: asString(s.top),
    }));
  }

  if (api.preferences && typeof api.preferences === "object") {
    const p = api.preferences as Dict;
    merged.preferences = {
      books: asStringArray(p.books),
      films: asStringArray(p.films),
      anime: asStringArray(p.anime),
      characters: asStringArray(p.characters),
      aphorisms: asStringArray(p.aphorisms),
      hobbies: asStringArray(p.hobbies),
      literature: asStringArray(p.literature),
    };
  }

  if (api.narrativeSeed && typeof api.narrativeSeed === "object") {
    const n = api.narrativeSeed as Dict;
    merged.narrativeSeed = {
      days_into: asNumber(n.days_into),
      push_name: asString(n.push_name),
      current_work: asString(n.current_work),
      via_strategy: asString(n.via_strategy),
      addresses: asString(n.addresses),
      moves_goal: asString(n.moves_goal),
      serves_mission: asString(n.serves_mission),
    };
  }

  return merged;
}

export function useTelosData(): { telos: Telos | null; refetch: () => void; error: string | null } {
  const [telos, setTelos] = useState<Telos>(FALLBACK);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    fetch("/api/telos/overview")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Partial<Dict>>;
      })
      .then((data) => {
        setTelos(mergeTelosData(FALLBACK, data));
        setError(null);
      })
      .catch((err: unknown) => {
        console.warn("[useTelosData] API fetch failed, using fallback:", err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [version]);

  return { telos, refetch, error };
}
