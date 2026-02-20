#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://api.opentripmap.com/0.1/en/places";
const API_KEY = process.env.OPENTRIPMAP_API_KEY;

if (!API_KEY) {
  console.error("OPENTRIPMAP_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "opentripmap",
  version: "1.0.0",
});

async function apiRequest(path: string, params: Record<string, string> = {}): Promise<any> {
  params.apikey = API_KEY!;
  const query = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${query}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// --- Tool: opentripmap_search_city ---
server.tool(
  "opentripmap_search_city",
  "Get location data (coordinates, population, timezone) for a city by name using OpenTripMap",
  {
    name: z.string().describe("City name to search for (e.g. 'Paris', 'London', 'Tokyo')"),
  },
  async ({ name }) => {
    try {
      const data = await apiRequest("/geoname", { name });

      if (!data || data.status === "NOT_FOUND") {
        return textResult(`No city found for "${name}"`);
      }

      const lines = [
        `City: ${data.name || name}`,
        `Country: ${data.country || "Unknown"}`,
        `Latitude: ${data.lat}`,
        `Longitude: ${data.lon}`,
        data.population ? `Population: ${data.population.toLocaleString()}` : null,
        data.timezone ? `Timezone: ${data.timezone}` : null,
      ].filter(Boolean);

      return textResult(lines.join("\n"));
    } catch (err: any) {
      return textResult(`Error searching city: ${err.message}`);
    }
  }
);

// --- Tool: opentripmap_nearby_places ---
server.tool(
  "opentripmap_nearby_places",
  "Find points of interest near geographic coordinates. Returns tourist attractions, restaurants, museums, etc. within a given radius.",
  {
    lat: z.number().describe("Latitude of the center point"),
    lon: z.number().describe("Longitude of the center point"),
    radius: z
      .number()
      .optional()
      .describe("Search radius in meters (default: 1000, max: 50000)"),
    kinds: z
      .string()
      .optional()
      .describe(
        "Comma-separated filter for place types. Examples: restaurants, museums, churches, historic, cultural, natural, beaches, amusements, sport, tourist_facilities, accommodations, shops, foods"
      ),
  },
  async ({ lat, lon, radius, kinds }) => {
    try {
      const params: Record<string, string> = {
        lat: String(lat),
        lon: String(lon),
        radius: String(radius ?? 1000),
        format: "json",
        limit: "50",
      };
      if (kinds) params.kinds = kinds;

      const data = await apiRequest("/radius", params);

      if (!Array.isArray(data) || data.length === 0) {
        return textResult(
          `No places found within ${radius ?? 1000}m of (${lat}, ${lon})${kinds ? ` for kinds: ${kinds}` : ""}`
        );
      }

      const lines = data.map((place: any, i: number) => {
        const parts = [
          `${i + 1}. ${place.name || "(unnamed)"}`,
          `   ID: ${place.xid}`,
          place.kinds ? `   Types: ${place.kinds}` : null,
          place.dist !== undefined ? `   Distance: ${Math.round(place.dist)}m` : null,
          place.rate !== undefined ? `   Rating: ${place.rate}` : null,
        ].filter(Boolean);
        return parts.join("\n");
      });

      return textResult(
        `Found ${data.length} place(s) within ${radius ?? 1000}m of (${lat}, ${lon}):\n\n${lines.join("\n\n")}`
      );
    } catch (err: any) {
      return textResult(`Error finding nearby places: ${err.message}`);
    }
  }
);

// --- Tool: opentripmap_place_details ---
server.tool(
  "opentripmap_place_details",
  "Get detailed information about a specific place by its XID (place ID from search results). Returns name, description, address, website, image, and more.",
  {
    xid: z.string().describe("The place ID (xid) from search results"),
  },
  async ({ xid }) => {
    try {
      const data = await apiRequest(`/xid/${encodeURIComponent(xid)}`);

      if (!data || data.error) {
        return textResult(`No details found for place ID "${xid}"`);
      }

      const lines = [
        `Name: ${data.name || "(unnamed)"}`,
        data.kinds ? `Types: ${data.kinds}` : null,
        data.rate ? `Rating: ${data.rate}` : null,
        data.osm ? `OSM: ${data.osm}` : null,
        data.wikidata ? `Wikidata: ${data.wikidata}` : null,
      ].filter(Boolean);

      // Address
      if (data.address) {
        const addr = data.address;
        const addrParts = [
          addr.road,
          addr.house_number,
          addr.city || addr.town || addr.village,
          addr.state,
          addr.postcode,
          addr.country,
        ].filter(Boolean);
        if (addrParts.length > 0) {
          lines.push(`Address: ${addrParts.join(", ")}`);
        }
      }

      // Coordinates
      if (data.point) {
        lines.push(`Coordinates: ${data.point.lat}, ${data.point.lon}`);
      }

      // Links
      if (data.url) lines.push(`Website: ${data.url}`);
      if (data.wikipedia) lines.push(`Wikipedia: ${data.wikipedia}`);

      // Image
      if (data.image) lines.push(`Image: ${data.image}`);
      if (data.preview?.source) lines.push(`Preview: ${data.preview.source}`);

      // Description / Wikipedia extract
      if (data.wikipedia_extracts?.text) {
        lines.push(`\nDescription:\n${data.wikipedia_extracts.text}`);
      } else if (data.info?.descr) {
        lines.push(`\nDescription:\n${data.info.descr}`);
      }

      return textResult(lines.join("\n"));
    } catch (err: any) {
      return textResult(`Error getting place details: ${err.message}`);
    }
  }
);

// --- Tool: opentripmap_places_in_area ---
server.tool(
  "opentripmap_places_in_area",
  "Find points of interest within a geographic bounding box. Useful for searching an entire area on a map.",
  {
    lonMin: z.number().describe("Minimum longitude (western boundary)"),
    latMin: z.number().describe("Minimum latitude (southern boundary)"),
    lonMax: z.number().describe("Maximum longitude (eastern boundary)"),
    latMax: z.number().describe("Maximum latitude (northern boundary)"),
    kinds: z
      .string()
      .optional()
      .describe(
        "Comma-separated filter for place types. Examples: restaurants, museums, churches, historic, cultural, natural, beaches, amusements, sport, tourist_facilities, accommodations, shops, foods"
      ),
  },
  async ({ lonMin, latMin, lonMax, latMax, kinds }) => {
    try {
      const params: Record<string, string> = {
        lon_min: String(lonMin),
        lat_min: String(latMin),
        lon_max: String(lonMax),
        lat_max: String(latMax),
        format: "json",
        limit: "50",
      };
      if (kinds) params.kinds = kinds;

      const data = await apiRequest("/bbox", params);

      if (!Array.isArray(data) || data.length === 0) {
        return textResult(
          `No places found in bounding box (${latMin},${lonMin}) to (${latMax},${lonMax})${kinds ? ` for kinds: ${kinds}` : ""}`
        );
      }

      const lines = data.map((place: any, i: number) => {
        const parts = [
          `${i + 1}. ${place.name || "(unnamed)"}`,
          `   ID: ${place.xid}`,
          place.kinds ? `   Types: ${place.kinds}` : null,
          place.rate !== undefined ? `   Rating: ${place.rate}` : null,
          place.point
            ? `   Location: ${place.point.lat}, ${place.point.lon}`
            : null,
        ].filter(Boolean);
        return parts.join("\n");
      });

      return textResult(
        `Found ${data.length} place(s) in area:\n\n${lines.join("\n\n")}`
      );
    } catch (err: any) {
      return textResult(`Error finding places in area: ${err.message}`);
    }
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
