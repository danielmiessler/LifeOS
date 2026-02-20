#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://api.navitia.io/v1/coverage/sncf";
const API_KEY = process.env.NAVITIA_API_KEY || "";

async function navitiaFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Navitia API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function formatPlace(place: any): string {
  const lines: string[] = [];
  const name = place.name || place.label || "Unknown";
  const id = place.id || "";
  const type = place.embedded_type || place.type || "";
  lines.push(`  ${name}`);
  lines.push(`    ID: ${id}`);
  lines.push(`    Type: ${type}`);
  if (place.stop_area) {
    const coord = place.stop_area.coord;
    if (coord) lines.push(`    Coordinates: ${coord.lat}, ${coord.lon}`);
  }
  return lines.join("\n");
}

function formatJourney(journey: any, index: number): string {
  const lines: string[] = [];
  const dep = journey.departure_date_time || "";
  const arr = journey.arrival_date_time || "";
  const dur = journey.duration ? `${Math.round(journey.duration / 60)} min` : "";
  const transfers = journey.nb_transfers ?? 0;

  lines.push(`Journey ${index + 1}: ${formatDateTime(dep)} -> ${formatDateTime(arr)} (${dur}, ${transfers} transfer(s))`);

  if (journey.sections) {
    for (const section of journey.sections) {
      const type = section.type || "";
      if (type === "public_transport") {
        const mode = section.display_informations?.commercial_mode || "";
        const code = section.display_informations?.code || "";
        const direction = section.display_informations?.direction || "";
        const fromName = section.from?.name || "";
        const toName = section.to?.name || "";
        const sDep = formatDateTime(section.departure_date_time || "");
        const sArr = formatDateTime(section.arrival_date_time || "");
        lines.push(`  ${mode} ${code} -> ${direction}`);
        lines.push(`    ${fromName} (${sDep}) -> ${toName} (${sArr})`);
      } else if (type === "transfer") {
        const durMin = section.duration ? `${Math.round(section.duration / 60)} min` : "";
        lines.push(`  Transfer: ${section.transfer_type || ""} (${durMin})`);
      } else if (type === "waiting") {
        const durMin = section.duration ? `${Math.round(section.duration / 60)} min` : "";
        lines.push(`  Waiting: ${durMin}`);
      } else if (type === "street_network" || type === "crow_fly") {
        const durMin = section.duration ? `${Math.round(section.duration / 60)} min` : "";
        if (section.duration > 0) {
          lines.push(`  Walk: ${durMin}`);
        }
      }
    }
  }

  return lines.join("\n");
}

function formatDeparture(dep: any): string {
  const lines: string[] = [];
  const time = formatDateTime(dep.stop_date_time?.departure_date_time || "");
  const info = dep.display_informations || {};
  const mode = info.commercial_mode || "";
  const code = info.code || "";
  const direction = info.direction || "";
  const network = info.network || "";
  lines.push(`  ${time} | ${mode} ${code} -> ${direction} (${network})`);
  return lines.join("\n");
}

function formatDateTime(dt: string): string {
  if (!dt || dt.length < 13) return dt;
  // Navitia format: YYYYMMDDTHHmmss
  const year = dt.slice(0, 4);
  const month = dt.slice(4, 6);
  const day = dt.slice(6, 8);
  const hour = dt.slice(9, 11);
  const min = dt.slice(11, 13);
  return `${year}-${month}-${day} ${hour}:${min}`;
}

const server = new McpServer({
  name: "sncf-navitia",
  version: "1.0.0",
});

// Tool 1: Search places/stations
server.tool(
  "sncf_search_places",
  "Search for French railway stations and places by name using the SNCF/Navitia API",
  {
    query: z.string().describe("Search query (station or place name, e.g. 'Paris Gare de Lyon')"),
  },
  async ({ query }) => {
    if (!API_KEY) {
      return { content: [{ type: "text", text: "Error: NAVITIA_API_KEY environment variable is not set." }] };
    }

    try {
      const data = await navitiaFetch("/places", { q: query });
      const places = data.places || [];

      if (places.length === 0) {
        return { content: [{ type: "text", text: `No places found for "${query}".` }] };
      }

      const formatted = places.map(formatPlace).join("\n\n");
      return {
        content: [{ type: "text", text: `Found ${places.length} result(s) for "${query}":\n\n${formatted}` }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error searching places: ${error.message}` }] };
    }
  }
);

// Tool 2: Get journeys between two locations
server.tool(
  "sncf_get_journeys",
  "Get train journey options between two locations. Use station IDs from sncf_search_places for best results.",
  {
    from: z.string().describe("Origin station ID (e.g. 'stop_area:SNCF:87686006') or place name"),
    to: z.string().describe("Destination station ID (e.g. 'stop_area:SNCF:87751008') or place name"),
    datetime: z.string().optional().describe("Departure datetime in YYYYMMDDTHHmmss format (e.g. '20260215T080000'). Defaults to now."),
  },
  async ({ from, to, datetime }) => {
    if (!API_KEY) {
      return { content: [{ type: "text", text: "Error: NAVITIA_API_KEY environment variable is not set." }] };
    }

    try {
      const params: Record<string, string> = { from, to };
      if (datetime) params.datetime = datetime;

      const data = await navitiaFetch("/journeys", params);
      const journeys = data.journeys || [];

      if (journeys.length === 0) {
        return { content: [{ type: "text", text: `No journeys found from "${from}" to "${to}".` }] };
      }

      const formatted = journeys.map(formatJourney).join("\n\n");
      return {
        content: [{ type: "text", text: `Found ${journeys.length} journey(s):\n\n${formatted}` }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error getting journeys: ${error.message}` }] };
    }
  }
);

// Tool 3: Get departures from a station
server.tool(
  "sncf_get_departures",
  "Get upcoming departures from a specific station. Use station IDs from sncf_search_places.",
  {
    stop_id: z.string().describe("Station/stop area ID (e.g. 'stop_area:SNCF:87686006')"),
    count: z.number().optional().describe("Number of departures to return (default 10, max 50)"),
    datetime: z.string().optional().describe("Starting datetime in YYYYMMDDTHHmmss format. Defaults to now."),
  },
  async ({ stop_id, count, datetime }) => {
    if (!API_KEY) {
      return { content: [{ type: "text", text: "Error: NAVITIA_API_KEY environment variable is not set." }] };
    }

    try {
      const params: Record<string, string> = {};
      if (count) params.count = String(Math.min(count, 50));
      if (datetime) params.datetime = datetime;

      const data = await navitiaFetch(`/stop_areas/${stop_id}/departures`, params);
      const departures = data.departures || [];

      if (departures.length === 0) {
        return { content: [{ type: "text", text: `No departures found for station "${stop_id}".` }] };
      }

      const formatted = departures.map(formatDeparture).join("\n");
      return {
        content: [{ type: "text", text: `Departures from ${stop_id}:\n\n${formatted}` }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error getting departures: ${error.message}` }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
