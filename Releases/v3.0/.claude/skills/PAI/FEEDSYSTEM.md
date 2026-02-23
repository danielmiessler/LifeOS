# The Feed System

**Turning information streams into routed intelligence.**

The Feed System is the sensor layer of the PAI/Arbol architecture. It monitors content sources, processes everything through an AI intelligence pipeline, and routes actionable items to the right destinations at the right priority.

This is not an RSS reader. It's an intelligence routing engine.

---

## The Vision

Raw information is noise. Intelligence is information that has been evaluated, prioritized, and delivered to the right place at the right time.

The Feed System implements this transformation:

```
NOISE (thousands of items/day from hundreds of sources)
    │
    ▼
INTELLIGENCE (rated, labeled, priority-routed to specific destinations)
```

**The key insight:** Different content deserves different treatment. A trusted security researcher posting about a national security issue with high urgency should trigger Telegram + Discord + email immediately. A mediocre blog post about a topic you've seen before should archive silently. The Feed System makes these routing decisions automatically using multi-dimensional ratings and configurable rules.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FEED SYSTEM                                     │
│                                                                         │
│  SOURCES           PROCESSING              ROUTING         DESTINATIONS │
│  ────────          ──────────              ───────         ──────────── │
│                                                                         │
│  People       ┌─► INGEST ──────────┐                                   │
│  Channels     │   (fetch, parse,    │                                   │
│  Feeds        │    normalize)       │   ┌─► ROUTE ──┬─► Telegram       │
│  Publications │                     │   │  (rules,  │                   │
│               │   SUMMARIZE ────────┤   │   AND     ├─► Discord        │
│  RSS          │   (Haiku: short +   │   │   logic,  │                   │
│  YouTube      │    medium)          │   │   priority)├─► Email         │
│  Twitter/X    │                     │   │           │                   │
│  Bluesky      │   RATE ─────────────┘   │           ├─► Blog Draft     │
│  LinkedIn     │   (5 dimensions +       │           │                   │
│  Mastodon     │    20 labels)    ───────┘           ├─► Social Post    │
│  Blogs        │                                     │                   │
│  Newsletters  │                                     ├─► Daily Digest   │
│  Podcasts     │                                     │                   │
│               │                                     └─► Archive        │
│               │                                                         │
│  Each source has:                                                       │
│  • credibility/priority                                                 │
│  • poll interval                                                        │
│  • compute type (cloud/local)                                           │
│  • tags + expertise                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Intelligence Pipeline

Every piece of content flows through four stages:

### Stage 1: Ingest

Fetch content from the source, parse it, normalize to a standard format.

| Source Type | Method | Compute |
|-------------|--------|---------|
| RSS/Atom feeds | HTTP fetch + XML parse | Cloud (Workers) |
| YouTube | yt-dlp transcript extraction | Local (PAI daemon) |
| Twitter/X | API or scraping | Cloud |
| Podcasts | Download + Whisper transcription | Local |
| Blogs | HTTP fetch + HTML extraction | Cloud |

**Output:** Normalized item with `title`, `content`, `url`, `source_id`, `source_type`.

### Stage 2: Summarize

AI generates two summary levels:

| Summary | Purpose |
|---------|---------|
| `summary_short` | One sentence. For notifications and digests. |
| `summary_medium` | One paragraph. For email and dashboard display. |

**Model:** Claude Haiku (fast tier). Information-dense, preserves facts/claims/conclusions.

### Stage 3: Rate

Multi-dimensional AI evaluation:

| Dimension | Scale | Purpose |
|-----------|-------|---------|
| **Tier** | S / A / B / C / D | Overall quality bracket |
| **Quality Score** | 1-100 | Granular quality within tier |
| **Importance** | 1-10 | How significant is this content? |
| **Novelty** | 1-10 | How new/unique is this information? |
| **Urgency** | 1-10 | How time-sensitive is this? |

Plus **20 labels** from a fixed taxonomy:

```
Security, AI, Technology, Business, Geopolitics, Science,
Culture, Health, Privacy, OSINT, Military, Innovation,
Leadership, Philosophy, Tutorial, Podcast, Newsletter,
Research, Policy, Breaking
```

**Tier definitions:**

| Tier | Meaning |
|------|---------|
| **S** | Groundbreaking. Must act on immediately. |
| **A** | Excellent. Must-read. High insight density. |
| **B** | Good. Worth reading. |
| **C** | Average. Skim-worthy. |
| **D** | Low value. Skip. |

### Stage 4: Route

Pure logic engine (no LLM) that evaluates rules against rated items.

**Rule format:**
```json
{
  "name": "Critical security alerts",
  "conditions": {
    "tier": ["S", "A"],
    "urgency": { "gte": 8 },
    "labels": { "includes": ["Security"] }
  },
  "actions": ["notify"],
  "priority": "immediate"
}
```

**Condition logic:** All conditions use AND. An item must match ALL conditions in a rule to trigger its actions.

**Numeric conditions:** `gte` (>=), `lte` (<=), `eq` (==)
**Label conditions:** `includes` (item has at least one matching label)
**Tier conditions:** Array of acceptable tiers

---

## Routing Rules

Rules are the core of the intelligence routing. They encode what matters and how to respond.

### Rule Examples

| Rule | Conditions | Action | Priority |
|------|-----------|--------|----------|
| Critical security | tier S/A + urgency >= 8 + Security label | notify (Telegram, Discord, email) | immediate |
| High-quality AI content | tier S/A + AI label + quality >= 80 | blog-draft + social-post | daily |
| Breaking news | Breaking label + urgency >= 9 | notify (Telegram) | immediate |
| Weekly digest material | tier B+ + importance >= 6 | digest | weekly |
| Everything else | (default) | archive | archive |

### Priority Levels

| Priority | Meaning | Delivery |
|----------|---------|----------|
| **immediate** | Act now | Push notification: Telegram, Discord, email |
| **daily** | Review today | Included in daily digest/queue |
| **weekly** | Review this week | Included in weekly compilation |
| **archive** | Store for reference | No active delivery |

### Destinations

| Destination | Action | Implementation |
|-------------|--------|----------------|
| `notify` | Push alert to messaging platforms | Telegram, Discord, Email via respective APIs |
| `blog-draft` | Create draft post on yourdomain.com | Your blogging skill integration |
| `social-post` | Generate and queue social media post | Your social posting skill |
| `digest` | Accumulate for periodic compilation | Daily/weekly digest builder |
| `archive` | Store without action | D1 + R2 storage only |

---

## Relationship to Arbol

The Feed System runs on the **Arbol** Cloudflare Workers platform. The feed actions are (or will be) deployed as Arbol Workers following the same patterns as all other Arbol infrastructure.

### Current State → Target State

| Component | Current | Target |
|-----------|---------|--------|
| `feed/ingest` | Local PAI action | `A_FEED_INGEST` → `arbol-a-feed-ingest` Worker |
| `feed/summarize` | Local PAI action | `A_FEED_SUMMARIZE` → `arbol-a-feed-summarize` Worker |
| `feed/rate` | Local PAI action | `A_FEED_RATE` → `arbol-a-feed-rate` Worker |
| `feed/route` | Local PAI action | `A_FEED_ROUTE` → `arbol-a-feed-route` Worker |
| Feed API | Cloudflare Worker (`feed-api`) | Stays as-is |
| Feed Poller | Not yet deployed | `feed-poller` Worker with Cron Trigger |
| Feed Processor | Not yet deployed | `feed-processor` Worker (Queue consumer) |
| Feed Dispatcher | Not yet deployed | `feed-dispatcher` Worker (Queue consumer) |

### How Feed Powers Arbol Workflows

The Feed System is the **source layer** for the Arbol platform. It generates the content that downstream actions, pipelines, and flows operate on:

```
Feed System (sources + intelligence)
    │
    ├─► F_HN_LABEL_EMAIL (HN → rate → email)
    │
    ├─► F_YOUTUBE_DIGEST (YouTube → transcribe → rate → digest)
    │
    ├─► F_SECURITY_ALERTS (Security feeds → rate → notify if urgent)
    │
    └─► F_SOCIAL_CONTENT (High-rated items → generate posts → queue)
```

Every flow in Arbol that processes external content starts with the Feed System. The intelligence pipeline (ingest → summarize → rate → route) is the common backbone. Flows just connect specific sources to specific pipelines on specific schedules.

---

## Infrastructure

### Cloud (Cloudflare)

| Service | Purpose |
|---------|---------|
| **D1** | Metadata database: sources, items, ratings, routing rules |
| **R2** | Content storage: full text, transcripts, media |
| **Queues** | Async processing: decouple ingest from processing |
| **Workers** | Compute: all actions, pipelines, flows, API |
| **Cron Triggers** | Scheduling: poll sources on configurable intervals |

### Local (PAI Daemon)

Some content types require tools unavailable in Workers:

| Tool | Purpose | Source Types |
|------|---------|-------------|
| `yt-dlp` | YouTube transcript/video download | YouTube |
| `whisper` | Audio transcription | Podcasts |
| `ffmpeg` | Media processing | Video, Audio |

The `compute_type` field on each source routes items to the correct processing environment:
- `cloud` → Cloudflare Queue → Workers consumer
- `local` → Cloudflare Queue → PAI daemon consumer

### Data Model

**4 tables:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `feed_sources` | Source definitions | name, category, platform URLs, tags, priority, compute_type, poll_interval |
| `feed_items` | Processed content | source_id, title, content, tier, quality_score, importance, novelty, urgency, labels, priority, status |
| `feed_routing_rules` | Rule definitions | name, conditions (JSON), actions (JSON), priority, active |
| `feed_processing_log` | Execution tracking | item_id, action, duration, tokens, cost |

**Item lifecycle:** `ingested` → `processing` → `processed` → `dispatched`

### Cost Model

| Component | Monthly |
|-----------|---------|
| Cloudflare Workers/D1/R2 | ~$5 |
| Summarize (Cloudflare AI) | ~$0.60 |
| Rate (Claude Haiku) | ~$6 |
| Weekly deep analysis (Claude Sonnet) | ~$2 |
| Social API access | Varies |
| **Total** | **~$15 + API costs** |

---

## Source Management

Sources represent the information streams being monitored. Each source has:

| Field | Purpose |
|-------|---------|
| **name** | Source identity (person, publication, channel) |
| **category** | `person`, `publication`, `channel`, `feed` |
| **priority** | `critical`, `high`, `normal`, `low` — affects routing weight |
| **expertise** | Free text describing the source's domain knowledge |
| **tags** | Topic tags for categorization |
| **Platform URLs** | RSS, YouTube, Twitter, Bluesky, LinkedIn, Mastodon, blog, newsletter, website |
| **poll_interval_minutes** | How often to check (default: 60) |
| **compute_type** | `cloud` or `local` — determines processing environment |

Sources are managed through the Feed API and visible in the Admin dashboard at `your-admin-dashboard.example.com/feed`.

---

## The Bigger Picture

The Feed System transforms PAI from a reactive assistant into a proactive intelligence network. Instead of waiting for questions, it:

1. **Monitors** — continuously polls sources across platforms
2. **Evaluates** — AI rates everything on 5 dimensions with 20 labels
3. **Routes** — configurable rules determine what deserves attention
4. **Delivers** — right content reaches the right destination at the right priority
5. **Powers** — downstream Arbol workflows (social posts, blog drafts, digests) consume feed intelligence

The goal: never miss important content, never be overwhelmed by noise.

---

## See Also

- See the Feed skill documentation for operational reference
- `ACTIONS/README.md` — Action definitions including feed actions
- `PIPELINES/README.md` — Pipeline definitions including feed pipelines
- `FLOWS/README.md` — Flow definitions connecting sources to pipelines
- `~/Projects/your-project/` — Cloudflare Workers implementation

---

**Last Updated:** 2026-02-01
