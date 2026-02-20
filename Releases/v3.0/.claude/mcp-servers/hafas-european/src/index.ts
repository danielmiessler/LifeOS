#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Operator registry ──────────────────────────────────────────────
// Every profile directory in hafas-client/p/ that ships an index.js

const OPERATORS: Record<string, { name: string; country: string }> = {
  avv: { name: "Aachener Verkehrsverbund", country: "DE" },
  bart: { name: "Bay Area Rapid Transit", country: "US" },
  bls: { name: "BLS AG (Bern)", country: "CH" },
  bvg: { name: "Berliner Verkehrsbetriebe", country: "DE" },
  cfl: { name: "Societe Nationale des Chemins de Fer Luxembourgeois", country: "LU" },
  cmta: { name: "Capital Metro (Austin, TX)", country: "US" },
  dart: { name: "Des Moines Area Rapid Transit", country: "US" },
  db: { name: "Deutsche Bahn", country: "DE" },
  "db-busradar-nrw": { name: "DB Busradar NRW", country: "DE" },
  insa: { name: "Nahverkehr Sachsen-Anhalt (NASA/INSA)", country: "DE" },
  invg: { name: "Ingolstadter Verkehrsgesellschaft", country: "DE" },
  "irish-rail": { name: "Iarnrod Eireann (Irish Rail)", country: "IE" },
  ivb: { name: "Innsbrucker Verkehrsbetriebe", country: "AT" },
  kvb: { name: "Kolner Verkehrs-Betriebe", country: "DE" },
  "mobiliteit-lu": { name: "Mobiliteitszentral (Luxembourg)", country: "LU" },
  "mobil-nrw": { name: "mobil.nrw", country: "DE" },
  nahsh: { name: "Nahverkehrsverbund Schleswig-Holstein", country: "DE" },
  nvv: { name: "Nordhessischer Verkehrsverbund", country: "DE" },
  oebb: { name: "Osterreichische Bundesbahnen", country: "AT" },
  ooevv: { name: "Oberosterreichischer Verkehrsverbund", country: "AT" },
  pkp: { name: "Polskie Koleje Panstwowe", country: "PL" },
  rejseplanen: { name: "Rejseplanen (Denmark)", country: "DK" },
  rmv: { name: "Rhein-Main-Verkehrsverbund", country: "DE" },
  rsag: { name: "Rostocker Strassenbahn AG", country: "DE" },
  saarfahrplan: { name: "Saarfahrplan / VGS (Saarland)", country: "DE" },
  salzburg: { name: "Salzburg", country: "AT" },
  "sbahn-muenchen": { name: "S-Bahn Munchen", country: "DE" },
  sncb: { name: "Belgian National Railways (SNCB/NMBS)", country: "BE" },
  stv: { name: "Steirischer Verkehrsverbund", country: "AT" },
  svv: { name: "Salzburger Verkehrsverbund", country: "AT" },
  tpg: { name: "Transports publics genevois (Geneva)", country: "CH" },
  vbb: { name: "Verkehrsverbund Berlin-Brandenburg", country: "DE" },
  vbn: { name: "Verkehrsverbund Bremen/Niedersachsen", country: "DE" },
  vkg: { name: "Karntner Linien / Verkehrsverbund Karnten", country: "AT" },
  vmt: { name: "Verkehrsverbund Mittelthueringen", country: "DE" },
  vor: { name: "Verkehrsverbund Ost-Region", country: "AT" },
  vos: { name: "Verkehrsgemeinschaft Osnabruck", country: "DE" },
  vrn: { name: "Verkehrsverbund Rhein-Neckar", country: "DE" },
  vsn: { name: "Verkehrsverbund Sud-Niedersachsen", country: "DE" },
  vvt: { name: "Verkehrsverbund Tirol", country: "AT" },
  vvv: { name: "Verkehrsverbund Vorarlberg", country: "AT" },
  zvv: { name: "Zurcher Verkehrsverbund (Zurich)", country: "CH" },
};

// ── Dynamic profile loader ─────────────────────────────────────────

const clientCache = new Map<string, any>();

async function getClient(operatorCode: string): Promise<any> {
  const code = operatorCode.toLowerCase();
  if (!OPERATORS[code]) {
    const available = Object.keys(OPERATORS).join(", ");
    throw new Error(
      `Unknown operator "${operatorCode}". Available operators: ${available}`
    );
  }

  if (clientCache.has(code)) {
    return clientCache.get(code)!;
  }

  const { createClient } = await import("hafas-client");
  const profileModule = await import(`hafas-client/p/${code}/index.js`);
  const profile = profileModule.default || profileModule;
  const client = createClient(profile, "mcp-hafas-european-rail");
  clientCache.set(code, client);
  return client;
}

// ── Formatters ─────────────────────────────────────────────────────

function formatLocation(loc: any): string {
  if (!loc) return "Unknown";
  const parts: string[] = [];
  const name = loc.name || loc.address || "Unnamed";
  parts.push(name);
  if (loc.id) parts.push(`(ID: ${loc.id})`);
  if (loc.type) parts.push(`[${loc.type}]`);
  if (loc.latitude && loc.longitude) {
    parts.push(`@ ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
  }
  if (loc.products) {
    const active = Object.entries(loc.products)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (active.length > 0) parts.push(`Products: ${active.join(", ")}`);
  }
  return parts.join(" ");
}

function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "N/A";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return isoStr;
  }
}

function formatDeparture(dep: any): string {
  const line = dep.line?.name || dep.line?.fahrtNr || "?";
  const direction = dep.direction || "Unknown direction";
  const planned = formatTime(dep.plannedWhen);
  const actual = dep.when ? formatTime(dep.when) : null;
  const delay = dep.delay != null ? ` (delay: ${Math.round(dep.delay / 60)}min)` : "";
  const platform = dep.plannedPlatform || dep.platform || "";
  const platformStr = platform ? ` | Platform ${platform}` : "";
  const cancelled = dep.cancelled ? " [CANCELLED]" : "";

  let result = `${line} -> ${direction}${cancelled}`;
  result += `\n  Planned: ${planned}`;
  if (actual && actual !== planned) result += ` | Actual: ${actual}`;
  result += delay + platformStr;
  return result;
}

function formatArrival(arr: any): string {
  const line = arr.line?.name || arr.line?.fahrtNr || "?";
  const origin = arr.provenance || arr.origin?.name || "Unknown origin";
  const planned = formatTime(arr.plannedWhen);
  const actual = arr.when ? formatTime(arr.when) : null;
  const delay = arr.delay != null ? ` (delay: ${Math.round(arr.delay / 60)}min)` : "";
  const platform = arr.plannedPlatform || arr.platform || "";
  const platformStr = platform ? ` | Platform ${platform}` : "";
  const cancelled = arr.cancelled ? " [CANCELLED]" : "";

  let result = `${line} from ${origin}${cancelled}`;
  result += `\n  Planned: ${planned}`;
  if (actual && actual !== planned) result += ` | Actual: ${actual}`;
  result += delay + platformStr;
  return result;
}

function formatJourney(journey: any, index: number): string {
  const legs = journey.legs || [];
  const lines: string[] = [];

  lines.push(`--- Journey ${index + 1} ---`);

  if (journey.price) {
    lines.push(`Price: ${journey.price.amount} ${journey.price.currency || "EUR"}`);
  }

  for (const leg of legs) {
    if (leg.walking) {
      const dur = leg.distance ? `${leg.distance}m` : "walk";
      lines.push(`  WALK ${dur}: ${leg.origin?.name || "?"} -> ${leg.destination?.name || "?"}`);
      continue;
    }
    if (leg.transfer) {
      lines.push(`  TRANSFER at ${leg.origin?.name || "?"}`);
      continue;
    }

    const lineName = leg.line?.name || leg.line?.fahrtNr || "?";
    const dep = formatTime(leg.plannedDeparture || leg.departure);
    const arr = formatTime(leg.plannedArrival || leg.arrival);
    const depDelay = leg.departureDelay != null ? ` (+${Math.round(leg.departureDelay / 60)}min)` : "";
    const arrDelay = leg.arrivalDelay != null ? ` (+${Math.round(leg.arrivalDelay / 60)}min)` : "";
    const platform = leg.departurePlatform || leg.plannedDeparturePlatform || "";
    const platformStr = platform ? ` [Pl. ${platform}]` : "";
    const cancelled = leg.cancelled ? " [CANCELLED]" : "";

    lines.push(`  ${lineName}${cancelled}${platformStr}`);
    lines.push(`    ${leg.origin?.name || "?"} (${dep}${depDelay})`);
    lines.push(`    -> ${leg.destination?.name || "?"} (${arr}${arrDelay})`);
  }

  return lines.join("\n");
}

// ── MCP Server ─────────────────────────────────────────────────────

const server = new McpServer({
  name: "hafas-european-rail",
  version: "1.0.0",
});

// Tool 1: Search stations
server.tool(
  "hafas_search_stations",
  "Search for train stations and stops across European rail networks. Returns station names, IDs, and available transport products.",
  {
    query: z.string().describe("Station name to search for (e.g. 'Berlin Hbf', 'Wien', 'Zurich')"),
    operator: z.string().optional().describe("Rail operator code (default: 'db'). Use hafas_list_operators to see all available codes."),
  },
  async ({ query, operator }) => {
    try {
      const client = await getClient(operator || "db");
      const locations = await client.locations(query, { results: 10 });
      if (!locations || locations.length === 0) {
        return { content: [{ type: "text" as const, text: `No stations found for "${query}" using operator ${operator || "db"}.` }] };
      }
      const text = locations.map((loc: any) => formatLocation(loc)).join("\n\n");
      return { content: [{ type: "text" as const, text: `Stations matching "${query}" (${operator || "db"}):\n\n${text}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error searching stations: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2: Get departures
server.tool(
  "hafas_get_departures",
  "Get upcoming departures from a train station. Shows line names, directions, times, delays, and platform numbers.",
  {
    stationId: z.string().describe("Station ID (get this from hafas_search_stations, e.g. '8011160' for Berlin Hbf)"),
    operator: z.string().optional().describe("Rail operator code (default: 'db')"),
    duration: z.number().optional().describe("Time window in minutes (default: 60)"),
  },
  async ({ stationId, operator, duration }) => {
    try {
      const client = await getClient(operator || "db");
      const result = await client.departures(stationId, {
        duration: duration || 60,
      });
      const departures = result?.departures || result || [];
      if (!departures || departures.length === 0) {
        return { content: [{ type: "text" as const, text: `No departures found for station ${stationId}.` }] };
      }
      const text = departures.map((d: any) => formatDeparture(d)).join("\n\n");
      const header = `Departures from station ${stationId} (next ${duration || 60} min, ${operator || "db"}):`;
      return { content: [{ type: "text" as const, text: `${header}\n\n${text}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error getting departures: ${err.message}` }], isError: true };
    }
  }
);

// Tool 3: Get journeys
server.tool(
  "hafas_get_journeys",
  "Plan a journey between two stations. Shows available routes with connections, times, transfers, and delays.",
  {
    from: z.string().describe("Departure station ID (get from hafas_search_stations)"),
    to: z.string().describe("Arrival station ID (get from hafas_search_stations)"),
    operator: z.string().optional().describe("Rail operator code (default: 'db')"),
    departure: z.string().optional().describe("Departure time as ISO 8601 datetime (e.g. '2025-03-15T08:00:00+01:00'). Defaults to now."),
  },
  async ({ from, to, operator, departure }) => {
    try {
      const client = await getClient(operator || "db");
      const opts: any = { results: 5 };
      if (departure) {
        opts.departure = new Date(departure);
      }
      const result = await client.journeys(from, to, opts);
      const journeys = result?.journeys || result || [];
      if (!journeys || journeys.length === 0) {
        return { content: [{ type: "text" as const, text: `No journeys found from ${from} to ${to}.` }] };
      }
      const text = journeys.map((j: any, i: number) => formatJourney(j, i)).join("\n\n");
      const header = `Journeys from ${from} to ${to} (${operator || "db"}):`;
      return { content: [{ type: "text" as const, text: `${header}\n\n${text}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error planning journey: ${err.message}` }], isError: true };
    }
  }
);

// Tool 4: Get arrivals
server.tool(
  "hafas_get_arrivals",
  "Get upcoming arrivals at a train station. Shows line names, origins, times, delays, and platform numbers.",
  {
    stationId: z.string().describe("Station ID (get this from hafas_search_stations)"),
    operator: z.string().optional().describe("Rail operator code (default: 'db')"),
    duration: z.number().optional().describe("Time window in minutes (default: 60)"),
  },
  async ({ stationId, operator, duration }) => {
    try {
      const client = await getClient(operator || "db");
      const result = await client.arrivals(stationId, {
        duration: duration || 60,
      });
      const arrivals = result?.arrivals || result || [];
      if (!arrivals || arrivals.length === 0) {
        return { content: [{ type: "text" as const, text: `No arrivals found for station ${stationId}.` }] };
      }
      const text = arrivals.map((a: any) => formatArrival(a)).join("\n\n");
      const header = `Arrivals at station ${stationId} (next ${duration || 60} min, ${operator || "db"}):`;
      return { content: [{ type: "text" as const, text: `${header}\n\n${text}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error getting arrivals: ${err.message}` }], isError: true };
    }
  }
);

// Tool 5: List operators
server.tool(
  "hafas_list_operators",
  "List all available European rail operator profiles. Returns operator codes, full names, and countries.",
  {},
  async () => {
    const lines: string[] = ["Available HAFAS operators:\n"];
    const byCountry = new Map<string, string[]>();

    for (const [code, info] of Object.entries(OPERATORS)) {
      const entry = `  ${code.padEnd(20)} ${info.name}`;
      if (!byCountry.has(info.country)) byCountry.set(info.country, []);
      byCountry.get(info.country)!.push(entry);
    }

    const sorted = [...byCountry.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [country, entries] of sorted) {
      lines.push(`[${country}]`);
      lines.push(...entries.sort());
      lines.push("");
    }

    lines.push(`\nTotal: ${Object.keys(OPERATORS).length} operators`);
    lines.push("\nUsage: Pass the operator code (left column) as the 'operator' parameter to other tools.");

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Start ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
