import { useChartData } from './useChartData';

/**
 * Composable for rendering chart data specific to a single agent.
 * Delegates to useChartData with agent filtering applied.
 *
 * @param agentName - The specific agent/source_app to track (format: "app:session")
 * @returns All chart data methods with agent filtering applied
 */
export function useAgentChartData(agentName: string) {
  return useChartData(agentName);
}
