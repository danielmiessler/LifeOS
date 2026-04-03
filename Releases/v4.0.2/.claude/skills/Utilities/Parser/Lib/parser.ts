#!/usr/bin/env bun

/**
 * System Parser - Universal Content Parser for {YOUR_BUSINESS_NAME} Newsletter
 *
 * Usage:
 *   bun run parser.ts <URL>
 *   bun run parser.ts <URL1> <URL2> <URL3> (batch mode)
 *
 * Example:
 *   bun run parser.ts https://example.com/article
 */

import { v4 as uuidv4 } from "uuid";
import type { ContentSchema, ContentType } from "../schema/schema.ts";
import { validateContentSchema } from "./validators.ts";

// Configuration
const SCHEMA_VERSION = "1.0.0";

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun run parser.ts <URL> [URL2] [URL3] ...");
    console.error("\nExample:");
    console.error("  bun run parser.ts https://example.com/article");
    console.error("  bun run parser.ts https://youtube.com/watch?v=abc https://arxiv.org/pdf/123.pdf");
    process.exit(1);
  }

  const urls = args;
  console.log(`🚀 System Parser v${SCHEMA_VERSION}`);
  console.log(`📄 Processing ${urls.length} URL(s)\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${ i + 1}/${urls.length}] Processing: ${url}`);
    console.log("─".repeat(80));

    try {
      const result = await parseContent(url);
      successCount++;
      console.log(`✅ Success: ${result.filename}`);
      console.log(`📊 Stats: ${result.stats}`);
      console.log(`🎯 Confidence: ${result.confidence}`);
      if (result.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${result.warnings.length}`);
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
    } catch (error) {
      failCount++;
      console.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`📊 Batch Processing Complete`);
  console.log(`✅ Successful: ${successCount}/${urls.length}`);
  console.log(`❌ Failed: ${failCount}/${urls.length}`);
}

/**
 * Parse a single URL into ContentSchema
 */
async function parseContent(url: string): Promise<{
  filename: string;
  stats: string;
  confidence: number;
  warnings: string[];
}> {
  // Step 1: Detect content type
  console.log("1️⃣  Detecting content type...");
  const contentType = await detectContentType(url);
  console.log(`   Type: ${contentType}`);

  // Step 2: Extract content using appropriate method
  console.log("2️⃣  Extracting content...");
  const rawContent = await extractContent(url, contentType);
  console.log(`   Extracted: ${rawContent.word_count} words`);

  // Step 3: Analyze with Gemini (entity extraction, summarization, etc.)
  console.log("3️⃣  Analyzing with Gemini...");
  const analyzed = await analyzeWithGemini(rawContent);
  console.log(`   People: ${analyzed.people.length}, Companies: ${analyzed.companies.length}`);

  // Step 4: Populate schema
  console.log("4️⃣  Populating schema...");
  const schema = populateSchema(url, contentType, rawContent, analyzed);

  // Step 5: Validate
  console.log("5️⃣  Validating schema...");
  const validation = validateContentSchema(schema);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(", ")}`);
  }
  console.log(`   Valid: ✓ (${validation.warnings.length} warnings)`);

  // Step 6: Output JSON
  console.log("6️⃣  Writing output...");
  const filename = await writeOutput(schema);
  console.log(`   File: ${filename}`);

  // Return summary
  const stats = `${rawContent.word_count} words, ${analyzed.people.length} people, ${analyzed.companies.length} companies, ${analyzed.links.length} links`;
  return {
    filename,
    stats,
    confidence: schema.extraction_metadata.confidence_score,
    warnings: validation.warnings,
  };
}

/**
 * Detect content type from URL
 * See: Workflows/detect-content-type.md
 */
async function detectContentType(url: string): Promise<ContentType> {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const path = urlObj.pathname;

  // Domain-based detection
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
    return "video";
  }
  if (domain.includes("twitter.com") || domain.includes("x.com")) {
    if (path.includes("/status/")) {
      return "tweet_thread";
    }
  }
  if (domain.includes("substack.com") || domain.includes("beehiiv.com") ||
      domain.includes("convertkit.com") || domain.includes("ghost.io")) {
    return "newsletter";
  }
  if (domain.includes("arxiv.org") || path.endsWith(".pdf")) {
    return "pdf";
  }

  // Default to article
  return "article";
}

/**
 * Extract content using appropriate method for content type
 * See: Workflows/extract/*.md
 */
async function extractContent(url: string, type: ContentType): Promise<any> {
  // This is a placeholder - actual implementation would call:
  // - Fabric for YouTube transcripts
  // - Gemini Researcher for article scraping
  // - PDF extraction tools for PDFs
  // - etc.

  console.log(`   [Placeholder: would extract ${type} from ${url}]`);

  // Mock data for demonstration
  return {
    title: "Example Title",
    content: "This is example content that would be extracted from the URL.",
    word_count: 150,
    published_date: new Date().toISOString(),
  };
}

/**
 * Analyze content with Gemini for entity extraction, summarization, etc.
 * Uses prompts from prompts/ directory
 */
async function analyzeWithGemini(rawContent: any): Promise<any> {
  // This is a placeholder - actual implementation would:
  // - Send content to Gemini with entity extraction prompt
  // - Send content to Gemini with summarization prompt
  // - Send content to Gemini with topic classification prompt
  // - Send content to Gemini with link analysis prompt

  console.log(`   [Placeholder: would analyze with Gemini]`);

  // Mock data for demonstration
  return {
    people: [],
    companies: [],
    topics: {
      primary_category: "technology",
      secondary_categories: [],
      tags: ["example", "demo", "placeholder"],
      keywords: ["example", "demo"],
      themes: ["Example theme"],
      newsletter_sections: ["Headlines"],
    },
    links: [],
    summaries: {
      short: "Example short summary.",
      medium: "Example medium summary with more detail.",
      long: "Example long summary with comprehensive coverage of the topic.",
    },
    excerpts: ["Example excerpt"],
    analysis: {
      sentiment: "neutral" as const,
      importance_score: 5,
      novelty_score: 5,
      controversy_score: 3,
      relevance_to_audience: ["general_tech" as const],
      key_insights: ["Example insight"],
      trending_potential: "medium" as const,
    },
  };
}

/**
 * Populate complete ContentSchema
 */
function populateSchema(
  url: string,
  type: ContentType,
  rawContent: any,
  analyzed: any
): ContentSchema {
  const now = new Date().toISOString();

  return {
    content: {
      id: uuidv4(),
      type,
      title: rawContent.title,
      summary: {
        short: analyzed.summaries.short,
        medium: analyzed.summaries.medium,
        long: analyzed.summaries.long,
      },
      content: {
        full_text: rawContent.content,
        transcript: null,
        excerpts: analyzed.excerpts,
      },
      metadata: {
        source_url: url,
        canonical_url: url,
        published_date: rawContent.published_date || null,
        accessed_date: now,
        language: "en",
        word_count: rawContent.word_count,
        read_time_minutes: Math.ceil(rawContent.word_count / 200),
        author_platform: "other",
      },
    },
    people: analyzed.people,
    companies: analyzed.companies,
    topics: analyzed.topics,
    links: analyzed.links,
    sources: [],
    newsletter_metadata: {
      issue_number: null,
      section: null,
      position_in_section: null,
      editorial_note: null,
      include_in_newsletter: false,
      scheduled_date: null,
    },
    analysis: {
      ...analyzed.analysis,
      related_content_ids: [],
    },
    extraction_metadata: {
      processed_date: now,
      processing_method: "hybrid",
      confidence_score: 0.75,
      warnings: [],
      version: SCHEMA_VERSION,
    },
  };
}

/**
 * Write schema to JSON file
 */
async function writeOutput(schema: ContentSchema): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + "-" +
                    new Date().toISOString().replace(/[:.]/g, "-").split("T")[1].split("-")[0];
  const sanitizedTitle = schema.content.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);

  const filename = `${timestamp}_${sanitizedTitle}.json`;
  const json = JSON.stringify(schema, null, 2);

  await Bun.write(filename, json);
  return filename;
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
