#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NS_API_BASE = "https://gateway.apiportal.ns.nl";
const NS_API_KEY = process.env.NS_API_KEY;

if (!NS_API_KEY) {
  console.error("NS_API_KEY environment variable is required");
  process.exit(1);
}

// --- Helpers ---

async function nsRequest(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(path, NS_API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Ocp-Apim-Subscription-Key": NS_API_KEY!,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NS API error ${response.status}: ${body}`);
  }

  return response.json();
}

function formatDisruption(d: any): string {
  const lines: string[] = [];
  lines.push(`--- ${d.title || d.titel || "Disruption"} ---`);
  if (d.type) lines.push(`Type: ${d.type}`);
  if (d.isActive !== undefined) lines.push(`Active: ${d.isActive}`);
  if (d.start) lines.push(`Start: ${d.start}`);
  if (d.end) lines.push(`End: ${d.end}`);
  if (d.phase) lines.push(`Phase: ${d.phase.id || d.phase}`);
  if (d.impact) lines.push(`Impact: ${d.impact.value || d.impact}`);
  if (d.summaryAdditionalTravelTime?.maximumDurationInMinutes) {
    lines.push(`Extra travel time: up to ${d.summaryAdditionalTravelTime.maximumDurationInMinutes} min`);
  }
  if (d.timespans?.length) {
    for (const ts of d.timespans) {
      if (ts.situation?.label) lines.push(`  Situation: ${ts.situation.label}`);
      if (ts.cause?.label) lines.push(`  Cause: ${ts.cause.label}`);
      if (ts.advices?.length) {
        for (const a of ts.advices) lines.push(`  Advice: ${a.content || a}`);
      }
    }
  }
  return lines.join("\n");
}

function formatTrip(trip: any, index: number): string {
  const lines: string[] = [];
  lines.push(`\n=== Route ${index + 1} ===`);
  if (trip.plannedDurationInMinutes) lines.push(`Duration: ${trip.plannedDurationInMinutes} min`);
  if (trip.transfers !== undefined) lines.push(`Transfers: ${trip.transfers}`);
  if (trip.status) lines.push(`Status: ${trip.status}`);
  if (trip.optimal) lines.push(`Optimal: yes`);
  if (trip.legs?.length) {
    for (const leg of trip.legs) {
      const origin = leg.origin?.name || leg.origin?.station || "?";
      const dest = leg.destination?.name || leg.destination?.station || "?";
      const depTime = leg.origin?.plannedDateTime ? new Date(leg.origin.plannedDateTime).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "?";
      const arrTime = leg.destination?.plannedDateTime ? new Date(leg.destination.plannedDateTime).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "?";
      const product = leg.product?.displayName || leg.product?.shortCategoryName || leg.name || "";
      const direction = leg.direction ? ` -> ${leg.direction}` : "";
      lines.push(`  ${depTime} ${origin} --> ${arrTime} ${dest}  [${product}${direction}]`);
      if (leg.cancelled) lines.push(`    ** CANCELLED **`);
      if (leg.messages?.length) {
        for (const m of leg.messages) lines.push(`    ! ${m.text || m.message || m}`);
      }
    }
  }
  return lines.join("\n");
}

function formatDeparture(dep: any): string {
  const lines: string[] = [];
  const time = dep.plannedDateTime ? new Date(dep.plannedDateTime).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "?";
  const actualTime = dep.actualDateTime ? new Date(dep.actualDateTime).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;
  const delay = actualTime && actualTime !== time ? ` (actual: ${actualTime})` : "";
  const track = dep.actualTrack || dep.plannedTrack || "?";
  const trainType = dep.trainCategory || dep.product?.shortCategoryName || "";
  const direction = dep.direction || dep.routeStations?.[0]?.mediumName || "?";
  lines.push(`${time}${delay}  Track ${track}  ${trainType} to ${direction}`);
  if (dep.cancelled) lines.push(`  ** CANCELLED **`);
  if (dep.messages?.length) {
    for (const m of dep.messages) lines.push(`  ! ${m.text || m.message || m}`);
  }
  return lines.join("\n");
}

function formatArrival(arr: any): string {
  const lines: string[] = [];
  const time = arr.plannedDateTime ? new Date(arr.plannedDateTime).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "?";
  const actualTime = arr.actualDateTime ? new Date(arr.actualDateTime).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;
  const delay = actualTime && actualTime !== time ? ` (actual: ${actualTime})` : "";
  const track = arr.actualTrack || arr.plannedTrack || "?";
  const trainType = arr.trainCategory || arr.product?.shortCategoryName || "";
  const origin = arr.origin || "?";
  lines.push(`${time}${delay}  Track ${track}  ${trainType} from ${origin}`);
  if (arr.cancelled) lines.push(`  ** CANCELLED **`);
  if (arr.messages?.length) {
    for (const m of arr.messages) lines.push(`  ! ${m.text || m.message || m}`);
  }
  return lines.join("\n");
}

function formatStation(s: any): string {
  const lines: string[] = [];
  lines.push(`${s.namen?.lang || s.name || s.code || "?"} (${s.code || "?"})`);
  if (s.land) lines.push(`  Country: ${s.land}`);
  if (s.stationType) lines.push(`  Type: ${s.stationType}`);
  if (s.lat && s.lng) lines.push(`  Coords: ${s.lat}, ${s.lng}`);
  if (s.synoniemen?.length) lines.push(`  Also known as: ${s.synoniemen.join(", ")}`);
  return lines.join("\n");
}

function formatPrice(data: any): string {
  const lines: string[] = [];
  lines.push("=== Price Information ===");
  if (data.priceOptions?.length) {
    for (const opt of data.priceOptions) {
      if (opt.prices?.length) {
        lines.push(`\n${opt.type || "Option"}:`);
        for (const p of opt.prices) {
          lines.push(`  Class ${p.classType || "?"}: EUR ${p.price?.toFixed(2) ?? "?"} (${p.discountType || "full price"})`);
        }
      }
    }
  } else if (data.totalPriceInCents !== undefined) {
    lines.push(`Total: EUR ${(data.totalPriceInCents / 100).toFixed(2)}`);
  } else {
    lines.push(JSON.stringify(data, null, 2));
  }
  return lines.join("\n");
}

// --- Server Setup ---

const server = new McpServer({
  name: "ns-railways",
  version: "1.0.0",
});

// 1. Disruptions
server.tool(
  "ns_get_disruptions",
  "Get current disruptions and maintenance on the Dutch railway network",
  {
    isActive: z.boolean().optional().describe("Filter by active status"),
    type: z.string().optional().describe("Filter by type: MAINTENANCE or DISRUPTION"),
  },
  async ({ isActive, type }) => {
    const params: Record<string, string> = {};
    if (isActive !== undefined) params.isActive = String(isActive);
    if (type) params.type = type;

    const data = await nsRequest("/reisinformatie-api/api/v3/disruptions", params) as any[];
    if (!data?.length) {
      return { content: [{ type: "text", text: "No disruptions found." }] };
    }
    const text = data.map(formatDisruption).join("\n\n");
    return { content: [{ type: "text", text: `Found ${data.length} disruption(s):\n\n${text}` }] };
  }
);

// 2. Travel Advice
server.tool(
  "ns_get_travel_advice",
  "Get travel routes between two Dutch railway stations",
  {
    fromStation: z.string().describe("Departure station name or code (e.g. 'Amsterdam Centraal' or 'ASD')"),
    toStation: z.string().describe("Destination station name or code (e.g. 'Rotterdam Centraal' or 'RTD')"),
    dateTime: z.string().optional().describe("Travel date/time in RFC3339 format (e.g. 2026-02-14T08:00:00+01:00)"),
    searchForArrival: z.boolean().optional().describe("If true, dateTime is treated as desired arrival time"),
  },
  async ({ fromStation, toStation, dateTime, searchForArrival }) => {
    const params: Record<string, string> = {
      fromStation,
      toStation,
    };
    if (dateTime) params.dateTime = dateTime;
    if (searchForArrival !== undefined) params.searchForArrival = String(searchForArrival);

    const data = await nsRequest("/reisinformatie-api/api/v3/trips", params) as any;
    const trips = data?.trips || data;
    if (!Array.isArray(trips) || !trips.length) {
      return { content: [{ type: "text", text: "No travel advice found for this route." }] };
    }
    const text = trips.map((t: any, i: number) => formatTrip(t, i)).join("\n");
    return { content: [{ type: "text", text: `Travel advice ${fromStation} -> ${toStation}:\n${text}` }] };
  }
);

// 3. Departures
server.tool(
  "ns_get_departures",
  "Get upcoming departures from a Dutch railway station",
  {
    station: z.string().describe("Station code (e.g. 'ASD' for Amsterdam Centraal, 'UT' for Utrecht)"),
    maxJourneys: z.number().optional().describe("Maximum number of departures to return (default 10)"),
    lang: z.string().optional().describe("Language: 'nl' or 'en'"),
  },
  async ({ station, maxJourneys, lang }) => {
    const params: Record<string, string> = { station };
    if (maxJourneys !== undefined) params.maxJourneys = String(maxJourneys);
    if (lang) params.lang = lang;

    const data = await nsRequest("/reisinformatie-api/api/v3/departures", params) as any;
    const departures = data?.payload?.departures || data?.departures || data;
    if (!Array.isArray(departures) || !departures.length) {
      return { content: [{ type: "text", text: `No departures found for station ${station}.` }] };
    }
    const text = departures.map(formatDeparture).join("\n");
    return { content: [{ type: "text", text: `Departures from ${station}:\n\n${text}` }] };
  }
);

// 4. Arrivals
server.tool(
  "ns_get_arrivals",
  "Get upcoming arrivals at a Dutch railway station",
  {
    station: z.string().describe("Station code (e.g. 'ASD' for Amsterdam Centraal, 'UT' for Utrecht)"),
    maxJourneys: z.number().optional().describe("Maximum number of arrivals to return (default 10)"),
    lang: z.string().optional().describe("Language: 'nl' or 'en'"),
  },
  async ({ station, maxJourneys, lang }) => {
    const params: Record<string, string> = { station };
    if (maxJourneys !== undefined) params.maxJourneys = String(maxJourneys);
    if (lang) params.lang = lang;

    const data = await nsRequest("/reisinformatie-api/api/v3/arrivals", params) as any;
    const arrivals = data?.payload?.arrivals || data?.arrivals || data;
    if (!Array.isArray(arrivals) || !arrivals.length) {
      return { content: [{ type: "text", text: `No arrivals found for station ${station}.` }] };
    }
    const text = arrivals.map(formatArrival).join("\n");
    return { content: [{ type: "text", text: `Arrivals at ${station}:\n\n${text}` }] };
  }
);

// 5. Station Info
server.tool(
  "ns_get_station_info",
  "Search for Dutch railway station information by name",
  {
    q: z.string().describe("Search query (e.g. 'Amsterdam', 'Utrecht')"),
    limit: z.number().optional().describe("Maximum number of results (default 10)"),
  },
  async ({ q, limit }) => {
    const params: Record<string, string> = { q };
    if (limit !== undefined) params.limit = String(limit);

    const data = await nsRequest("/reisinformatie-api/api/v2/stations", params) as any;
    const stations = data?.payload || data;
    if (!Array.isArray(stations) || !stations.length) {
      return { content: [{ type: "text", text: `No stations found for "${q}".` }] };
    }
    const text = stations.map(formatStation).join("\n\n");
    return { content: [{ type: "text", text: `Station search results for "${q}":\n\n${text}` }] };
  }
);

// 6. Prices
server.tool(
  "ns_get_prices",
  "Get price information for Dutch railway journeys",
  {
    fromStation: z.string().describe("Departure station name or code"),
    toStation: z.string().describe("Destination station name or code"),
    travelClass: z.string().optional().describe("Travel class: FIRST_CLASS or SECOND_CLASS"),
    travelType: z.string().optional().describe("Travel type: 'single' or 'return'"),
  },
  async ({ fromStation, toStation, travelClass, travelType }) => {
    const params: Record<string, string> = { fromStation, toStation };
    if (travelClass) params.travelClass = travelClass;
    if (travelType) params.travelType = travelType;

    const data = await nsRequest("/reisinformatie-api/api/v2/price", params) as any;
    const text = formatPrice(data);
    return { content: [{ type: "text", text }] };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NS Railways MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
