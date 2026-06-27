#!/usr/bin/env bun
/**
 * TlpArchive — scrape The Last Psychiatrist blog (thelastpsychiatrist.com)
 * and save each post as a Knowledge entry under MEMORY/KNOWLEDGE/Ideas/.
 *
 * Usage:
 *   bun TlpArchive.ts list             # write /tmp/tlp-urls.txt (700 URLs)
 *   bun TlpArchive.ts probe <url>      # fetch one URL, print parsed result
 *   bun TlpArchive.ts one <url>        # fetch one URL, write Ideas/ entry
 *   bun TlpArchive.ts all              # fetch all URLs from /tmp/tlp-urls.txt
 *   bun TlpArchive.ts retry            # retry URLs in /tmp/tlp-failed.txt
 *   bun TlpArchive.ts index            # write tlp-archive-index.md
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getPaiDir } from "./lib/runtime-paths";

const KNOWLEDGE_DIR = join(getPaiDir(import.meta.dir), "MEMORY", "KNOWLEDGE", "Blogs");
const URL_FILE = "/tmp/tlp-urls.txt";
const FAILED_FILE = "/tmp/tlp-failed.txt";
const SUCCESS_FILE = "/tmp/tlp-success.txt";
const ARCHIVE_URL = "https://thelastpsychiatrist.com/archives.html";
const TODAY = new Date().toISOString().slice(0, 10);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CONCURRENCY = 8;
const TIMEOUT_MS = 25_000;

type Post = {
  url: string;
  year: string;
  month: string;
  urlSlug: string;
  title: string;
  postDate: string;
  bodyHtml: string;
  bodyMd: string;
  fileSlug: string;
};

// ---------------------- Fetch ----------------------

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------- HTML helpers ----------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Extract innerHTML of a div with given class or id, tracking nested div depth. */
function extractDivByMarker(html: string, openTag: string): string | null {
  const idx = html.indexOf(openTag);
  if (idx === -1) return null;
  const start = idx + openTag.length;
  let depth = 1;
  let i = start;
  const re = /<\/?div\b/gi;
  re.lastIndex = start;
  while (true) {
    const m = re.exec(html);
    if (!m) return null;
    if (m[0].toLowerCase().startsWith("</div")) {
      depth--;
      if (depth === 0) {
        return html.slice(start, m.index);
      }
    } else {
      depth++;
    }
    i = re.lastIndex;
    if (i > html.length) return null;
  }
}

// ---------------------- HTML → Markdown ----------------------

function htmlToMd(html: string): string {
  let s = html;
  // Strip scripts, styles, iframes, forms entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  s = s.replace(/<form[\s\S]*?<\/form>/gi, "");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // Headings
  s = s.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  s = s.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  s = s.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  s = s.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
  s = s.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
  s = s.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");

  // Inline emphasis
  s = s.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  s = s.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  s = s.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  s = s.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  s = s.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, "$1");

  // Links
  s = s.replace(
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, txt) => {
      const cleaned = txt.replace(/<[^>]+>/g, "").trim();
      if (!cleaned) return "";
      return `[${cleaned}](${href})`;
    }
  );

  // Images
  s = s.replace(
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*?(?:\balt=["']([^"']*)["'])?[^>]*\/?>/gi,
    (_, src, alt) => `![${alt || ""}](${src})`
  );

  // Blockquotes
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const cleaned = htmlToMd(inner).trim();
    return "\n\n" + cleaned.split("\n").map((l) => "> " + l).join("\n") + "\n\n";
  });

  // Lists
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  s = s.replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n\n");

  // Paragraphs and breaks
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<p\b[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // Drop remaining divs/spans
  s = s.replace(/<\/?(div|span|section|article|figure|figcaption|center|font|small|big)\b[^>]*>/gi, "");

  // Strip unknown tags
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // Decode entities
  s = decodeEntities(s);

  // Whitespace cleanup
  s = s.replace(/ /g, " ");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  return s;
}

// ---------------------- YAML quoting ----------------------

function yamlQuote(s: string): string {
  // Convert ASCII quotes to typographic — eliminates need for YAML escaping
  // and renders nicer in any UI that displays the raw title.
  let t = s.trim();
  // Open/close detection: a quote preceded by start-of-string, whitespace,
  // or an opening bracket is "open"; everything else is "close".
  t = t.replace(/(^|[\s(\[{])"/g, "$1“"); // " → "
  t = t.replace(/"/g, "”");                // " → "
  t = t.replace(/(^|[\s(\[{])'/g, "$1‘"); // ' → '
  t = t.replace(/'/g, "’");                // ' → '
  // Plain YAML scalar is safe unless leading char is reserved or content
  // contains ": " (colon-space) or " #" (space-hash).
  const leading = /^[!&*?|>%@`“‘"' \-]/;
  if (!leading.test(t) && !t.includes(": ") && !t.includes(" #")) {
    return t;
  }
  // Fall back to double-quoted; no straight " can occur after typographic conversion.
  return '"' + t + '"';
}

// ---------------------- Date parsing ----------------------

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function parsePostDate(raw: string, fallback: { year: string; month: string }): string {
  const m = raw.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) {
      const day = m[2].padStart(2, "0");
      return `${m[3]}-${mon}-${day}`;
    }
  }
  return `${fallback.year}-${fallback.month.padStart(2, "0")}-01`;
}

// ---------------------- Parser ----------------------

function parsePost(html: string, url: string): Post {
  const urlMatch = url.match(/\/(\d{4})\/(\d{2})\/([^/]+)\.html$/);
  if (!urlMatch) throw new Error(`Bad URL: ${url}`);
  const [, year, month, urlSlug] = urlMatch;

  // Title — <title> tag is most reliable (h1 banner can collide with site header)
  let title = "";
  const t = html.match(/<title>([\s\S]+?)<\/title>/i);
  if (t) {
    title = t[1].replace(/^[\s\S]*?The Last Psychiatrist:\s*/i, "").trim();
  }
  if (!title) {
    // Fallback: find h1 INSIDE <div id="content">
    const contentMatch = html.match(/<div id="content"[^>]*>([\s\S]*?)<div class="entry-body"/i);
    if (contentMatch) {
      const h1 = contentMatch[1].match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1) title = h1[1].replace(/<[^>]+>/g, "").trim();
    }
  }
  title = decodeEntities(title);
  if (!title) title = urlSlug.replace(/_/g, " ");

  // Date
  const dateMatch = html.match(/<div class="dated">([\s\S]*?)<\/div>/i);
  const dateRaw = dateMatch ? dateMatch[1].trim() : "";
  const postDate = parsePostDate(dateRaw, { year, month });

  // Body — concat entry-body + entry-more
  const bodyParts: string[] = [];
  const eb = extractDivByMarker(html, '<div class="entry-body">');
  if (eb) bodyParts.push(eb);
  const em = extractDivByMarker(html, '<div id="more" class="entry-more">');
  if (em) bodyParts.push(em);
  const bodyHtml = bodyParts.join("\n\n");
  const bodyMd = htmlToMd(bodyHtml);

  const fileSlug = `tlp-${year}-${month}-${urlSlug.replace(/_/g, "-")}`.replace(/-+/g, "-");

  return { url, year, month, urlSlug, title, postDate, bodyHtml, bodyMd, fileSlug };
}

// ---------------------- Frontmatter writer ----------------------

function buildEntry(post: Post, prevSlug: string | null): string {
  const tags = ["blogs", "the-last-psychiatrist", "psychiatry", "culture-criticism"];
  const related: { slug: string; type: string }[] = [
    { slug: "tlp-archive-index", type: "part-of" },
  ];
  if (prevSlug) {
    related.push({ slug: prevSlug, type: "preceded-by" });
  } else {
    related.push({ slug: "real-internet-of-things-retrospective", type: "related" });
  }

  const fm = [
    "---",
    `title: ${yamlQuote(post.title)}`,
    "type: blog",
    `tags: [${tags.join(", ")}]`,
    `created: ${TODAY}`,
    `updated: ${TODAY}`,
    "quality: 7",
    `author: "Alone (The Last Psychiatrist)"`,
    `source: "The Last Psychiatrist"`,
    `source_url: ${post.url}`,
    `post_date: ${post.postDate}`,
    `source_blog: ${post.fileSlug}`,
    "related:",
    ...related.map((r) => `  - slug: ${r.slug}\n    type: ${r.type}`),
    "---",
    "",
    `# ${post.title}`,
    "",
    `*Published ${post.postDate} on [thelastpsychiatrist.com](${post.url}) by "Alone."*`,
    "",
    "## Thesis",
    "",
    `Original essay archived from The Last Psychiatrist blog. Full text below.`,
    "",
    "## Evidence",
    "",
    post.bodyMd || "_(body could not be extracted)_",
    "",
    "## Implications",
    "",
    "- Archived as part of the [[tlp-archive-index|TLP archive]] for durable retrieval.",
    "",
    "## Sources",
    "",
    `- ${post.url}`,
    "",
  ].join("\n");
  return fm;
}

// ---------------------- URL list ----------------------

async function buildUrlList(): Promise<string[]> {
  const html = await fetchHtml(ARCHIVE_URL);
  const re = /href="(https?:\/\/thelastpsychiatrist\.com)?(\/\d{4}\/\d{2}\/[a-z0-9_-]+\.html)"/gi;
  const seen = new Set<string>();
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = `https://thelastpsychiatrist.com${m[2]}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  // Sort chronologically by URL date
  urls.sort();
  writeFileSync(URL_FILE, urls.join("\n") + "\n");
  return urls;
}

// ---------------------- Bulk run ----------------------

async function processOne(
  url: string,
  prevSlug: string | null
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  try {
    const html = await fetchHtml(url);
    const post = parsePost(html, url);
    if (!post.bodyMd || post.bodyMd.length < 50) {
      throw new Error(`Body too short: ${post.bodyMd.length}`);
    }
    const out = buildEntry(post, prevSlug);
    const path = join(KNOWLEDGE_DIR, `${post.fileSlug}.md`);
    writeFileSync(path, out);
    return { ok: true, slug: post.fileSlug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runBulk(urls: string[]): Promise<{ success: string[]; failed: string[] }> {
  if (!existsSync(KNOWLEDGE_DIR)) mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  const success: string[] = [];
  const failed: string[] = [];

  // Process sequentially in chunks of CONCURRENCY for ordering of prev-slug
  // — but per-batch, prev-slug is stable from start of batch.
  // For simplicity, do truly concurrent; prev-slug derived from URL date order.
  // URLs are sorted chronologically, so each URL's "prev" = the URL above it in the sorted list.
  const slugForUrl = (u: string) => {
    const m = u.match(/\/(\d{4})\/(\d{2})\/([^/]+)\.html$/);
    if (!m) return null;
    return `tlp-${m[1]}-${m[2]}-${m[3].replace(/_/g, "-")}`.replace(/-+/g, "-");
  };

  let idx = 0;
  let done = 0;
  const total = urls.length;
  const startedAt = Date.now();

  async function worker() {
    while (true) {
      const my = idx++;
      if (my >= urls.length) return;
      const url = urls[my];
      const prev = my > 0 ? slugForUrl(urls[my - 1]) : null;
      const r = await processOne(url, prev);
      done++;
      if (r.ok) {
        success.push(url);
        if (done % 25 === 0 || done === total) {
          const pct = Math.round((done / total) * 100);
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(`[${done}/${total}] ${pct}%  elapsed ${elapsed}s`);
        }
      } else {
        failed.push(`${url}\t${r.error}`);
        console.error(`FAIL ${url} :: ${r.error}`);
      }
      // gentle politeness jitter
      await new Promise((res) => setTimeout(res, 80 + Math.random() * 120));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  writeFileSync(SUCCESS_FILE, success.join("\n") + "\n");
  writeFileSync(FAILED_FILE, failed.join("\n") + (failed.length ? "\n" : ""));
  return { success, failed };
}

// ---------------------- Index ----------------------

function buildArchiveIndex(urls: string[]): string {
  // group by year
  const byYear: Record<string, { date: string; slug: string; title: string; url: string }[]> = {};
  for (const url of urls) {
    const m = url.match(/\/(\d{4})\/(\d{2})\/([^/]+)\.html$/);
    if (!m) continue;
    const [, year, month, urlSlug] = m;
    const slug = `tlp-${year}-${month}-${urlSlug.replace(/_/g, "-")}`.replace(/-+/g, "-");
    const path = join(KNOWLEDGE_DIR, `${slug}.md`);
    let title = urlSlug.replace(/_/g, " ");
    let date = `${year}-${month}-01`;
    if (existsSync(path)) {
      const txt = readFileSync(path, "utf-8");
      const tm = txt.match(/^title:\s*"([^"]+)"/m);
      if (tm) title = tm[1];
      const dm = txt.match(/^post_date:\s*(\d{4}-\d{2}-\d{2})/m);
      if (dm) date = dm[1];
    }
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push({ date, slug, title, url });
  }
  const years = Object.keys(byYear).sort().reverse();

  const lines: string[] = [];
  lines.push("---");
  lines.push('title: "The Last Psychiatrist — Archive Index"');
  lines.push("type: blog");
  lines.push("tags: [blogs, the-last-psychiatrist, archive, index]");
  lines.push(`created: ${TODAY}`);
  lines.push(`updated: ${TODAY}`);
  lines.push("quality: 9");
  lines.push('author: "Alone (The Last Psychiatrist)"');
  lines.push('source: "The Last Psychiatrist"');
  lines.push("source_url: https://thelastpsychiatrist.com/archives.html");
  lines.push("related:");
  lines.push("  - slug: real-internet-of-things-retrospective");
  lines.push("    type: related");
  lines.push("  - slug: blog-redteam-adversarial-content-quality");
  lines.push("    type: related");
  lines.push("---");
  lines.push("");
  lines.push("# The Last Psychiatrist — Archive Index");
  lines.push("");
  lines.push(
    "Index of every post archived from [thelastpsychiatrist.com](https://thelastpsychiatrist.com) — pseudonymous blog by \"Alone\", active 2005–2014. Cultural criticism through a psychiatric lens. Each entry links to the full archived essay stored as a Knowledge note tagged `blogs`."
  );
  lines.push("");
  lines.push("## Thesis");
  lines.push("");
  lines.push(
    "TLP's body of work is one of the most influential cultural-criticism corpora of the late-Web-2.0 era — themes of narcissism, advertising, the disavowal of agency, and the medicalization of identity that became central to {{PRINCIPAL_NAME}}'s own framing. Preserving the full archive locally insulates the corpus against link-rot and makes every essay browsable inside Pulse."
  );
  lines.push("");
  lines.push("## Evidence");
  lines.push("");
  lines.push(`- ${urls.length} posts archived spanning ${years[years.length - 1]}–${years[0]}.`);
  lines.push("- Each post stored as `Ideas/tlp-YYYY-MM-slug.md` with full body in markdown.");
  lines.push("- Tagged `blogs` + `the-last-psychiatrist` + `psychiatry` + `culture-criticism`.");
  lines.push("- Chained chronologically via `preceded-by` cross-links.");
  lines.push("");
  lines.push("## Implications");
  lines.push("");
  lines.push("- Personal corpus survives if the original site goes dark.");
  lines.push("- Searchable via the standard Knowledge graph + Pulse Knowledge surface.");
  lines.push("- Tag-filterable: `tags:blogs` returns the entire TLP archive.");
  lines.push("");
  for (const y of years) {
    const posts = byYear[y].sort((a, b) => b.date.localeCompare(a.date));
    lines.push(`## ${y} (${posts.length} posts)`);
    lines.push("");
    for (const p of posts) {
      lines.push(`- ${p.date} — [[${p.slug}|${p.title}]] · [original](${p.url})`);
    }
    lines.push("");
  }
  lines.push("## Sources");
  lines.push("");
  lines.push(`- ${ARCHIVE_URL}`);
  lines.push("");
  return lines.join("\n");
}

// ---------------------- CLI ----------------------

async function main() {
  const cmd = process.argv[2];
  if (cmd === "list") {
    const urls = await buildUrlList();
    console.log(`Wrote ${urls.length} URLs to ${URL_FILE}`);
  } else if (cmd === "probe") {
    const url = process.argv[3];
    if (!url) throw new Error("probe requires URL arg");
    const html = await fetchHtml(url);
    const post = parsePost(html, url);
    console.log(JSON.stringify({ ...post, bodyHtml: post.bodyHtml.slice(0, 200) + "...", bodyMd: post.bodyMd.slice(0, 400) + "..." }, null, 2));
  } else if (cmd === "one") {
    const url = process.argv[3];
    if (!url) throw new Error("one requires URL arg");
    const r = await processOne(url, null);
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === "all") {
    if (!existsSync(URL_FILE)) {
      console.log("Building URL list first…");
      await buildUrlList();
    }
    const urls = readFileSync(URL_FILE, "utf-8").split("\n").filter(Boolean);
    console.log(`Processing ${urls.length} URLs at concurrency ${CONCURRENCY}…`);
    const r = await runBulk(urls);
    console.log(`\n=== DONE ===`);
    console.log(`Success: ${r.success.length}`);
    console.log(`Failed:  ${r.failed.length}`);
    if (r.failed.length) {
      console.log(`\nFailed list at ${FAILED_FILE}`);
    }
  } else if (cmd === "retry") {
    if (!existsSync(FAILED_FILE)) {
      console.log("No failed file");
      return;
    }
    const lines = readFileSync(FAILED_FILE, "utf-8").split("\n").filter(Boolean);
    const urls = lines.map((l) => l.split("\t")[0]).filter(Boolean);
    console.log(`Retrying ${urls.length} URLs…`);
    const r = await runBulk(urls);
    console.log(`\n=== RETRY DONE ===`);
    console.log(`Success: ${r.success.length}`);
    console.log(`Failed:  ${r.failed.length}`);
  } else if (cmd === "index") {
    const urls = readFileSync(URL_FILE, "utf-8").split("\n").filter(Boolean);
    const out = buildArchiveIndex(urls);
    writeFileSync(join(KNOWLEDGE_DIR, "tlp-archive-index.md"), out);
    console.log(`Wrote tlp-archive-index.md (${out.length} chars)`);
  } else {
    console.log("Usage: bun TlpArchive.ts {list|probe URL|one URL|all|retry|index}");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
