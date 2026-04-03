// TypeScript types for {YOUR_BUSINESS_NAME} Content Schema v1.0.0
// Matches schema/content-schema.json

export interface ContentSchema {
  content: Content;
  people: Person[];
  companies: Company[];
  topics: Topics;
  links: Link[];
  sources: Source[];
  newsletter_metadata: NewsletterMetadata;
  analysis: Analysis;
  extraction_metadata: ExtractionMetadata;
}

// Content section
export interface Content {
  id: string; // UUID v4
  type: ContentType;
  title: string;
  summary: Summary;
  content: ContentBody;
  metadata: ContentMetadata;
}

export type ContentType =
  | "article"
  | "video"
  | "pdf"
  | "newsletter"
  | "podcast"
  | "tweet_thread"
  | "generic";

export interface Summary {
  short: string; // 1-2 sentences
  medium: string; // paragraph
  long: string; // multiple paragraphs
}

export interface ContentBody {
  full_text: string | null;
  transcript: string | null;
  excerpts: string[];
}

export interface ContentMetadata {
  source_url: string;
  canonical_url: string | null;
  published_date: string | null; // ISO 8601
  accessed_date: string; // ISO 8601
  language: string;
  word_count: number | null;
  read_time_minutes: number | null;
  author_platform: AuthorPlatform;
}

export type AuthorPlatform =
  | "youtube"
  | "substack"
  | "blog"
  | "news_site"
  | "twitter"
  | "arxiv"
  | "medium"
  | "linkedin"
  | "other";

// People section
export interface Person {
  name: string;
  role: PersonRole;
  title: string | null;
  company: string | null;
  social: SocialHandles;
  context: string;
  importance: Importance;
}

export type PersonRole =
  | "author"
  | "subject"
  | "mentioned"
  | "quoted"
  | "expert"
  | "interviewer"
  | "interviewee";

export interface SocialHandles {
  twitter: string | null; // @handle
  linkedin: string | null; // URL
  email: string | null;
  website: string | null; // URL
}

export type Importance = "primary" | "secondary" | "minor";

// Companies section
export interface Company {
  name: string;
  domain: string | null;
  industry: string | null;
  context: string;
  mentioned_as: MentionType;
  sentiment: Sentiment;
}

export type MentionType =
  | "subject"
  | "source"
  | "example"
  | "competitor"
  | "partner"
  | "acquisition"
  | "product"
  | "other";

export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

// Topics section
export interface Topics {
  primary_category: string;
  secondary_categories: string[];
  tags: string[];
  keywords: string[];
  themes: string[];
  newsletter_sections: string[];
}

// Links section
export interface Link {
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  link_type: LinkType;
  context: string;
  position: Position;
}

export type LinkType =
  | "reference"
  | "source"
  | "related"
  | "tool"
  | "research"
  | "product"
  | "social"
  | "other";

export type Position = "beginning" | "middle" | "end" | "sidebar" | "footer";

// Sources section
export interface Source {
  publication: string | null;
  author: string | null;
  url: string | null;
  published_date: string | null; // ISO 8601
  source_type: SourceType;
}

export type SourceType =
  | "research_paper"
  | "news_article"
  | "blog_post"
  | "twitter_thread"
  | "podcast"
  | "video"
  | "book"
  | "other";

// Newsletter metadata section
export interface NewsletterMetadata {
  issue_number: number | null;
  section: string | null;
  position_in_section: number | null;
  editorial_note: string | null;
  include_in_newsletter: boolean;
  scheduled_date: string | null; // ISO 8601
}

// Analysis section
export interface Analysis {
  sentiment: Sentiment;
  importance_score: number; // 1-10
  novelty_score: number; // 1-10
  controversy_score: number; // 1-10
  relevance_to_audience: AudienceSegment[];
  key_insights: string[];
  related_content_ids: string[]; // UUIDs
  trending_potential: TrendingPotential;
}

export type AudienceSegment =
  | "security_professionals"
  | "ai_researchers"
  | "technologists"
  | "executives"
  | "entrepreneurs"
  | "general_tech"
  | "other";

export type TrendingPotential = "low" | "medium" | "high";

// Extraction metadata section
export interface ExtractionMetadata {
  processed_date: string; // ISO 8601
  processing_method: ProcessingMethod;
  confidence_score: number; // 0-1
  warnings: string[];
  version: string; // e.g., "1.0.0"
}

export type ProcessingMethod = "gemini" | "fabric" | "hybrid" | "manual";

// Helper type for partial schema during construction
export type PartialContentSchema = Partial<ContentSchema>;

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 date validation (basic)
export const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
