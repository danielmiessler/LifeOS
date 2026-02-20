#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const FSQ_API_BASE = "https://api.foursquare.com/v3";
const FSQ_SERVICE_TOKEN = process.env.FOURSQUARE_SERVICE_TOKEN;

if (!FSQ_SERVICE_TOKEN) {
  console.error("FOURSQUARE_SERVICE_TOKEN environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "foursquare",
  version: "1.0.0",
});

async function fsqRequest(
  endpoint: string,
  params: Record<string, string | number>
): Promise<string> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  const url = `${FSQ_API_BASE}${endpoint}?${searchParams.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: FSQ_SERVICE_TOKEN,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return JSON.stringify({
        error: `Foursquare API error: ${res.status} ${res.statusText}`,
        detail: body,
      });
    }

    return await res.text();
  } catch (err) {
    return JSON.stringify({
      error: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// --- Tool: search_near ---
// Search for places near a named region
server.tool(
  "search_near",
  "Search for places near a particular named region (e.g. city, neighborhood)",
  {
    where: z
      .string()
      .describe(
        "A geographic region (e.g. 'Los Angeles', 'Fort Greene', 'Tokyo')"
      ),
    what: z
      .string()
      .describe(
        "Concept you are looking for (e.g. 'coffee shop', 'Hard Rock Cafe', 'sushi')"
      ),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Number of results to return (default 5, max 50)"),
  },
  async ({ where, what, limit }) => {
    const data = await fsqRequest("/places/search", {
      query: what,
      near: where,
      limit: Math.min(limit ?? 5, 50),
    });

    return {
      content: [{ type: "text" as const, text: data }],
    };
  }
);

// --- Tool: search_near_point ---
// Search for places near specific lat/lng coordinates
server.tool(
  "search_near_point",
  "Search for places near a specific latitude/longitude point",
  {
    what: z
      .string()
      .describe(
        "Concept you are looking for (e.g. 'coffee shop', 'Hard Rock Cafe')"
      ),
    ll: z
      .string()
      .describe(
        "Comma-separated latitude and longitude pair (e.g. '40.74,-74.0')"
      ),
    radius: z
      .number()
      .describe("Search radius in meters (e.g. 1000)"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Number of results to return (default 5, max 50)"),
  },
  async ({ what, ll, radius, limit }) => {
    const data = await fsqRequest("/places/search", {
      query: what,
      ll,
      radius,
      limit: Math.min(limit ?? 5, 50),
    });

    return {
      content: [{ type: "text" as const, text: data }],
    };
  }
);

// --- Tool: place_snap ---
// Match a place based on location (geotagging candidate)
server.tool(
  "place_snap",
  "Get the most likely place the user is at based on their reported location (geotagging)",
  {
    ll: z
      .string()
      .describe(
        "Comma-separated latitude and longitude pair (e.g. '40.74,-74.0')"
      ),
  },
  async ({ ll }) => {
    const data = await fsqRequest("/places/search", {
      ll,
      limit: 1,
    });

    return {
      content: [{ type: "text" as const, text: data }],
    };
  }
);

// --- Tool: place_details ---
// Get detailed information about a specific place by Foursquare ID
server.tool(
  "place_details",
  "Get detailed information about a place by its Foursquare ID (fsq_id), including description, phone, website, social media, hours, popular hours, rating, price, menu, photos, tips, tastes, and features",
  {
    id: z
      .string()
      .describe("The Foursquare place ID (fsq_id)"),
  },
  async ({ id }) => {
    const data = await fsqRequest(`/places/${encodeURIComponent(id)}`, {
      fields:
        "description,tel,website,social_media,hours,hours_popular,rating,price,menu,photos,tips,tastes,attributes",
    });

    return {
      content: [{ type: "text" as const, text: data }],
    };
  }
);

// --- Tool: get_location ---
// Approximate user location via IP geolocation
server.tool(
  "get_location",
  "Get the user's approximate location based on IP address geolocation. Useful when the user has not provided their own precise location.",
  {},
  async () => {
    try {
      const res = await fetch("http://ip-api.com/json/?fields=lat,lon,city,regionName,country,status", {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Could not determine location from IP address",
            },
          ],
        };
      }

      const data = (await res.json()) as {
        status: string;
        lat?: number;
        lon?: number;
        city?: string;
        regionName?: string;
        country?: string;
      };

      if (data.status !== "success" || data.lat == null || data.lon == null) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Could not determine location from IP address",
            },
          ],
        };
      }

      const locationStr = [data.city, data.regionName, data.country]
        .filter(Boolean)
        .join(", ");

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.lat},${data.lon} (${locationStr} - approximation via IP geolocation)`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: "Could not determine location from IP address",
          },
        ],
      };
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
