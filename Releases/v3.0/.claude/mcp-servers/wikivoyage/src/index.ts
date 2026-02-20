#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://en.wikivoyage.org/w/api.php";
const USER_AGENT = "MCP-Wikivoyage-Server/1.0 (travel planning tool)";

async function wikiRequest(params: Record<string, string>): Promise<any> {
  const url = new URL(BASE_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Wikivoyage API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const server = new McpServer({
  name: "wikivoyage",
  version: "1.0.0",
});

// Tool 1: Search for travel destinations
server.tool(
  "wikivoyage_search",
  "Search Wikivoyage for travel destinations and guides",
  {
    query: z.string().describe("Search query for travel destinations"),
    limit: z.number().optional().default(5).describe("Max results to return (default 5)"),
  },
  async ({ query, limit }) => {
    const data = await wikiRequest({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(limit),
    });

    const results = data.query?.search ?? [];

    if (results.length === 0) {
      return {
        content: [{ type: "text" as const, text: `No Wikivoyage results found for "${query}".` }],
      };
    }

    const formatted = results
      .map((r: any, i: number) => {
        const snippet = stripHtml(r.snippet);
        return `${i + 1}. **${r.title}**\n   ${snippet}`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Wikivoyage search results for "${query}":\n\n${formatted}\n\nUse wikivoyage_get_guide to read the full travel guide for any destination.`,
        },
      ],
    };
  }
);

// Tool 2: Get full travel guide
server.tool(
  "wikivoyage_get_guide",
  "Get the full travel guide for a destination from Wikivoyage",
  {
    destination: z.string().describe("Page title of the destination (e.g. 'Paris', 'Barcelona')"),
  },
  async ({ destination }) => {
    const data = await wikiRequest({
      action: "query",
      titles: destination,
      prop: "extracts",
      explaintext: "true",
    });

    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;

    if (!page || page.missing !== undefined) {
      return {
        content: [{ type: "text" as const, text: `No Wikivoyage guide found for "${destination}". Try searching with wikivoyage_search first.` }],
      };
    }

    let extract: string = page.extract ?? "";
    const MAX_CHARS = 5000;
    let truncated = false;

    if (extract.length > MAX_CHARS) {
      extract = extract.slice(0, MAX_CHARS);
      truncated = true;
    }

    let text = `# ${page.title} - Wikivoyage Travel Guide\n\n${extract}`;
    if (truncated) {
      text += `\n\n---\n[Truncated - full article is longer. Use wikivoyage_get_section to read specific sections like "Eat", "Sleep", "See", "Do", "Get in", "Get around", "Drink".]`;
    }

    return {
      content: [{ type: "text" as const, text }],
    };
  }
);

// Tool 3: Get specific section
server.tool(
  "wikivoyage_get_section",
  "Get a specific section of a destination guide (e.g. Eat, Sleep, See, Do, Get in)",
  {
    destination: z.string().describe("Page title of the destination (e.g. 'Paris', 'Barcelona')"),
    section: z.string().describe("Section name (e.g. 'Eat', 'Sleep', 'Drink', 'See', 'Do', 'Get in', 'Get around')"),
  },
  async ({ destination, section }) => {
    // First, get sections list
    const sectionsData = await wikiRequest({
      action: "parse",
      page: destination,
      prop: "sections",
    });

    if (sectionsData.error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${sectionsData.error.info ?? "Could not find page"}. Try searching with wikivoyage_search first.` }],
      };
    }

    const sections = sectionsData.parse?.sections ?? [];
    const sectionLower = section.toLowerCase();

    const match = sections.find(
      (s: any) => s.line.toLowerCase() === sectionLower
    );

    if (!match) {
      const available = sections.map((s: any) => s.line).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Section "${section}" not found in the ${destination} guide.\n\nAvailable sections: ${available}`,
          },
        ],
      };
    }

    // Fetch section content
    const sectionContent = await wikiRequest({
      action: "parse",
      page: destination,
      section: match.index,
      prop: "text",
    });

    const html = sectionContent.parse?.text?.["*"] ?? "";
    const plainText = stripHtml(html);

    if (!plainText) {
      return {
        content: [{ type: "text" as const, text: `The "${section}" section for ${destination} appears to be empty.` }],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `# ${destination} - ${match.line}\n\n${plainText}`,
        },
      ],
    };
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
