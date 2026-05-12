"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { localApiCall } from "@/lib/local-api";
import { TELOS as FALLBACK, type Telos } from "./data";

interface LiveTelos {
  owner?: Telos["owner"] | null;
  idealState?: Telos["idealState"] | null;
  dimensions?: Telos["dimensions"] | null;
  problems?: Telos["problems"];
  missions?: Telos["missions"];
  challenges?: Telos["challenges"];
  goals?: Telos["goals"];
  strategies?: Telos["strategies"];
  metrics?: Telos["metrics"] | null;
  projects?: Telos["projects"] | null;
  team?: Telos["team"] | null;
  budget?: Telos["budget"] | null;
  stranded?: Telos["stranded"] | null;
  subtabs?: Telos["subtabs"] | null;
  recommendations?: Telos["recommendations"] | null;
  preferences?: Telos["preferences"] | null;
}

export function useTelosData(): { telos: Telos | null; refetch: () => void; error: string | null } {
  const { data, refetch: refetchQuery, error } = useQuery<LiveTelos>({
    queryKey: ["telos"],
    queryFn: () => localApiCall<LiveTelos>("/api/telos/overview"),
    refetchInterval: 60_000,
    retry: 1,
  });

  const refetch = useCallback(() => { void refetchQuery(); }, [refetchQuery]);

  const telos: Telos = {
    ...FALLBACK,
    ...(data?.owner ? { owner: data.owner } : {}),
    ...(data?.idealState ? { idealState: data.idealState } : {}),
    ...(data?.dimensions?.length ? { dimensions: data.dimensions } : {}),
    ...(data?.problems?.length ? { problems: data.problems } : {}),
    ...(data?.missions?.length ? { missions: data.missions } : {}),
    ...(data?.challenges?.length ? { challenges: data.challenges } : {}),
    ...(data?.goals?.length ? { goals: data.goals } : {}),
    ...(data?.strategies?.length ? { strategies: data.strategies } : {}),
    ...(data?.metrics?.length ? { metrics: data.metrics } : {}),
    ...(data?.projects?.length ? { projects: data.projects } : {}),
    ...(data?.team?.length ? { team: data.team } : {}),
    ...(data?.budget?.length ? { budget: data.budget } : {}),
    ...(data?.stranded ? { stranded: data.stranded } : {}),
    ...(data?.subtabs?.length ? { subtabs: data.subtabs } : {}),
    ...(data?.recommendations?.length ? { recommendations: data.recommendations } : {}),
    ...(data?.preferences ? { preferences: data.preferences } : {}),
  };

  return { telos, refetch, error: error instanceof Error ? error.message : null };
}
