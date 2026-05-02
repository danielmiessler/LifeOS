"use client";

import { useCallback, useEffect, useState } from "react";
import { TELOS as FALLBACK, type Telos } from "./data";

function mergeTelosData(fallback: Telos, api: Partial<Record<string, unknown>>): Telos {
  const merged: Telos = { ...fallback };

  if (api.owner && typeof api.owner === "object") {
    merged.owner = api.owner as Telos["owner"];
  }
  if (api.idealState && typeof api.idealState === "object") {
    merged.idealState = api.idealState as Telos["idealState"];
  }
  if (Array.isArray(api.dimensions) && api.dimensions.length > 0) {
    merged.dimensions = api.dimensions as Telos["dimensions"];
  }
  if (Array.isArray(api.problems) && api.problems.length > 0) {
    merged.problems = (api.problems as Array<Record<string, unknown>>).map((p) => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? ""),
      note: String(p.note ?? ""),
      severity: (["high", "med", "low"].includes(String(p.severity)) ? p.severity : "med") as "high" | "med" | "low",
      affects: Array.isArray(p.affects) ? (p.affects as string[]) : [],
    }));
  }
  if (Array.isArray(api.missions) && api.missions.length > 0) {
    merged.missions = (api.missions as Array<Record<string, unknown>>).map((m) => ({
      id: String(m.id ?? ""),
      title: String(m.title ?? ""),
      horizon: String(m.horizon ?? ""),
      active: Boolean(m.active),
      addresses: Array.isArray(m.addresses) ? (m.addresses as string[]) : [],
    }));
  }
  if (Array.isArray(api.goals) && api.goals.length > 0) {
    merged.goals = (api.goals as Array<Record<string, unknown>>).map((g) => ({
      id: String(g.id ?? ""),
      title: String(g.title ?? g.text ?? ""),
      kpi: String(g.kpi ?? ""),
      target: String(g.target ?? ""),
      pct: typeof g.pct === "number" ? g.pct : 0,
      delta: typeof g.delta === "number" ? g.delta : 0,
      dims: Array.isArray(g.dims) ? (g.dims as string[]) : [],
      metrics: Array.isArray(g.metrics) ? (g.metrics as string[]) : [],
    }));
  }
  if (Array.isArray(api.metrics) && api.metrics.length > 0) {
    merged.metrics = api.metrics as Telos["metrics"];
  }
  if (Array.isArray(api.challenges) && api.challenges.length > 0) {
    merged.challenges = (api.challenges as Array<Record<string, unknown>>).map((c) => ({
      id: String(c.id ?? ""),
      title: String(c.title ?? ""),
      note: String(c.note ?? ""),
      blocks: Array.isArray(c.blocks) ? (c.blocks as string[]) : [],
    }));
  }
  if (Array.isArray(api.strategies) && api.strategies.length > 0) {
    merged.strategies = (api.strategies as Array<Record<string, unknown>>).map((s) => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? ""),
      overcomes: Array.isArray(s.overcomes) ? (s.overcomes as string[]) : [],
      implements: Array.isArray(s.implements) ? (s.implements as string[]) : [],
      active: Boolean(s.active),
    }));
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
        return r.json() as Promise<Partial<Record<string, unknown>>>;
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
