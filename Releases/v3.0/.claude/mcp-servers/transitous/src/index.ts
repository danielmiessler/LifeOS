#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://api.transitous.org";

const server = new McpServer({
  name: "transitous",
  version: "1.0.0",
});

// ── Helper: format duration ──────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

// ── Tool 1: Search locations ─────────────────────────────────────────────────
server.tool(
  "transitous_search_location",
  "Search for stations, addresses, and places across Europe using the Transitous pan-European transit network. Returns coordinates, country, timezone, and transport modes for stops.",
  {
    query: z.string().describe("Search text (station name, address, city)"),
  },
  async ({ query }) => {
    const url = `${BASE_URL}/api/v1/geocode?text=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text" as const, text: `API error: ${res.status} ${res.statusText}` }] };
    }

    const results: any[] = await res.json();
    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: `No results found for "${query}".` }] };
    }

    const lines: string[] = [`Found ${results.length} result(s) for "${query}":\n`];

    for (const r of results.slice(0, 10)) {
      const typeLabel = r.type === "STOP" ? "Transit Stop" : r.type === "ADDRESS" ? "Address" : "Place";
      const modes = r.modes ? ` | Modes: ${r.modes.join(", ")}` : "";
      const country = r.country ? ` | ${r.country}` : "";
      const tz = r.tz ? ` | TZ: ${r.tz}` : "";
      const defaultArea = r.areas?.find((a: any) => a.default)?.name || "";
      const areaStr = defaultArea ? ` (${defaultArea})` : "";

      lines.push(`[${typeLabel}] ${r.name}${areaStr}`);
      lines.push(`  ID: ${r.id}`);
      lines.push(`  Coords: ${r.lat}, ${r.lon}${country}${tz}${modes}`);
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool 2: Plan journey ─────────────────────────────────────────────────────
server.tool(
  "transitous_plan_journey",
  "Plan a multimodal public transit journey across Europe using the Transitous network. Supports trains, buses, trams, subways, ferries. Provide coordinates as 'lat,lon' or a stop ID.",
  {
    fromPlace: z.string().describe("Origin: 'lat,lon' coordinates or stop ID"),
    toPlace: z.string().describe("Destination: 'lat,lon' coordinates or stop ID"),
    datetime: z.string().optional().describe("Departure/arrival time in ISO 8601 format (e.g. 2026-02-15T10:00:00Z). Defaults to now."),
    arriveBy: z.boolean().optional().describe("If true, datetime is treated as desired arrival time. Default: false"),
    numItineraries: z.number().optional().describe("Max number of itineraries to return (default: 3)"),
  },
  async ({ fromPlace, toPlace, datetime, arriveBy, numItineraries }) => {
    const params = new URLSearchParams({
      fromPlace,
      toPlace,
    });
    if (datetime) params.set("time", datetime);
    if (arriveBy !== undefined) params.set("arriveBy", String(arriveBy));

    const url = `${BASE_URL}/api/v5/plan?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      return { content: [{ type: "text" as const, text: `API error: ${res.status} ${res.statusText}\n${body}` }] };
    }

    const data: any = await res.json();
    const itineraries: any[] = data.itineraries || [];
    const maxResults = numItineraries ?? 3;
    const shown = itineraries.slice(0, maxResults);

    if (shown.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No transit routes found from ${data.from?.name || fromPlace} to ${data.to?.name || toPlace}.`,
        }],
      };
    }

    const lines: string[] = [
      `Journey: ${data.from?.name || fromPlace} -> ${data.to?.name || toPlace}`,
      `Found ${itineraries.length} option(s), showing ${shown.length}:\n`,
    ];

    for (let i = 0; i < shown.length; i++) {
      const it = shown[i];
      lines.push(`--- Option ${i + 1} ---`);
      lines.push(`Duration: ${formatDuration(it.duration)} | Transfers: ${it.transfers}`);
      lines.push(`Depart: ${formatTime(it.startTime)} | Arrive: ${formatTime(it.endTime)}`);
      lines.push("");

      for (const leg of it.legs || []) {
        if (leg.mode === "WALK") {
          const dist = leg.distance ? ` (${Math.round(leg.distance)}m)` : "";
          lines.push(`  WALK${dist}: ${leg.from?.name || "?"} -> ${leg.to?.name || "?"}`);
        } else {
          const route = [leg.routeShortName, leg.agencyName].filter(Boolean).join(" / ");
          const headsign = leg.headsign ? ` -> ${leg.headsign}` : "";
          const track = leg.from?.track ? ` [Track ${leg.from.track}]` : "";
          const realtime = leg.realTime ? " (real-time)" : "";

          lines.push(`  ${leg.mode} ${route}${headsign}${realtime}`);
          lines.push(`    From: ${leg.from?.name || "?"}${track} at ${formatTime(leg.from?.departure || leg.startTime)}`);
          lines.push(`    To:   ${leg.to?.name || "?"} at ${formatTime(leg.to?.arrival || leg.endTime)}`);

          if (leg.intermediateStops?.length) {
            lines.push(`    Stops: ${leg.intermediateStops.length} intermediate`);
          }
        }
      }
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool 3: Nearby stops ────────────────────────────────────────────────────
server.tool(
  "transitous_nearby_stops",
  "Find public transit stops near a geographic coordinate. Returns stop names, IDs, coordinates, and available transport modes.",
  {
    lat: z.number().describe("Latitude of the center point"),
    lon: z.number().describe("Longitude of the center point"),
    radius: z.number().optional().describe("Search radius in meters (default: 1000)"),
  },
  async ({ lat, lon, radius }) => {
    // Use reverse-geocode with type=STOP — returns stops sorted by distance
    const url = `${BASE_URL}/api/v1/reverse-geocode?place=${lat},${lon}&type=STOP`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text" as const, text: `API error: ${res.status} ${res.statusText}` }] };
    }

    const results: any[] = await res.json();
    const maxRadius = radius ?? 1000;

    // Calculate distance and filter by radius
    const withDistance = results.map((r: any) => {
      const dlat = (r.lat - lat) * 111320;
      const dlon = (r.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dlat * dlat + dlon * dlon);
      return { ...r, distance: Math.round(dist) };
    }).filter((r: any) => r.distance <= maxRadius);

    if (withDistance.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No transit stops found within ${maxRadius}m of ${lat}, ${lon}.`,
        }],
      };
    }

    const lines: string[] = [
      `Found ${withDistance.length} stop(s) within ${maxRadius}m of ${lat}, ${lon}:\n`,
    ];

    for (const s of withDistance.slice(0, 15)) {
      const modes = s.modes ? ` | Modes: ${s.modes.join(", ")}` : "";
      const country = s.country ? ` | ${s.country}` : "";
      lines.push(`${s.name} (~${s.distance}m)`);
      lines.push(`  ID: ${s.id}`);
      lines.push(`  Coords: ${s.lat}, ${s.lon}${country}${modes}`);
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Start server ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
