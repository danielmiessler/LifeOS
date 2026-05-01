"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ObserverModeProvider } from "@/contexts/ObserverModeContext";
import { AudioStreamProvider } from "@/contexts/AudioStreamContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AudioStreamProvider>
        <ObserverModeProvider>{children}</ObserverModeProvider>
      </AudioStreamProvider>
    </QueryClientProvider>
  );
}
