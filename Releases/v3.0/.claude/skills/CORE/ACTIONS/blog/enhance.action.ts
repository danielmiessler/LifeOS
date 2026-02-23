#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: blog/enhance
 * ============================================================================
 *
 * Enhances a blog post with SEO metadata, social preview, and other publishing metadata.
 *
 * INPUT:  { content: string, generateImage?: boolean }
 * OUTPUT: { enhanced: string, seo: SEOData, socialPreview: SocialPreview }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const SEOSchema = z.object({
  title: z.string().describe("SEO-optimized title (50-60 chars)"),
  description: z.string().describe("Meta description (150-160 chars)"),
  keywords: z.array(z.string()).describe("Relevant keywords"),
  slug: z.string().describe("URL-friendly slug"),
});

const SocialPreviewSchema = z.object({
  ogTitle: z.string().describe("Open Graph title"),
  ogDescription: z.string().describe("Open Graph description"),
  twitterTitle: z.string().describe("Twitter card title"),
  twitterDescription: z.string().describe("Twitter card description"),
});

const InputSchema = z.object({
  content: z.string().min(1).describe("The blog post content"),
  customSlug: z.string().optional().describe("Override the auto-generated slug"),
  author: z.string().optional().default("{PRINCIPAL.NAME}").describe("Author name"),
});

const OutputSchema = z.object({
  enhanced: z.string().describe("Content with frontmatter added/updated"),
  seo: SEOSchema,
  socialPreview: SocialPreviewSchema,
  readingTime: z.number().describe("Estimated reading time in minutes"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 200); // Average 200 WPM
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : "Untitled";
}

export default defineAction<Input, Output>({
  name: "blog/enhance",
  version: "1.0.0",
  description: "Add SEO metadata and social preview data to a blog post",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["blog", "seo", "social", "metadata"],

  deployment: {
    timeout: 30000,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const title = extractTitle(input.content);
    const readingTime = estimateReadingTime(input.content);

    const systemPrompt = `You are an SEO and social media expert. Generate metadata for the following blog post.

The title is: "${title}"

Generate:
1. SEO title (50-60 characters, compelling, includes primary keyword)
2. Meta description (150-160 characters, includes call-to-action)
3. 5-8 relevant keywords
4. URL slug (lowercase, hyphenated, no special characters)
5. Open Graph title and description for Facebook/LinkedIn
6. Twitter card title and description

Respond ONLY with valid JSON:
{
  "seo": {
    "title": "SEO Title Here",
    "description": "Meta description here...",
    "keywords": ["keyword1", "keyword2"],
    "slug": "url-friendly-slug"
  },
  "socialPreview": {
    "ogTitle": "Open Graph Title",
    "ogDescription": "OG Description...",
    "twitterTitle": "Twitter Title",
    "twitterDescription": "Twitter description..."
  }
}`;

    const result = await inference({
      systemPrompt,
      userPrompt: input.content.substring(0, 3000), // First 3000 chars for context
      level: "fast",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to generate metadata: ${result.error || "No parsed output"}`);
    }

    const parsed = result.parsed as { seo: z.infer<typeof SEOSchema>; socialPreview: z.infer<typeof SocialPreviewSchema> };

    // Override slug if custom provided
    if (input.customSlug) {
      parsed.seo.slug = input.customSlug;
    }

    // Build frontmatter
    const date = new Date().toISOString().split("T")[0];
    const frontmatter = `---
title: "${parsed.seo.title}"
date: ${date}
author: ${input.author}
description: "${parsed.seo.description}"
keywords: [${parsed.seo.keywords.map(k => `"${k}"`).join(", ")}]
slug: ${parsed.seo.slug}
readingTime: ${readingTime}
og:
  title: "${parsed.socialPreview.ogTitle}"
  description: "${parsed.socialPreview.ogDescription}"
twitter:
  title: "${parsed.socialPreview.twitterTitle}"
  description: "${parsed.socialPreview.twitterDescription}"
---

`;

    // Remove existing frontmatter if present
    let contentBody = input.content;
    if (contentBody.startsWith("---")) {
      const endIndex = contentBody.indexOf("---", 3);
      if (endIndex !== -1) {
        contentBody = contentBody.substring(endIndex + 3).trim();
      }
    }

    return {
      enhanced: frontmatter + contentBody,
      seo: parsed.seo,
      socialPreview: parsed.socialPreview,
      readingTime,
    };
  },
});
