"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import MarkdownRenderer from "@/components/wiki/MarkdownRenderer";
import WikiMeta from "@/components/wiki/WikiMeta";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import { Users, Building2, Lightbulb, Bookmark, Clock, ExternalLink, Search, X, FileText, BookOpen, Newspaper } from "lucide-react";
import Link from "next/link";
import { wikiPageUrl } from "@/lib/wiki-links";

interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags?: string[];
  quality?: number;
  lastModified: string;
  wordCount: number;
  author?: string;
  source?: string;
  sourceUrl?: string;
  postDate?: string;
}

interface WikiIndex {
  tree: unknown[];
  recentChanges: WikiPage[];
  stats: {
    totalPages: number;
    totalPeople: number;
    totalCompanies: number;
    totalIdeas: number;
    totalBlogs: number;
    totalBookmarks: number;
  };
}

interface PageDetail {
  slug: string;
  title: string;
  category: string;
  content: string;
  wordCount: number;
  lastModified: string;
  backlinks: Array<{ slug: string; title: string; category: string }>;
  related?: Array<{ slug: string; title: string; category: string }>;
  wikilinks: string[];
  tags?: string[];
  quality?: number;
  filePath?: string;
  author?: string;
  source?: string;
  sourceUrl?: string;
  postDate?: string;
}

interface BookmarkDetail {
  slug: string;
  id: string;
  title: string;
  category: "bookmark";
  url: string;
  excerpt: string;
  note: string;
  folder: string;
  tags: string[];
  created: string;
  cover: string;
  favorite: boolean;
  wordCount: number;
  lastModified: string;
}

type Dimension = "health" | "money" | "freedom" | "creative" | "relationships" | "rhythms";

const CATEGORY_ICONS: Record<string, typeof Users> = {
  person: Users,
  company: Building2,
  idea: Lightbulb,
  blog: Newspaper,
  bookmark: Bookmark,
};

const CATEGORY_DIMENSIONS: Record<string, Dimension> = {
  identity: "creative",
  voice: "creative",
  mind: "freedom",
  taste: "relationships",
  shape: "rhythms",
  ops: "money",
  domain: "health",
  person: "relationships",
  company: "money",
  idea: "freedom",
  blog: "creative",
  bookmark: "creative",
};

const CATEGORY_COLORS: Record<Dimension, string> = {
  health: "var(--health)",
  money: "var(--money)",
  freedom: "var(--freedom)",
  creative: "var(--creative)",
  relationships: "var(--relationships)",
  rhythms: "var(--rhythms)",
};

interface SearchHit {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  score: number;
  author?: string;
  source?: string;
  sourceUrl?: string;
  postDate?: string;
}

const SEARCH_CATEGORY_ICONS: Record<string, typeof FileText> = {
  "system-doc": BookOpen,
  person: Users,
  company: Building2,
  idea: Lightbulb,
  blog: Newspaper,
  bookmark: Bookmark,
};

const SEARCH_CATEGORY_LABELS: Record<string, string> = {
  "system-doc": "System",
  person: "People",
  company: "Companies",
  idea: "Ideas",
  blog: "Blogs",
  bookmark: "Bookmarks",
};

function KnowledgeHeroSearch({ totalPages }: { totalPages: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/wiki/search?q=${encodeURIComponent(query)}&limit=40`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const grouped = results.reduce<Record<string, SearchHit[]>>((acc, r) => {
    const cat = r.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="telos-card" style={{ padding: "20px 24px", cursor: "default" }}>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--freedom)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                inputRef.current?.blur();
              } else if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                router.push(wikiPageUrl(results[0].category, results[0].slug));
              }
            }}
            placeholder={`Search ${totalPages.toLocaleString()} entries — people, companies, ideas, blogs, bookmarks…`}
            className="flex-1 bg-transparent outline-none"
            style={{ color: "#E8EFFF", fontSize: 18, fontFamily: "'concourse-t3', sans-serif" }}
            autoFocus
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-slate-500 hover:text-slate-300 shrink-0"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {query.trim() && (
        <div className="telos-card" style={{ padding: 0, cursor: "default", overflow: "hidden" }}>
          {loading && results.length === 0 && (
            <div className="px-5 py-6 text-sm" style={{ color: "#6B80AB" }}>
              Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-5 py-6 text-sm" style={{ color: "#6B80AB" }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto">
              {Object.entries(grouped).map(([cat, items]) => {
                const Icon = SEARCH_CATEGORY_ICONS[cat] || FileText;
                const label = SEARCH_CATEGORY_LABELS[cat] || cat;
                return (
                  <div key={cat}>
                    <div
                      className="flex items-center gap-2 px-5 py-2 text-[13px] uppercase tracking-wider border-b border-slate-800/30"
                      style={{ color: "#6B80AB", fontFamily: "'advocate-c14', sans-serif" }}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                      <span className="ml-auto" style={{ color: "#3D5273" }}>
                        {items.length}
                      </span>
                    </div>
                    {items.map((r) => (
                      <Link
                        key={r.slug + r.category}
                        href={wikiPageUrl(r.category, r.slug)}
                        className="flex flex-col gap-0.5 px-5 py-2.5 hover:bg-white/5 transition-colors border-b border-slate-800/20"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="flex-1 truncate" style={{ color: "#E8EFFF", fontSize: 14, fontFamily: "'concourse-t3', sans-serif" }}>
                            {r.title}
                          </span>
                          {r.author && (
                            <span className="shrink-0 truncate max-w-[200px]" style={{ color: "#8FA1C7", fontSize: 13, fontFamily: "'concourse-t3', sans-serif" }}>
                              {r.author}
                            </span>
                          )}
                        </div>
                        {r.excerpt && (
                          <span
                            className="line-clamp-1"
                            style={{ color: "#6B80AB", fontSize: 13, fontFamily: "'concourse-t3', sans-serif" }}
                          >
                            {r.excerpt}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeLanding({ data }: { data: WikiIndex }) {
  const knowledgeEntries = data.recentChanges.filter(
    (p) =>
      p.category === "person" ||
      p.category === "company" ||
      p.category === "idea" ||
      p.category === "blog" ||
      p.category === "bookmark",
  );

  const isFreshInstall = data.stats.totalPages === 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {isFreshInstall && (
        <EmptyStateGuide
          section="Knowledge Archive"
          description={`Curated notes on people, companies, ideas, and research — the graph of what you've learned. Notes live under ${process.env.NEXT_PUBLIC_PAI_KNOWLEDGE_DIR || "~/.claude/PAI/MEMORY/KNOWLEDGE"}/People|Companies|Ideas|Research/.`}
          daPromptExample="help me start my knowledge archive"
        />
      )}

      <KnowledgeHeroSearch totalPages={data.stats.totalPages} />

      <div className="telos-card goal-card dim-freedom" style={{ cursor: "default" }}>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#E8EFFF" }}>
          Knowledge Archive
        </h1>
        <p className="mt-1" style={{ color: "#9BB0D6", fontSize: 14 }}>
          People, companies, ideas, and bookmarks
        </p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "74%" }} />
        </div>
        <div className="goal-foot">
          <div className="goal-dims">
            <span className="pill pill-freedom">mind</span>
            <span className="pill pill-creative">voice</span>
            <span className="pill pill-money">ops</span>
          </div>
          <span className="goal-delta flat-muted">archive flow</span>
        </div>
      </div>

      {/* Stats */}
      <div className="metric-grid">
        {[
          { icon: Users, label: "People", count: data.stats.totalPeople, dimension: "relationships" as const },
          { icon: Building2, label: "Companies", count: data.stats.totalCompanies, dimension: "money" as const },
          { icon: Lightbulb, label: "Ideas", count: data.stats.totalIdeas, dimension: "freedom" as const },
          { icon: Newspaper, label: "Blogs", count: data.stats.totalBlogs ?? 0, dimension: "creative" as const },
          { icon: Bookmark, label: "Bookmarks", count: data.stats.totalBookmarks, dimension: "creative" as const },
        ].map(({ icon: Icon, label, count, dimension }) => (
          <div key={label} className="telos-card metric" style={{ cursor: "default" }}>
            <div className="metric-top">
              <Icon className="w-4 h-4" style={{ color: CATEGORY_COLORS[dimension] }} />
              <span className="metric-label muted">{label}</span>
            </div>
            <div className="metric-row">
              <span className="metric-val mono">{count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent changes */}
      <div>
        <h2
          className="text-sm font-medium tracking-wider uppercase mb-3 flex items-center gap-2"
          style={{ color: "var(--freedom)" }}
        >
          <Clock className="w-4 h-4" />
          Recent Changes
        </h2>
        <div className="space-y-2">
          {knowledgeEntries.slice(0, 20).map((page) => {
            const Icon = CATEGORY_ICONS[page.category] || Lightbulb;
            const dimension = CATEGORY_DIMENSIONS[page.category] || "freedom";
            return (
              <Link
                key={page.slug + page.category}
                href={wikiPageUrl(page.category, page.slug)}
                className="telos-card flex items-center gap-3"
                style={{ padding: "12px 16px", flexDirection: "row", gap: 12, cursor: "pointer" }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: CATEGORY_COLORS[dimension] }} />
                <span className={`pill pill-${dimension}`}>{page.category}</span>
                <span className="truncate min-w-0 flex-1" style={{ color: "#E8EFFF", fontSize: 14 }}>
                  {page.title}
                </span>
                {page.author && (
                  <span className="shrink-0 truncate max-w-[180px]" style={{ color: "#8FA1C7", fontSize: 13 }}>
                    {page.author}
                  </span>
                )}
                <span className="shrink-0 tabular-nums mono muted" style={{ fontSize: 12 }}>
                  {new Date(page.lastModified).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KnowledgePageInner() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const slug = searchParams.get("slug");
  const bookmarkSlug = searchParams.get("bookmark");

  const isViewingKnowledge = !!category && !!slug;
  const isViewingBookmark = !!bookmarkSlug;
  const isViewing = isViewingKnowledge || isViewingBookmark;

  const { data: indexData } = useQuery<WikiIndex>({
    queryKey: ["wiki-index"],
    queryFn: async () => {
      const res = await fetch("/api/wiki");
      if (!res.ok) throw new Error("Failed to fetch wiki index");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !isViewing,
  });

  const { data: knowledgeDetail } = useQuery<PageDetail>({
    queryKey: ["wiki-knowledge", category, slug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/knowledge/${category}/${slug}`);
      if (!res.ok) throw new Error("Failed to fetch knowledge note");
      return res.json();
    },
    enabled: isViewingKnowledge,
  });

  const { data: bookmarkDetail } = useQuery<BookmarkDetail>({
    queryKey: ["wiki-bookmark", bookmarkSlug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/bookmark/${bookmarkSlug}`);
      if (!res.ok) throw new Error("Failed to fetch bookmark");
      return res.json();
    },
    enabled: isViewingBookmark,
  });

  if (isViewingBookmark && bookmarkDetail) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bookmark className="w-5 h-5" style={{ color: "var(--freedom)" }} />
            <span className="pill pill-freedom text-xs uppercase tracking-wider">Bookmark</span>
          </div>
          <h1 className="text-2xl" style={{ color: "#E8EFFF" }}>{bookmarkDetail.title}</h1>
          {bookmarkDetail.url && (
            <a
              href={bookmarkDetail.url}
              target="_blank"
              rel="noopener"
              className="hover:underline flex items-center gap-1 mt-1"
              style={{ color: "var(--freedom)", fontSize: 14 }}
            >
              {bookmarkDetail.url} <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        {bookmarkDetail.excerpt && (
          <p className="leading-relaxed" style={{ color: "#D6E1F5", fontSize: 14 }}>
            {bookmarkDetail.excerpt}
          </p>
        )}
        {bookmarkDetail.note && (
          <div
            className="leading-relaxed pl-4"
            style={{ color: "#E8EFFF", fontSize: 14, borderLeft: "2px solid rgba(125,211,252,0.4)" }}
          >
            {bookmarkDetail.note}
          </div>
        )}
      </div>
    );
  }

  if (isViewingKnowledge && knowledgeDetail) {
    return (
      <div className="flex h-full">
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
          <MarkdownRenderer content={knowledgeDetail.content} />
        </div>
        <WikiMeta
          title={knowledgeDetail.title}
          category={knowledgeDetail.category}
          tags={knowledgeDetail.tags}
          quality={knowledgeDetail.quality}
          lastModified={knowledgeDetail.lastModified}
          wordCount={knowledgeDetail.wordCount}
          backlinks={knowledgeDetail.backlinks}
          filePath={knowledgeDetail.filePath}
          author={knowledgeDetail.author}
          source={knowledgeDetail.source}
          sourceUrl={knowledgeDetail.sourceUrl}
          postDate={knowledgeDetail.postDate}
          related={knowledgeDetail.related}
        />
      </div>
    );
  }

  if (!isViewing && indexData) {
    return <KnowledgeLanding data={indexData} />;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div style={{ color: "#6B80AB", fontSize: 14 }}>Loading...</div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div style={{ color: "#6B80AB", fontSize: 14 }}>Loading...</div>
        </div>
      }
    >
      <KnowledgePageInner />
    </Suspense>
  );
}
