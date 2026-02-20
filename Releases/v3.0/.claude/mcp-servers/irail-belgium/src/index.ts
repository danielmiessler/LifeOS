#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://api.irail.be/v1";
const USER_AGENT = "MCP-iRail-Server/1.0";

async function irailFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  params.format = "json";
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`iRail API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function formatTimestamp(ts: string): string {
  return new Date(parseInt(ts) * 1000).toLocaleString("en-BE", {
    timeZone: "Europe/Brussels",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDelay(delay: string): string {
  const mins = Math.round(parseInt(delay) / 60);
  if (mins === 0) return "";
  return ` (+${mins} min delay)`;
}

function formatCanceled(canceled: string): string {
  return canceled === "1" ? " [CANCELED]" : "";
}

// --- Server setup ---

const server = new McpServer({
  name: "irail-belgium",
  version: "1.0.0",
});

// Tool 1: Search stations
server.tool(
  "irail_search_stations",
  "Search Belgian railway stations by name",
  {
    query: z.string().describe("Search query for station name"),
  },
  async ({ query }) => {
    const data = await irailFetch("/stations/", {});
    const stations = data.station as any[];
    const q = query.toLowerCase();
    const matches = stations.filter((s: any) =>
      s.standardname.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: `No stations found matching "${query}".` }] };
    }

    const lines = matches.slice(0, 20).map((s: any) =>
      `- ${s.standardname} (ID: ${s.id})`
    );
    const text = `Found ${matches.length} station(s) matching "${query}"${matches.length > 20 ? " (showing first 20)" : ""}:\n\n${lines.join("\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool 2: Liveboard
server.tool(
  "irail_get_liveboard",
  "Get departures or arrivals at a Belgian railway station",
  {
    station: z.string().describe("Station name, e.g. 'Brussels-South' or 'Gent-Sint-Pieters'"),
    arrdep: z.string().optional().describe("'departure' or 'arrival' (default: departure)"),
  },
  async ({ station, arrdep }) => {
    const params: Record<string, string> = { station };
    if (arrdep) params.arrdep = arrdep;

    const data = await irailFetch("/liveboard/", params);
    const stationName = data.stationinfo?.standardname || station;
    const direction = arrdep === "arrival" ? "Arrivals" : "Departures";
    const items = data.departures?.departure || data.arrivals?.arrival || [];

    if (items.length === 0) {
      return { content: [{ type: "text" as const, text: `No ${direction.toLowerCase()} found for ${stationName}.` }] };
    }

    const lines = items.slice(0, 20).map((d: any) => {
      const time = formatTimestamp(d.time);
      const delay = formatDelay(d.delay || "0");
      const canceled = formatCanceled(d.canceled || "0");
      const platform = d.platform ? ` | Platform ${d.platform}` : "";
      const dest = d.stationinfo?.standardname || d.station || "Unknown";
      const vehicle = d.vehicle ? ` | ${d.vehicle.replace("BE.NMBS.", "")}` : "";
      return `  ${time} -> ${dest}${vehicle}${platform}${delay}${canceled}`;
    });

    const text = `${direction} at ${stationName}:\n\n${lines.join("\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool 3: Connections
server.tool(
  "irail_get_connections",
  "Plan a journey between two Belgian railway stations",
  {
    from: z.string().describe("Departure station name"),
    to: z.string().describe("Arrival station name"),
    datetime: z.string().optional().describe("Date/time in DD/MM/YY HH:MM format"),
    timesel: z.string().optional().describe("'departure' or 'arrival'"),
  },
  async ({ from, to, datetime, timesel }) => {
    const params: Record<string, string> = { from, to };
    if (datetime) {
      // Parse DD/MM/YY HH:MM
      const match = datetime.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
      if (match) {
        const [, dd, mm, yy, hh, min] = match;
        params.date = `${dd}${mm}${yy}`;
        params.time = `${hh}${min}`;
      }
    }
    if (timesel) params.timesel = timesel;

    const data = await irailFetch("/connections/", params);
    const connections = data.connection || [];

    if (connections.length === 0) {
      return { content: [{ type: "text" as const, text: `No connections found from ${from} to ${to}.` }] };
    }

    const blocks = connections.slice(0, 6).map((c: any, i: number) => {
      const depTime = formatTimestamp(c.departure.time);
      const arrTime = formatTimestamp(c.arrival.time);
      const depDelay = formatDelay(c.departure.delay || "0");
      const arrDelay = formatDelay(c.arrival.delay || "0");
      const depStation = c.departure.stationinfo?.standardname || from;
      const arrStation = c.arrival.stationinfo?.standardname || to;
      const duration = Math.round(parseInt(c.duration) / 60);
      const transfers = c.vias?.number || "0";
      const depPlatform = c.departure.platform ? ` (Platform ${c.departure.platform})` : "";
      const arrPlatform = c.arrival.platform ? ` (Platform ${c.arrival.platform})` : "";
      const depCanceled = formatCanceled(c.departure.canceled || "0");
      const arrCanceled = formatCanceled(c.arrival.canceled || "0");

      let block = `Connection ${i + 1}:\n`;
      block += `  Depart: ${depTime} from ${depStation}${depPlatform}${depDelay}${depCanceled}\n`;
      block += `  Arrive: ${arrTime} at ${arrStation}${arrPlatform}${arrDelay}${arrCanceled}\n`;
      block += `  Duration: ${duration} min | Transfers: ${transfers}`;

      // Show via stops if any
      if (c.vias && c.vias.via) {
        const vias = Array.isArray(c.vias.via) ? c.vias.via : [c.vias.via];
        const viaNames = vias.map((v: any) => v.stationinfo?.standardname || v.station).join(" -> ");
        block += `\n  Via: ${viaNames}`;
      }

      return block;
    });

    const text = `Connections from ${from} to ${to}:\n\n${blocks.join("\n\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool 4: Vehicle details
server.tool(
  "irail_get_vehicle",
  "Get details and stops of a specific train",
  {
    id: z.string().describe("Vehicle ID, e.g. 'BE.NMBS.IC1832'"),
  },
  async ({ id }) => {
    const data = await irailFetch("/vehicle/", { id });
    const vehicleName = data.vehicleinfo?.shortname || id;
    const stops = data.stops?.stop || [];

    if (stops.length === 0) {
      return { content: [{ type: "text" as const, text: `No stop information found for ${id}.` }] };
    }

    const lines = stops.map((s: any) => {
      const arr = s.scheduledArrivalTime ? formatTimestamp(s.scheduledArrivalTime) : "";
      const dep = s.scheduledDepartureTime ? formatTimestamp(s.scheduledDepartureTime) : "";
      const delay = formatDelay(s.departureDelay || s.arrivalDelay || "0");
      const canceled = formatCanceled(s.departureCanceled || s.arrivalCanceled || "0");
      const platform = s.platform ? ` | Platform ${s.platform}` : "";
      const station = s.stationinfo?.standardname || s.station || "Unknown";
      const timeStr = dep && arr ? `${arr} -> ${dep}` : dep || arr || "";
      return `  ${station}: ${timeStr}${platform}${delay}${canceled}`;
    });

    const text = `Train ${vehicleName} stops:\n\n${lines.join("\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool 5: Disturbances
server.tool(
  "irail_get_disturbances",
  "Get current disruptions on the Belgian railway network",
  {},
  async () => {
    const data = await irailFetch("/disturbances/", {});
    const disturbances = data.disturbance || [];

    if (disturbances.length === 0) {
      return { content: [{ type: "text" as const, text: "No current disruptions on the Belgian railway network." }] };
    }

    const blocks = disturbances.map((d: any, i: number) => {
      const title = d.title || "Untitled";
      const desc = d.description || "";
      const link = d.link || "";
      const timestamp = d.timestamp ? formatTimestamp(d.timestamp) : "";
      let block = `${i + 1}. ${title}`;
      if (timestamp) block += ` (${timestamp})`;
      if (desc) block += `\n   ${desc}`;
      if (link) block += `\n   More info: ${link}`;
      return block;
    });

    const text = `Current disruptions (${disturbances.length}):\n\n${blocks.join("\n\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
