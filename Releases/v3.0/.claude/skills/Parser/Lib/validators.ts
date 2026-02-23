// Schema validation utilities for Content Schema

import type { ContentSchema, UUID_REGEX, ISO_8601_REGEX } from "../schema/schema.ts";
import { ContentType, PersonRole, MentionType, Sentiment, LinkType, Position, SourceType, AudienceSegment, TrendingPotential, ProcessingMethod } from "../schema/schema.ts";

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate complete ContentSchema object
 */
export function validateContentSchema(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    errors.push(new ValidationError("Data must be an object"));
    return { valid: false, errors, warnings };
  }

  const schema = data as Partial<ContentSchema>;

  // Validate all required top-level fields
  const requiredFields: (keyof ContentSchema)[] = [
    "content",
    "people",
    "companies",
    "topics",
    "links",
    "sources",
    "newsletter_metadata",
    "analysis",
    "extraction_metadata",
  ];

  for (const field of requiredFields) {
    if (!(field in schema)) {
      errors.push(new ValidationError(`Missing required field: ${field}`, field));
    }
  }

  // Validate each section
  if (schema.content) validateContent(schema.content, errors, warnings);
  if (schema.people) validatePeople(schema.people, errors, warnings);
  if (schema.companies) validateCompanies(schema.companies, errors, warnings);
  if (schema.topics) validateTopics(schema.topics, errors, warnings);
  if (schema.links) validateLinks(schema.links, errors, warnings);
  if (schema.sources) validateSources(schema.sources, errors, warnings);
  if (schema.newsletter_metadata) validateNewsletterMetadata(schema.newsletter_metadata, errors, warnings);
  if (schema.analysis) validateAnalysis(schema.analysis, errors, warnings);
  if (schema.extraction_metadata) validateExtractionMetadata(schema.extraction_metadata, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateContent(content: any, errors: ValidationError[], warnings: string[]): void {
  // Validate UUID
  if (!content.id || !UUID_REGEX.test(content.id)) {
    errors.push(new ValidationError("Invalid or missing UUID", "content.id"));
  }

  // Validate content type
  const validTypes: ContentType[] = ["article", "video", "pdf", "newsletter", "podcast", "tweet_thread", "generic"];
  if (!content.type || !validTypes.includes(content.type)) {
    errors.push(new ValidationError(`Invalid content type: ${content.type}`, "content.type"));
  }

  // Validate title
  if (!content.title || typeof content.title !== "string" || content.title.trim() === "") {
    errors.push(new ValidationError("Title is required and must be non-empty", "content.title"));
  }

  // Validate summary
  if (!content.summary) {
    errors.push(new ValidationError("Summary object is required", "content.summary"));
  } else {
    if (!content.summary.short) warnings.push("Short summary is empty");
    if (!content.summary.medium) warnings.push("Medium summary is empty");
    if (!content.summary.long) warnings.push("Long summary is empty");
  }

  // Validate metadata
  if (!content.metadata) {
    errors.push(new ValidationError("Metadata object is required", "content.metadata"));
  } else {
    if (!content.metadata.source_url) {
      errors.push(new ValidationError("source_url is required", "content.metadata.source_url"));
    }
    if (!content.metadata.accessed_date) {
      errors.push(new ValidationError("accessed_date is required", "content.metadata.accessed_date"));
    }
  }
}

function validatePeople(people: any[], errors: ValidationError[], warnings: string[]): void {
  if (!Array.isArray(people)) {
    errors.push(new ValidationError("people must be an array", "people"));
    return;
  }

  const validRoles: PersonRole[] = ["author", "subject", "mentioned", "quoted", "expert", "interviewer", "interviewee"];
  const validImportance = ["primary", "secondary", "minor"];

  people.forEach((person, index) => {
    if (!person.name) {
      errors.push(new ValidationError(`Person at index ${index} missing name`, `people[${index}].name`));
    }
    if (!person.role || !validRoles.includes(person.role)) {
      errors.push(new ValidationError(`Invalid role for person at index ${index}`, `people[${index}].role`));
    }
    if (!person.importance || !validImportance.includes(person.importance)) {
      errors.push(new ValidationError(`Invalid importance for person at index ${index}`, `people[${index}].importance`));
    }
    if (!person.context) {
      warnings.push(`Person at index ${index} missing context`);
    }
  });
}

function validateCompanies(companies: any[], errors: ValidationError[], warnings: string[]): void {
  if (!Array.isArray(companies)) {
    errors.push(new ValidationError("companies must be an array", "companies"));
    return;
  }

  const validMentionTypes: MentionType[] = ["subject", "source", "example", "competitor", "partner", "acquisition", "product", "other"];
  const validSentiment: Sentiment[] = ["positive", "neutral", "negative", "mixed"];

  companies.forEach((company, index) => {
    if (!company.name) {
      errors.push(new ValidationError(`Company at index ${index} missing name`, `companies[${index}].name`));
    }
    if (!company.mentioned_as || !validMentionTypes.includes(company.mentioned_as)) {
      errors.push(new ValidationError(`Invalid mentioned_as for company at index ${index}`, `companies[${index}].mentioned_as`));
    }
    if (!company.sentiment || !validSentiment.includes(company.sentiment)) {
      errors.push(new ValidationError(`Invalid sentiment for company at index ${index}`, `companies[${index}].sentiment`));
    }
  });
}

function validateTopics(topics: any, errors: ValidationError[], warnings: string[]): void {
  if (!topics.primary_category) {
    errors.push(new ValidationError("primary_category is required", "topics.primary_category"));
  }

  if (!Array.isArray(topics.secondary_categories)) {
    errors.push(new ValidationError("secondary_categories must be an array", "topics.secondary_categories"));
  }
  if (!Array.isArray(topics.tags)) {
    errors.push(new ValidationError("tags must be an array", "topics.tags"));
  } else if (topics.tags.length < 4) {
    warnings.push("tags array has fewer than 4 items (recommended: 4-10)");
  }
  if (!Array.isArray(topics.keywords)) {
    errors.push(new ValidationError("keywords must be an array", "topics.keywords"));
  } else if (topics.keywords.length < 5) {
    warnings.push("keywords array has fewer than 5 items (recommended: 5-15)");
  }
  if (!Array.isArray(topics.themes)) {
    errors.push(new ValidationError("themes must be an array", "topics.themes"));
  }
  if (!Array.isArray(topics.newsletter_sections)) {
    errors.push(new ValidationError("newsletter_sections must be an array", "topics.newsletter_sections"));
  }
}

function validateLinks(links: any[], errors: ValidationError[], warnings: string[]): void {
  if (!Array.isArray(links)) {
    errors.push(new ValidationError("links must be an array", "links"));
    return;
  }

  const validLinkTypes: LinkType[] = ["reference", "source", "related", "tool", "research", "product", "social", "other"];
  const validPositions: Position[] = ["beginning", "middle", "end", "sidebar", "footer"];

  links.forEach((link, index) => {
    if (!link.url) {
      errors.push(new ValidationError(`Link at index ${index} missing url`, `links[${index}].url`));
    }
    if (!link.domain) {
      errors.push(new ValidationError(`Link at index ${index} missing domain`, `links[${index}].domain`));
    }
    if (!link.link_type || !validLinkTypes.includes(link.link_type)) {
      errors.push(new ValidationError(`Invalid link_type for link at index ${index}`, `links[${index}].link_type`));
    }
    if (!link.position || !validPositions.includes(link.position)) {
      errors.push(new ValidationError(`Invalid position for link at index ${index}`, `links[${index}].position`));
    }
  });
}

function validateSources(sources: any[], errors: ValidationError[], warnings: string[]): void {
  if (!Array.isArray(sources)) {
    errors.push(new ValidationError("sources must be an array", "sources"));
    return;
  }

  const validSourceTypes: SourceType[] = ["research_paper", "news_article", "blog_post", "twitter_thread", "podcast", "video", "book", "other"];

  sources.forEach((source, index) => {
    if (!source.source_type || !validSourceTypes.includes(source.source_type)) {
      errors.push(new ValidationError(`Invalid source_type for source at index ${index}`, `sources[${index}].source_type`));
    }
  });
}

function validateNewsletterMetadata(metadata: any, errors: ValidationError[], warnings: string[]): void {
  if (typeof metadata.include_in_newsletter !== "boolean") {
    errors.push(new ValidationError("include_in_newsletter must be a boolean", "newsletter_metadata.include_in_newsletter"));
  }
}

function validateAnalysis(analysis: any, errors: ValidationError[], warnings: string[]): void {
  const validSentiment: Sentiment[] = ["positive", "neutral", "negative", "mixed"];
  const validTrending: TrendingPotential[] = ["low", "medium", "high"];
  const validAudience: AudienceSegment[] = ["security_professionals", "ai_researchers", "technologists", "executives", "entrepreneurs", "general_tech", "other"];

  if (!analysis.sentiment || !validSentiment.includes(analysis.sentiment)) {
    errors.push(new ValidationError("Invalid sentiment", "analysis.sentiment"));
  }

  // Validate scores (1-10)
  if (typeof analysis.importance_score !== "number" || analysis.importance_score < 1 || analysis.importance_score > 10) {
    errors.push(new ValidationError("importance_score must be 1-10", "analysis.importance_score"));
  }
  if (typeof analysis.novelty_score !== "number" || analysis.novelty_score < 1 || analysis.novelty_score > 10) {
    errors.push(new ValidationError("novelty_score must be 1-10", "analysis.novelty_score"));
  }
  if (typeof analysis.controversy_score !== "number" || analysis.controversy_score < 1 || analysis.controversy_score > 10) {
    errors.push(new ValidationError("controversy_score must be 1-10", "analysis.controversy_score"));
  }

  if (!analysis.trending_potential || !validTrending.includes(analysis.trending_potential)) {
    errors.push(new ValidationError("Invalid trending_potential", "analysis.trending_potential"));
  }

  if (!Array.isArray(analysis.relevance_to_audience)) {
    errors.push(new ValidationError("relevance_to_audience must be an array", "analysis.relevance_to_audience"));
  } else {
    analysis.relevance_to_audience.forEach((segment: string, index: number) => {
      if (!validAudience.includes(segment as AudienceSegment)) {
        errors.push(new ValidationError(`Invalid audience segment at index ${index}: ${segment}`, `analysis.relevance_to_audience[${index}]`));
      }
    });
  }

  if (!Array.isArray(analysis.key_insights)) {
    errors.push(new ValidationError("key_insights must be an array", "analysis.key_insights"));
  }
  if (!Array.isArray(analysis.related_content_ids)) {
    errors.push(new ValidationError("related_content_ids must be an array", "analysis.related_content_ids"));
  }
}

function validateExtractionMetadata(metadata: any, errors: ValidationError[], warnings: string[]): void {
  const validMethods: ProcessingMethod[] = ["gemini", "fabric", "hybrid", "manual"];

  if (!metadata.processed_date) {
    errors.push(new ValidationError("processed_date is required", "extraction_metadata.processed_date"));
  }
  if (!metadata.processing_method || !validMethods.includes(metadata.processing_method)) {
    errors.push(new ValidationError("Invalid processing_method", "extraction_metadata.processing_method"));
  }
  if (typeof metadata.confidence_score !== "number" || metadata.confidence_score < 0 || metadata.confidence_score > 1) {
    errors.push(new ValidationError("confidence_score must be 0-1", "extraction_metadata.confidence_score"));
  }
  if (!Array.isArray(metadata.warnings)) {
    errors.push(new ValidationError("warnings must be an array", "extraction_metadata.warnings"));
  }
  if (!metadata.version) {
    errors.push(new ValidationError("version is required", "extraction_metadata.version"));
  }
}

/**
 * Quick validation - throws on error
 */
export function assertValid(data: unknown): asserts data is ContentSchema {
  const result = validateContentSchema(data);
  if (!result.valid) {
    const errorMessages = result.errors.map(e => e.message).join("; ");
    throw new ValidationError(`Schema validation failed: ${errorMessages}`);
  }
}
