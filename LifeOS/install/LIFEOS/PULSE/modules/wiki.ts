/**
 * LifeOS Pulse - Wiki Module
 *
 * Backend API for the Documentation, Knowledge, Skills, Hooks, and
 * Arbol views in Pulse.
 *
 * Route prefixes handled:
 *   GET /api/wiki
 *   GET /api/wiki/doc/:slug
 *   GET /api/wiki/knowledge/:domain/:slug
 *   GET /api/wiki/search?q=query
 *   GET /api/wiki/backlinks/:slug
 *   GET /api/wiki/graph
 *   GET /api/wiki/skills
 *   GET /api/wiki/skills/:name
 *   PUT /api/wiki/skills/:name
 *   GET /api/wiki/hooks
 *   GET /api/wiki/hooks/:name
 *   GET /api/wiki/arbol
 *   GET /api/wiki/arbol/:name
 */

import { basename, join, relative } from "path"
import {
  Dirent,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  watch,
  writeFileSync,
} from "fs"
import MiniSearch from "minisearch"
import { claudeDir } from "../../TOOLS/lifeos-root";

// Path Construction

const HOME = process.env.HOME ?? "~"
const LIFEOS_DIR = join(claudeDir(), "LIFEOS")
const DOCUMENTATION_DIR = join(LIFEOS_DIR, "DOCUMENTATION")
const KNOWLEDGE_DIR = join(LIFEOS_DIR, "MEMORY", "KNOWLEDGE")
const ALGORITHM_DIR = join(LIFEOS_DIR, "ALGORITHM")
const SKILLS_DIR = join(claudeDir(), "skills")
const HOOKS_DIR = join(claudeDir(), "hooks")
const SETTINGS_PATH = join(claudeDir(), "settings.json")
const ARBOL_WORKERS_DIR = join(LIFEOS_DIR, "USER", "CUSTOMIZATIONS", "ARBOL", "Workers")

const SYSTEM_PROMPT_PATH = join(LIFEOS_DIR, "LIFEOS_SYSTEM_PROMPT.md")
const KNOWLEDGE_DOMAINS = ["People", "Companies", "Ideas", "Blogs", "Books", "Research"] as const
type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number]

// Types

interface WikiPage {
  slug: string
  title: string
  category: string
  tags: string[]
  quality: number | null
  lastModified: string
  wordCount: number
  wikilinks: string[]
  filePath: string
  group?: string
  related?: string[]
  author?: string
  source?: string
  sourceUrl?: string
  postDate?: string
}

interface TreeNode {
  label: string
  slug?: string
  category?: string
  children?: TreeNode[]
  count?: number
}

interface BacklinkEntry {
  slug: string
  title: string
  category: string
}

interface IndexOptions {
  category: string
  slug?: string
  group?: string
}

// State

const pageIndex: Map<string, WikiPage> = new Map()
const backlinkIndex: Map<string, BacklinkEntry[]> = new Map()
let searchIndex: MiniSearch | null = null
let moduleStartedAt: string | null = null
let lastIndexedAt: string | null = null

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

// Filesystem Helpers

function isMarkdownFile(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith(".")
}

function stripMarkdownExtension(filename: string): string {
  return filename.replace(/\.md$/i, "")
}

function pathParts(pathValue: string): string[] {
  return pathValue.split(/[\\/]+/).filter(Boolean)
}

function walkMarkdown(dir: string): string[] {
  const files: string[] = []
  if (!existsSync(dir)) return files

  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkMarkdown(entryPath))
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      files.push(entryPath)
    }
  }

  return files.sort((a, b) => naturalCollator.compare(a, b))
}

function systemDocMetadata(filePath: string): { slug: string; group: string } | null {
  if (filePath === SYSTEM_PROMPT_PATH) {
    return { slug: "LIFEOS_SYSTEM_PROMPT", group: "Overview" }
  }

  if (filePath.startsWith(DOCUMENTATION_DIR)) {
    const rel = relative(DOCUMENTATION_DIR, filePath)
    if (rel.startsWith("..")) return null

    const relParts = pathParts(rel)
    const filename = relParts[relParts.length - 1]
    const bareSlug = stripMarkdownExtension(filename)

    if (relParts.length === 1) {
      return { slug: bareSlug, group: "Overview" }
    }

    const group = relParts[relParts.length - 2]
    return { slug: `${group}__${bareSlug}`, group }
  }

  if (filePath.startsWith(ALGORITHM_DIR)) {
    const filename = basename(filePath)
    return {
      slug: `Algorithm__${stripMarkdownExtension(filename)}`,
      group: "Algorithm",
    }
  }

  return null
}

// Frontmatter Parser

function parseFrontmatter(
  content: string
): Record<string, string | string[] | number> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result: Record<string, string | string[] | number> = {}
  const lines = match[1].split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const idx = line.indexOf(":")
    if (idx === -1) continue

    const key = line.substring(0, idx).trim()
    let value = line.substring(idx + 1).trim()
    if (line.startsWith(" ") || line.startsWith("\t") || !key) continue

    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
      continue
    }

    // Block sequence: key:\n  - slug: foo\n    type: bar
    if (value === "" && i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
      const arr: string[] = []
      let j = i + 1
      while (j < lines.length && /^\s+/.test(lines[j])) {
        const m = lines[j].match(/^\s+-\s+slug:\s*(.+)$/)
        if (m) arr.push(m[1].trim().replace(/^["']|["']$/g, ""))
        j++
      }
      if (arr.length > 0) {
        result[key] = arr
        i = j - 1
        continue
      }
    }

    if (key === "quality") {
      const num = parseInt(value, 10)
      if (!Number.isNaN(num)) {
        result[key] = num
        continue
      }
    }

    value = value.replace(/^["']|["']$/g, "")
    result[key] = value
  }

  return result
}

// Content Extraction

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
}

function extractTitle(
  content: string,
  fm: Record<string, unknown>,
  filename: string
): string {
  if (fm.title) return String(fm.title)
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()
  return stripMarkdownExtension(filename)
}

function normalizeWikilink(raw: string): string {
  const [target] = raw.split("|")
  const [slug] = target.split("#")
  return slug.trim()
}

function extractWikilinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g)
  const links: string[] = []

  for (const match of matches) {
    const slug = normalizeWikilink(match[1])
    if (slug) links.push(slug)
  }

  return [...new Set(links)]
}

function countWords(content: string): number {
  const body = stripFrontmatter(content)
  return body.split(/\s+/).filter(Boolean).length
}

function stringArrayFromFrontmatter(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

// Index a Single File

function indexFile(filePath: string, options: IndexOptions): WikiPage | null {
  try {
    if (!existsSync(filePath)) return null

    const raw = readFileSync(filePath, "utf-8")
    const fm = parseFrontmatter(raw)
    const filename = basename(filePath)
    const slug = options.slug ?? stripMarkdownExtension(filename)

    let mtime: string
    try {
      mtime = statSync(filePath).mtime.toISOString()
    } catch {
      mtime = new Date().toISOString()
    }

    return {
      slug,
      title: extractTitle(raw, fm, filename),
      category: options.category,
      tags: stringArrayFromFrontmatter(fm.tags),
      quality: typeof fm.quality === "number" ? fm.quality : null,
      lastModified: mtime,
      wordCount: countWords(raw),
      wikilinks: extractWikilinks(raw),
      filePath,
      group: options.group,
      related: stringArrayFromFrontmatter(fm.related),
      author: typeof fm.source_author === "string" ? fm.source_author : (typeof fm.author === "string" ? fm.author : undefined),
      source: typeof fm.source_name === "string" ? fm.source_name : (typeof fm.source === "string" ? fm.source : undefined),
      sourceUrl: typeof fm.source_url === "string" ? fm.source_url : undefined,
      postDate: typeof fm.source_date === "string" ? fm.source_date : (typeof fm.post_date === "string" ? fm.post_date : undefined),
    }
  } catch {
    return null
  }
}

// System Documentation Indexing

function indexSystemDoc(filePath: string): void {
  const metadata = systemDocMetadata(filePath)
  if (!metadata) return

  const page = indexFile(filePath, {
    category: "system-doc",
    slug: metadata.slug,
    group: metadata.group,
  })

  if (page) pageIndex.set(page.slug, page)
}

function indexSystemDocs(): void {
  indexSystemDoc(SYSTEM_PROMPT_PATH)

  for (const filePath of walkMarkdown(DOCUMENTATION_DIR)) {
    indexSystemDoc(filePath)
  }

  if (!existsSync(ALGORITHM_DIR)) return

  try {
    const algorithmFiles = readdirSync(ALGORITHM_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isMarkdownFile(entry.name))
      .map((entry) => join(ALGORITHM_DIR, entry.name))
      .sort((a, b) => naturalCollator.compare(a, b))

    for (const filePath of algorithmFiles) {
      indexSystemDoc(filePath)
    }
  } catch {
    // Algorithm docs are optional when LifeOS is partially installed.
  }
}

// Knowledge Indexing

function indexKnowledgeArchive(): void {
  const domainToCategory: Record<KnowledgeDomain, string> = {
    People: "person",
    Companies: "company",
    Ideas: "idea",
    Blogs: "blog",
    Books: "book",
    Research: "research",
  }

  for (const domain of KNOWLEDGE_DOMAINS) {
    const domainDir = join(KNOWLEDGE_DIR, domain)
    if (!existsSync(domainDir)) continue

    try {
      const files = readdirSync(domainDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")
        )
        .map((entry) => join(domainDir, entry.name))
        .sort((a, b) => naturalCollator.compare(a, b))

      for (const filePath of files) {
        const page = indexFile(filePath, { category: domainToCategory[domain] })
        if (page) pageIndex.set(page.slug, page)
      }
    } catch {
      // Skip unreadable knowledge domains.
    }
  }
}

// Full Index Build

function buildFullIndex(): void {
  pageIndex.clear()

  indexSystemDocs()
  indexKnowledgeArchive()
  rebuildBacklinks()
  rebuildSearchIndex()

  lastIndexedAt = new Date().toISOString()
}

// Backlink Computation

function rebuildBacklinks(): void {
  backlinkIndex.clear()

  for (const page of pageIndex.values()) {
    for (const targetSlug of page.wikilinks) {
      if (!backlinkIndex.has(targetSlug)) {
        backlinkIndex.set(targetSlug, [])
      }

      backlinkIndex.get(targetSlug)!.push({
        slug: page.slug,
        title: page.title,
        category: page.category,
      })
    }
  }
}

// Search Index

function rebuildSearchIndex(): void {
  searchIndex = new MiniSearch({
    fields: ["title", "content", "tagsText", "author"],
    storeFields: ["title", "category", "slug", "author", "source", "sourceUrl", "postDate"],
    searchOptions: {
      boost: { title: 3, tagsText: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  })

  const docs: Array<{
    id: string
    title: string
    content: string
    tagsText: string
    category: string
    slug: string
    author?: string
    source?: string
    sourceUrl?: string
    postDate?: string
  }> = []

  for (const [slug, page] of pageIndex) {
    let content = ""

    try {
      content = stripFrontmatter(readFileSync(page.filePath, "utf-8")).slice(
        0,
        5000
      )
    } catch {
      content = ""
    }

    docs.push({
      id: slug,
      title: page.title,
      content,
      tagsText: page.tags.join(" "),
      category: page.category,
      slug,
      author: page.author,
      source: page.source,
      sourceUrl: page.sourceUrl,
      postDate: page.postDate,
    })
  }

  searchIndex.addAll(docs)
}

// File Watcher

let watchers: ReturnType<typeof watch>[] = []
let reindexTimer: ReturnType<typeof setTimeout> | null = null
const pendingPaths: Set<string> = new Set()

function startWatchers(): void {
  stopWatchers()

  const watchPaths = [LIFEOS_DIR]

  for (const watchPath of watchPaths) {
    if (!existsSync(watchPath)) continue

    try {
      const watcher = watch(watchPath, { recursive: true }, (_event, filename) => {
        if (!filename) return
        const filenameText = String(filename)
        if (filenameText.endsWith(".md")) {
          scheduleReindex(join(watchPath, filenameText))
        }
      })

      watchers.push(watcher)
    } catch {
      // File watching is best-effort; manual refresh still rebuilds on restart.
    }
  }
}

function stopWatchers(): void {
  for (const watcher of watchers) {
    try {
      watcher.close()
    } catch {
      // Ignore close failures.
    }
  }

  watchers = []
}

let safetyTimer: ReturnType<typeof setInterval> | null = null
const SAFETY_INTERVAL_MS = 60_000

// Safety net for the recursive fs.watch above, which silently misses events on
// macOS and leaves a freshly written KNOWLEDGE note absent from the in-memory
// index until a full restart. This cheap tick rebuilds ONLY when a KNOWLEDGE
// .md file is newer than the last index, so a missed watcher event self-heals
// within a minute at near-zero idle cost.
function knowledgeMaxMtimeMs(): number {
  let max = 0
  for (const domain of KNOWLEDGE_DOMAINS) {
    const dir = join(KNOWLEDGE_DIR, domain)
    if (!existsSync(dir)) continue
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue
        try {
          max = Math.max(max, statSync(join(dir, entry.name)).mtimeMs)
        } catch {
          // Skip unreadable entry.
        }
      }
    } catch {
      // Skip unreadable domain.
    }
  }
  return max
}

function startSafetyRebuild(): void {
  stopSafetyRebuild()
  safetyTimer = setInterval(() => {
    const indexedAtMs = lastIndexedAt ? Date.parse(lastIndexedAt) : 0
    if (knowledgeMaxMtimeMs() > indexedAtMs) buildFullIndex()
  }, SAFETY_INTERVAL_MS)
}

function stopSafetyRebuild(): void {
  if (safetyTimer) {
    clearInterval(safetyTimer)
    safetyTimer = null
  }
}

function scheduleReindex(filePath: string): void {
  pendingPaths.add(filePath)
  if (reindexTimer) clearTimeout(reindexTimer)

  reindexTimer = setTimeout(() => {
    pendingPaths.clear()
    buildFullIndex()
  }, 500)
}

// Tree Builder

function treeLeaf(page: WikiPage): TreeNode {
  return {
    label: page.title,
    slug: page.slug,
    category: page.category,
  }
}

function sortedPages(pages: WikiPage[]): WikiPage[] {
  return [...pages].sort((a, b) => {
    const titleCompare = naturalCollator.compare(a.title, b.title)
    if (titleCompare !== 0) return titleCompare
    return naturalCollator.compare(a.slug, b.slug)
  })
}

function sortedGroupNames(groups: Record<string, WikiPage[]>): string[] {
  return Object.keys(groups).sort((a, b) => {
    if (a === "Overview") return -1
    if (b === "Overview") return 1
    return naturalCollator.compare(a, b)
  })
}

function buildTree(): TreeNode[] {
  const tree: TreeNode[] = []

  const systemDocs = [...pageIndex.values()].filter(
    (page) => page.category === "system-doc"
  )

  const systemNode: TreeNode = {
    label: "Documentation",
    children: [],
    count: systemDocs.length,
  }

  const groups: Record<string, WikiPage[]> = {}
  for (const page of systemDocs) {
    const group = page.group ?? "Other"
    if (!groups[group]) groups[group] = []
    groups[group].push(page)
  }

  for (const groupName of sortedGroupNames(groups)) {
    const pages = groups[groupName]
    systemNode.children!.push({
      label: groupName,
      count: pages.length,
      children: sortedPages(pages).map(treeLeaf),
    })
  }

  tree.push(systemNode)

  const domainMap: Array<{ category: string; label: string }> = [
    { category: "person", label: "People" },
    { category: "company", label: "Companies" },
    { category: "idea", label: "Ideas" },
    { category: "blog", label: "Blogs" },
    { category: "book", label: "Books" },
    { category: "research", label: "Research" },
  ]

  for (const { category, label } of domainMap) {
    const pages = [...pageIndex.values()].filter((page) => page.category === category)
    tree.push({
      label,
      count: pages.length,
      children: sortedPages(pages).map(treeLeaf),
    })
  }

  return tree
}

// Recent Changes

function getRecentChanges(limit = 20): WikiPage[] {
  return [...pageIndex.values()]
    .sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )
    .slice(0, limit)
}

// Stats

function getStats(): Record<string, number> {
  const pages = [...pageIndex.values()]
  return {
    totalPages: pages.length,
    totalSystem: pages.filter((page) => page.category === "system-doc").length,
    totalPeople: pages.filter((page) => page.category === "person").length,
    totalCompanies: pages.filter((page) => page.category === "company").length,
    totalIdeas: pages.filter((page) => page.category === "idea").length,
    totalBlogs: pages.filter((page) => page.category === "blog").length,
    totalBooks: pages.filter((page) => page.category === "book").length,
    totalResearch: pages.filter((page) => page.category === "research").length,
  }
}

// Route Helpers

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function notFound(message: string): Response {
  return jsonResponse({ error: message }, 404)
}

function readPageContent(page: WikiPage): string {
  try {
    return readFileSync(page.filePath, "utf-8")
  } catch {
    return ""
  }
}

// Wiki Routes

function handleIndex(): Response {
  return jsonResponse({
    tree: buildTree(),
    recentChanges: getRecentChanges(),
    stats: getStats(),
    lastIndexedAt,
  })
}

function handleDoc(slug: string): Response {
  const page = pageIndex.get(slug)
  if (!page) {
    return notFound(`Wiki page "${slug}" not found`)
  }

  // Knowledge categories (person/company/idea/blog) get the full knowledge
  // shape — including related, tags, source — so MarkdownRenderer wikilinks
  // landing here render identically to the dedicated knowledge route.
  const knowledgeCategories = new Set(["person", "company", "idea", "blog"])
  if (knowledgeCategories.has(page.category)) {
    const related = (page.related ?? [])
      .map((relSlug) => {
        const target = pageIndex.get(relSlug)
        if (!target) return null
        return { slug: relSlug, title: target.title, category: target.category }
      })
      .filter((x): x is { slug: string; title: string; category: string } => x !== null)

    return jsonResponse({
      slug: page.slug,
      title: page.title,
      category: page.category,
      content: readPageContent(page),
      wordCount: page.wordCount,
      lastModified: page.lastModified,
      tags: page.tags,
      quality: page.quality,
      type: page.category,
      author: page.author,
      source: page.source,
      sourceUrl: page.sourceUrl,
      postDate: page.postDate,
      related,
      backlinks: backlinkIndex.get(slug) ?? [],
      wikilinks: page.wikilinks,
    })
  }

  return jsonResponse({
    slug: page.slug,
    title: page.title,
    category: page.category,
    content: readPageContent(page),
    wordCount: page.wordCount,
    lastModified: page.lastModified,
    group: page.group,
    backlinks: backlinkIndex.get(slug) ?? [],
    wikilinks: page.wikilinks,
  })
}

function handleKnowledgeNote(domain: string, slug: string): Response {
  const validDomains: Record<string, string> = {
    people: "person",
    companies: "company",
    ideas: "idea",
    blogs: "blog",
    books: "book",
    person: "person",
    company: "company",
    idea: "idea",
    blog: "blog",
    book: "book",
  }

  const category = validDomains[domain.toLowerCase()]
  if (!category) return notFound(`Invalid knowledge domain "${domain}"`)

  const page = pageIndex.get(slug)
  if (!page || page.category !== category) {
    return notFound(`Knowledge note "${domain}/${slug}" not found`)
  }

  // Resolve related slugs to {slug, title, category} where the target exists
  const related = (page.related ?? [])
    .map((relSlug) => {
      const target = pageIndex.get(relSlug)
      if (!target) return null
      return { slug: relSlug, title: target.title, category: target.category }
    })
    .filter((x): x is { slug: string; title: string; category: string } => x !== null)

  return jsonResponse({
    slug: page.slug,
    title: page.title,
    category: page.category,
    content: readPageContent(page),
    wordCount: page.wordCount,
    lastModified: page.lastModified,
    tags: page.tags,
    quality: page.quality,
    type: page.category,
    author: page.author,
    source: page.source,
    sourceUrl: page.sourceUrl,
    postDate: page.postDate,
    related,
    backlinks: backlinkIndex.get(slug) ?? [],
    wikilinks: page.wikilinks,
  })
}

function buildExcerpt(page: WikiPage, query: string): string {
  let body = ""

  try {
    body = stripFrontmatter(readFileSync(page.filePath, "utf-8"))
  } catch {
    body = ""
  }

  if (!body) return ""

  const lowerBody = body.toLowerCase()
  const lowerQuery = query.toLowerCase().split(/\s+/)[0] ?? ""
  const idx = lowerQuery ? lowerBody.indexOf(lowerQuery) : -1

  if (idx >= 0) {
    const start = Math.max(0, idx - 60)
    const end = Math.min(body.length, idx + 140)
    return (
      (start > 0 ? "..." : "") +
      body.slice(start, end).replace(/\n/g, " ").trim() +
      (end < body.length ? "..." : "")
    )
  }

  const excerpt = body.slice(0, 200).replace(/\n/g, " ").trim()
  return body.length > 200 ? `${excerpt}...` : excerpt
}

function handleSearch(query: string, limit = 20): Response {
  if (!searchIndex || !query.trim()) {
    return jsonResponse({ results: [] })
  }

  const results = searchIndex.search(query).slice(0, Math.max(1, Math.min(200, limit)))

  return jsonResponse({
    results: results.map((result) => {
      const page = pageIndex.get(String(result.id))
      return {
        slug: String(result.id),
        title: page?.title ?? String((result as any).title ?? result.id),
        category: page?.category ?? String((result as any).category ?? "unknown"),
        excerpt: page ? buildExcerpt(page, query) : "",
        score: result.score,
        author: page?.author,
        source: page?.source,
        sourceUrl: page?.sourceUrl,
        postDate: page?.postDate,
      }
    }),
  })
}

function handleBacklinks(slug: string): Response {
  return jsonResponse({ backlinks: backlinkIndex.get(slug) ?? [] })
}

function handleGraph(): Response {
  const nodes: Array<{
    id: string
    title: string
    category: string
    quality?: number | null
    backlinkCount: number
  }> = []

  const edgeSet: Set<string> = new Set()
  const edges: Array<{ source: string; target: string }> = []

  for (const [slug, page] of pageIndex) {
    nodes.push({
      id: slug,
      title: page.title,
      category: page.category,
      quality: page.quality,
      backlinkCount: backlinkIndex.get(slug)?.length ?? 0,
    })

    for (const target of page.wikilinks) {
      if (!pageIndex.has(target)) continue
      const key = `${slug}->${target}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ source: slug, target })
    }

    for (const target of page.related ?? []) {
      if (!pageIndex.has(target)) continue
      const key = `${slug}->${target}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ source: slug, target })
    }
  }

  return jsonResponse({ nodes, edges })
}

// Lifecycle

export function startWiki(): void {
  moduleStartedAt = new Date().toISOString()
  buildFullIndex()
  startWatchers()
  startSafetyRebuild()
}

export function stopWiki(): void {
  stopWatchers()
  stopSafetyRebuild()
}

export function wikiHealth(): Record<string, unknown> {
  return {
    module: "wiki",
    startedAt: moduleStartedAt,
    lastIndexedAt,
    totalPages: pageIndex.size,
    watchersActive: watchers.length,
  }
}

// Skills Handlers

interface SkillMeta {
  name: string
  dir: string
  description: string
  effort: string
  hasWorkflows: boolean
  lastModified: string
}

function handleSkillsList(): Response {
  const skills: SkillMeta[] = []
  if (!existsSync(SKILLS_DIR)) return Response.json({ skills: [], total: 0 })

  for (const name of readdirSync(SKILLS_DIR).sort(naturalCollator.compare)) {
    const skillDir = join(SKILLS_DIR, name)
    const skillMd = join(skillDir, "SKILL.md")

    try {
      if (!statSync(skillDir).isDirectory()) continue
      if (!existsSync(skillMd)) continue

      const content = readFileSync(skillMd, "utf-8")
      const fm = parseFrontmatter(content)

      skills.push({
        name: String(fm.title || fm.name || name),
        dir: name,
        description: String(fm.description || ""),
        effort: String(fm.effort || "standard"),
        hasWorkflows: existsSync(join(skillDir, "Workflows")),
        lastModified: statSync(skillMd).mtime.toISOString(),
      })
    } catch {
      continue
    }
  }

  skills.sort((a, b) => naturalCollator.compare(a.name, b.name))
  return Response.json({ skills, total: skills.length })
}

function handleSkillDetail(name: string): Response {
  const skillMd = join(SKILLS_DIR, name, "SKILL.md")
  if (!existsSync(skillMd)) {
    return Response.json({ error: "Skill not found" }, { status: 404 })
  }

  const content = readFileSync(skillMd, "utf-8")
  const fm = parseFrontmatter(content)
  const stat = statSync(skillMd)

  return Response.json({
    name: String(fm.title || fm.name || name),
    description: String(fm.description || ""),
    effort: String(fm.effort || "standard"),
    content,
    filePath: skillMd,
    lastModified: stat.mtime.toISOString(),
    wordCount: countWords(content),
  })
}

async function handleSkillUpdate(name: string, req: Request): Promise<Response> {
  const skillMd = join(SKILLS_DIR, name, "SKILL.md")
  if (!existsSync(skillMd)) {
    return Response.json({ error: "Skill not found" }, { status: 404 })
  }

  const body = (await req.json()) as { content?: unknown }
  if (typeof body.content !== "string" || !body.content) {
    return Response.json({ error: "Missing content field" }, { status: 400 })
  }

  writeFileSync(skillMd, body.content, "utf-8")
  return Response.json({ ok: true, updated: new Date().toISOString() })
}

// Hooks Handlers

interface HookEntry {
  event: string
  matcher: string
  type: string
  command: string
  fileName: string
}

function handleHooksList(): Response {
  const hooks: HookEntry[] = []
  if (!existsSync(SETTINGS_PATH)) {
    return Response.json({ hooks: [], total: 0, events: [] })
  }

  try {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"))
    const hookConfig = settings.hooks || {}

    for (const [event, handlers] of Object.entries(hookConfig)) {
      if (!Array.isArray(handlers)) continue

      for (const handler of handlers as Array<{
        matcher?: string
        hooks?: Array<{ type: string; command?: string; url?: string }>
      }>) {
        const matcher = handler.matcher || "*"
        if (!handler.hooks) continue

        for (const hook of handler.hooks) {
          const command = hook.command || hook.url || ""
          const fileName = command.split("/").pop() || command
          hooks.push({ event, matcher, type: hook.type, command, fileName })
        }
      }
    }
  } catch {
    return Response.json({ hooks: [], total: 0, events: [] })
  }

  const events = [...new Set(hooks.map((hook) => hook.event))].sort(
    naturalCollator.compare
  )
  return Response.json({ hooks, total: hooks.length, events })
}

function handleHookDetail(name: string): Response {
  let hookPath = join(HOOKS_DIR, name)
  if (!existsSync(hookPath)) hookPath = join(HOOKS_DIR, `${name}.hook.ts`)

  if (!existsSync(hookPath)) {
    return Response.json({ error: "Hook not found" }, { status: 404 })
  }

  const content = readFileSync(hookPath, "utf-8")
  const stat = statSync(hookPath)

  return Response.json({
    name: basename(hookPath),
    content,
    filePath: hookPath,
    lastModified: stat.mtime.toISOString(),
    size: stat.size,
  })
}

// Arbol Handlers

interface ArbolWorker {
  name: string
  type: "action" | "pipeline" | "flow"
  cfName: string | null
  lastModified: string
}

function getWorkerType(name: string): "action" | "pipeline" | "flow" {
  if (name.startsWith("_A_")) return "action"
  if (name.startsWith("_P_")) return "pipeline"
  return "flow"
}

function handleArbolList(): Response {
  const workers: ArbolWorker[] = []
  if (!existsSync(ARBOL_WORKERS_DIR)) {
    return Response.json({
      workers: [],
      total: 0,
      actions: 0,
      pipelines: 0,
      flows: 0,
    })
  }

  for (const name of readdirSync(ARBOL_WORKERS_DIR).sort(naturalCollator.compare)) {
    const workerDir = join(ARBOL_WORKERS_DIR, name)

    try {
      if (!statSync(workerDir).isDirectory()) continue

      const wranglerPath = join(workerDir, "wrangler.jsonc")
      let cfName: string | null = null

      if (existsSync(wranglerPath)) {
        const raw = readFileSync(wranglerPath, "utf-8")
        const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/)
        if (nameMatch) cfName = nameMatch[1]
      }

      workers.push({
        name,
        type: getWorkerType(name),
        cfName,
        lastModified: statSync(workerDir).mtime.toISOString(),
      })
    } catch {
      continue
    }
  }

  workers.sort((a, b) => naturalCollator.compare(a.name, b.name))

  return Response.json({
    workers,
    total: workers.length,
    actions: workers.filter((worker) => worker.type === "action").length,
    pipelines: workers.filter((worker) => worker.type === "pipeline").length,
    flows: workers.filter((worker) => worker.type === "flow").length,
  })
}

function handleArbolDetail(name: string): Response {
  const workerDir = join(ARBOL_WORKERS_DIR, name)
  if (!existsSync(workerDir)) {
    return Response.json({ error: "Worker not found" }, { status: 404 })
  }

  const wranglerPath = join(workerDir, "wrangler.jsonc")
  const srcPath = join(workerDir, "src", "index.ts")

  let wranglerContent: string | null = null
  let srcContent: string | null = null

  if (existsSync(wranglerPath)) {
    wranglerContent = readFileSync(wranglerPath, "utf-8")
  }
  if (existsSync(srcPath)) {
    srcContent = readFileSync(srcPath, "utf-8")
  }

  if (!wranglerContent && !srcContent) {
    return Response.json({ error: "No readable files in worker" }, { status: 404 })
  }

  return Response.json({
    name,
    type: getWorkerType(name),
    wrangler: wranglerContent,
    source: srcContent,
    lastModified: statSync(workerDir).mtime.toISOString(),
  })
}

// Request Router

export async function handleWikiRequest(
  req: Request,
  pathname: string
): Promise<Response | null> {
  if (pathname === "/api/wiki/reindex") {
    buildFullIndex()
    return jsonResponse({ ok: true, pages: pageIndex.size, indexedAt: lastIndexedAt })
  }

  if (req.method !== "GET" && req.method !== "PUT") return null

  if (pathname === "/api/wiki") {
    return handleIndex()
  }

  if (pathname === "/api/wiki/skills") {
    return handleSkillsList()
  }

  const skillMatch = pathname.match(/^\/api\/wiki\/skills\/(.+)$/)
  if (skillMatch) {
    const skillName = decodeURIComponent(skillMatch[1])
    if (req.method === "PUT") return handleSkillUpdate(skillName, req)
    return handleSkillDetail(skillName)
  }

  if (pathname === "/api/wiki/hooks") {
    return handleHooksList()
  }

  const hookMatch = pathname.match(/^\/api\/wiki\/hooks\/(.+)$/)
  if (hookMatch) {
    return handleHookDetail(decodeURIComponent(hookMatch[1]))
  }

  if (pathname === "/api/wiki/arbol") {
    return handleArbolList()
  }

  const arbolMatch = pathname.match(/^\/api\/wiki\/arbol\/(.+)$/)
  if (arbolMatch) {
    return handleArbolDetail(decodeURIComponent(arbolMatch[1]))
  }

  if (pathname === "/api/wiki/search") {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10) || 20
    return handleSearch(url.searchParams.get("q") ?? "", limit)
  }

  if (pathname === "/api/wiki/graph") {
    return handleGraph()
  }

  const backlinksMatch = pathname.match(/^\/api\/wiki\/backlinks\/(.+)$/)
  if (backlinksMatch) {
    return handleBacklinks(decodeURIComponent(backlinksMatch[1]))
  }

  const knowledgeMatch = pathname.match(
    /^\/api\/wiki\/knowledge\/([^/]+)\/(.+)$/
  )
  if (knowledgeMatch) {
    return handleKnowledgeNote(
      decodeURIComponent(knowledgeMatch[1]),
      decodeURIComponent(knowledgeMatch[2])
    )
  }

  const docMatch = pathname.match(/^\/api\/wiki\/doc\/(.+)$/)
  if (docMatch) {
    return handleDoc(decodeURIComponent(docMatch[1]))
  }

  return null
}
