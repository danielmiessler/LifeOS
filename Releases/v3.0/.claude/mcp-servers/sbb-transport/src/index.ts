#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://transport.opendata.ch/v1";

const server = new McpServer({
  name: "sbb-transport",
  version: "1.0.0",
});

// --- Tool: sbb_search_stations ---
server.tool(
  "sbb_search_stations",
  "Search for Swiss public transport stations by name",
  {
    query: z.string().describe("Station name to search for (e.g. 'Zurich', 'Bern')"),
  },
  async ({ query }) => {
    const url = `${BASE_URL}/locations?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text" as const, text: `API error: ${res.status} ${res.statusText}` }] };
    }
    const data = await res.json();
    const stations = (data.stations || []).map((s: any) => ({
      name: s.name,
      id: s.id,
      coordinate: s.coordinate,
    }));

    if (stations.length === 0) {
      return { content: [{ type: "text" as const, text: `No stations found for "${query}"` }] };
    }

    const lines = stations.map(
      (s: any) => `${s.name} (ID: ${s.id}) [${s.coordinate?.x ?? "?"}, ${s.coordinate?.y ?? "?"}]`
    );
    return {
      content: [{ type: "text" as const, text: `Found ${stations.length} station(s):\n\n${lines.join("\n")}` }],
    };
  }
);

// --- Tool: sbb_get_connections ---
server.tool(
  "sbb_get_connections",
  "Get train/public transport connections between two Swiss stations",
  {
    from: z.string().describe("Departure station name (e.g. 'Zurich HB')"),
    to: z.string().describe("Arrival station name (e.g. 'Bern')"),
    datetime: z
      .string()
      .optional()
      .describe("Optional departure date/time in format 'YYYY-MM-DD HH:MM' (e.g. '2026-02-14 08:30')"),
    isArrivalTime: z
      .boolean()
      .optional()
      .describe("If true, datetime is treated as desired arrival time instead of departure"),
  },
  async ({ from, to, datetime, isArrivalTime }) => {
    const params = new URLSearchParams({ from, to });

    if (datetime) {
      const [date, time] = datetime.split(" ");
      if (date) params.set("date", date);
      if (time) params.set("time", time);
    }
    if (isArrivalTime) {
      params.set("isArrivalTime", "1");
    }

    const url = `${BASE_URL}/connections?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text" as const, text: `API error: ${res.status} ${res.statusText}` }] };
    }
    const data = await res.json();
    const connections = data.connections || [];

    if (connections.length === 0) {
      return {
        content: [{ type: "text" as const, text: `No connections found from "${from}" to "${to}"` }],
      };
    }

    const formatted = connections.map((c: any, i: number) => {
      const dep = c.from?.departure ? new Date(c.from.departure).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : "?";
      const arr = c.to?.arrival ? new Date(c.to.arrival).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : "?";
      const duration = c.duration || "?";
      const transfers = c.transfers ?? "?";
      const depPlatform = c.from?.platform || "-";
      const arrPlatform = c.to?.platform || "-";
      const depDelay = c.from?.delay && c.from.delay > 0 ? ` (+${c.from.delay}min)` : "";

      const sections = (c.sections || [])
        .map((s: any) => {
          if (!s.journey) return null;
          const cat = s.journey.category || "";
          const num = s.journey.number || "";
          const sDep = s.departure?.departure
            ? new Date(s.departure.departure).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
            : "?";
          const sArr = s.arrival?.arrival
            ? new Date(s.arrival.arrival).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
            : "?";
          return `    ${cat}${num}: ${s.departure?.station?.name || "?"} (${sDep}) -> ${s.arrival?.station?.name || "?"} (${sArr})`;
        })
        .filter(Boolean);

      return [
        `Connection ${i + 1}:`,
        `  ${c.from?.station?.name || from} ${dep}${depDelay} [Pl. ${depPlatform}] -> ${c.to?.station?.name || to} ${arr} [Pl. ${arrPlatform}]`,
        `  Duration: ${duration} | Transfers: ${transfers}`,
        ...sections,
      ].join("\n");
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Connections from ${from} to ${to}:\n\n${formatted.join("\n\n")}`,
        },
      ],
    };
  }
);

// --- Tool: sbb_get_stationboard ---
server.tool(
  "sbb_get_stationboard",
  "Get departures or arrivals at a Swiss public transport station",
  {
    station: z.string().describe("Station name (e.g. 'Zurich HB')"),
    limit: z.number().optional().default(10).describe("Number of results to return (default 10, max 40)"),
    type: z
      .enum(["departure", "arrival"])
      .optional()
      .default("departure")
      .describe("Board type: 'departure' or 'arrival' (default: departure)"),
  },
  async ({ station, limit, type }) => {
    const params = new URLSearchParams({
      station,
      limit: String(Math.min(limit ?? 10, 40)),
      type: type || "departure",
    });

    const url = `${BASE_URL}/stationboard?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text" as const, text: `API error: ${res.status} ${res.statusText}` }] };
    }
    const data = await res.json();
    const entries = data.stationboard || [];

    if (entries.length === 0) {
      return {
        content: [{ type: "text" as const, text: `No ${type || "departure"}s found for "${station}"` }],
      };
    }

    const boardType = type === "arrival" ? "Arrivals" : "Departures";
    const stationName = data.station?.name || station;

    const lines = entries.map((e: any) => {
      const cat = e.category || "";
      const num = e.number || "";
      const to = e.to || "?";
      const time = e.stop?.departure
        ? new Date(e.stop.departure).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
        : "?";
      const platform = e.stop?.platform || "-";
      const delay = e.stop?.delay && e.stop.delay > 0 ? ` (+${e.stop.delay}min)` : "";
      return `${time}${delay} | ${cat}${num} | To: ${to} | Pl. ${platform}`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `${boardType} at ${stationName}:\n\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
