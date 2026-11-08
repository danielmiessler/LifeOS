import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AlgorithmState } from "@/types/algorithm";
import { SessionExpanded } from "./WorkBoard";

// An untracked session (no ISA) as observability.ts builds it. Started 10 minutes before its last activity.
const START = Date.now() - 6 * 60 * 60 * 1000;
function session(over: Partial<AlgorithmState>): AlgorithmState {
  return {
    active: false, sessionId: "synthetic-session", taskDescription: "Synthetic task", currentPhase: "COMPLETE",
    phaseStartedAt: START + 10 * 60 * 1000, algorithmStartedAt: START, criteria: [], agents: [], capabilities: [],
    progress: { done: 0, total: 0 }, rawTask: "synthetic ask", tracked: false, climb: [], ...over,
  };
}
const timing = (s: AlgorithmState) => renderToStaticMarkup(<SessionExpanded s={s} bare />).replace(/<[^>]+>/g, "");

describe("SessionExpanded timing line", () => {
  test("a completed session is not shown as running and shows how long it ran", () => {
    const text = timing(session({ completedAt: START + 10 * 60 * 1000 }));
    expect(text).not.toContain("running");
    expect(text).toContain("ended after 10m 0s");
  });

  test("an active session still shows running and its elapsed time", () => {
    const text = timing(session({ active: true, currentPhase: "OBSERVE" }));
    expect(text).toMatch(/running 6h 0m/);
  });

  test("an inactive session with no recorded end is neither running nor called finished", () => {
    // observability.ts gives a stale session a completedAt (its last activity) without phase COMPLETE.
    const text = timing(session({ currentPhase: "OBSERVE", completedAt: START + 10 * 60 * 1000 }));
    expect(text).not.toContain("running");
    expect(text).not.toContain("ended after");
    expect(text).toContain("end not recorded");
  });
});
