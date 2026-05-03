"use client";

import { useCallback, useEffect, useState } from "react";
import { TELOS as FALLBACK, type Telos } from "./data";

export function useTelosData(): { telos: Telos; refetch: () => void; error: string | null } {
  const [telos, setTelos] = useState<Telos>(FALLBACK);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/telos/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        // Merge live data over fallback — API returns null for fields not yet wired;
        // fallback fills the gaps so the UI never breaks on partial data.
        const merged: Telos = {
          ...FALLBACK,
          ...(data.owner != null && { owner: data.owner }),
          ...(data.idealState != null && { idealState: data.idealState }),
          ...(data.dimensions != null && { dimensions: data.dimensions }),
          ...(data.snapshot != null && { snapshot: data.snapshot }),
          ...(data.problems != null && data.problems.length > 0 && { problems: data.problems }),
          ...(data.missions != null && data.missions.length > 0 && { missions: data.missions }),
          ...(data.goals != null && data.goals.length > 0 && { goals: data.goals }),
          ...(data.metrics != null && { metrics: data.metrics }),
          ...(data.challenges != null && data.challenges.length > 0 && { challenges: data.challenges }),
          ...(data.strategies != null && data.strategies.length > 0 && { strategies: data.strategies }),
          ...(data.projects != null && { projects: data.projects }),
          ...(data.team != null && { team: data.team }),
          ...(data.budget != null && { budget: data.budget }),
          ...(data.recommendations != null && { recommendations: data.recommendations }),
          ...(data.stranded != null && { stranded: data.stranded }),
          ...(data.subtabs != null && { subtabs: data.subtabs }),
          ...(data.preferences != null && { preferences: data.preferences }),
          ...(data.narrativeSeed != null && { narrativeSeed: data.narrativeSeed }),
        };
        setTelos(merged);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // Fall back to sample data on any error so the UI stays functional
        setTelos(FALLBACK);
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  return { telos, refetch, error };
}
