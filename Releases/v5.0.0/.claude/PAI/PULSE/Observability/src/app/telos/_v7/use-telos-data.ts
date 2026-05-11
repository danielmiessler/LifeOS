"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { localApiCall } from "@/lib/local-api";
import { TELOS as FALLBACK, type Telos } from "./data";

interface LiveTelos {
  problems?: Telos["problems"];
  missions?: Telos["missions"];
  challenges?: Telos["challenges"];
  goals?: Telos["goals"];
  strategies?: Telos["strategies"];
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
    ...(data?.problems?.length ? { problems: data.problems } : {}),
    ...(data?.missions?.length ? { missions: data.missions } : {}),
    ...(data?.challenges?.length ? { challenges: data.challenges } : {}),
    ...(data?.goals?.length ? { goals: data.goals } : {}),
    ...(data?.strategies?.length ? { strategies: data.strategies } : {}),
  };

  return { telos, refetch, error: error instanceof Error ? error.message : null };
}
