"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import MarkdownRenderer from "@/components/wiki/MarkdownRenderer";
import WikiMeta from "@/components/wiki/WikiMeta";
import {
  BookOpen,
  Compass,
  Sparkles,
  ArrowRight,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { wikiPageUrl } from "@/lib/wiki-links";

const FONT_HEADING = { fontFamily: "'advocate-c14', sans-serif" } as const;
const FONT_BODY = { fontFamily: "'concourse-t3', sans-serif" } as const;

interface TreeNode {
  label: string;
  slug?: string;
  category?: string;
  children?: TreeNode[];
  count?: number;
}

interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags?: string[];
  quality?: number;
  lastModified: string;
  wordCount: number;
  group?: string;
}

interface WikiIndex {
  tree: TreeNode[];
  recentChanges: WikiPage[];
  stats: { totalSystem: number };
}

interface PageDetail {
  slug: string;
  title: string;
  category: string;
  content: string;
  wordCount: number;
  lastModified: string;
  backlinks: Array<{ slug: string; title: string; category: string }>;
  wikilinks: string[];
  tags?: string[];
  quality?: number;
  filePath?: string;
  group?: string;
}

const START_HERE_SLUGS = [
  {
    slug: "PAISystemArchitecture",
    tagline: "The master architecture document — every subsystem in context",
  },
  {
    slug: "LifeOs__LifeOsThesis",
    tagline: "Why PAI exists — the Life Operating System thesis",
  },
  {
    slug: "ARCHITECTURE_SUMMARY",
    tagline: "One-page architecture summary — auto-generated, always current",
  },
];

function qualityClass(quality: number | undefined): "rec-high" | "rec-med" | "rec-low" {
  if (quality === undefined) return "rec-low";
  if (quality < 0.5) return "rec-high";
  if (quality < 0.8) return "rec-med";
  return "rec-low";
}

function qualityLabel(quality: number | undefined): string {
  if (quality === undefined) return "quality n/a";
  return `${Math.round(quality * 100)}% quality`;
}

function flattenTree(nodes: TreeNode[] | undefined): TreeNode[] {
  if (!nodes) return [];
  const out: TreeNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children) out.push(...flattenTree(n.children));
  }
  return out;
}

function DocsLanding({ data }: { data: WikiIndex }) {
  const documentationNode =
    data.tree.find((n) => n.label.toLowerCase() === "documentation") ?? null;

  const groups: TreeNode[] = documentationNode?.children ?? [];

  const allLeaves = flattenTree(groups).filter((n) => n.slug);

  const slugToNode = new Map<string, TreeNode>();
  for (const leaf of allLeaves) {
    if (leaf.slug) slugToNode.set(leaf.slug, leaf);
  }

  type StartHereEntry = {
    slug: string;
    tagline: string;
    title: string;
    category: string | undefined;
  };

  const startHere: StartHereEntry[] = START_HERE_SLUGS.flatMap((entry) => {
    const node = slugToNode.get(entry.slug);
    if (!node) return [];
    return [{ slug: entry.slug, tagline: entry.tagline, title: node.label, category: node.category }];
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      <div className="telos-card goal-card dim-rhythms" style={{ cursor: "default" }}>
        <div className="goal-title" style={FONT_HEADING}>
          <BookOpen className="w-4 h-4 shrink-0" style={{ color: "var(--rhythms)" }} />
          <span>DOCUMENTATION</span>
          <span className="pill pill-rhythms">search</span>
        </div>
        <p className="text-base mt-1" style={{ ...FONT_BODY, color: "#D6E1F5" }}>
          PAI subsystem architecture, algorithm, and reference
        </p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "100%" }} />
        </div>
        <div className="goal-foot">
          <div className="goal-dims">
            <span className="pill pill-rhythms">search index</span>
            <span className="pill pill-freedom">browse</span>
            <span className="pill pill-relationships">backlinks</span>
          </div>
          <span className="goal-delta green-up">recently updated</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="telos-card metric" style={{ cursor: "default" }}>
          <div className="metric-top">
            <BookOpen className="w-5 h-5" style={{ color: "var(--rhythms)" }} />
            <span className="metric-label muted">Documents</span>
          </div>
          <div>
            <div className="metric-val mono" style={FONT_BODY}>
              {data.stats.totalSystem}
            </div>
          </div>
        </div>
        <div className="telos-card metric" style={{ cursor: "default" }}>
          <div className="metric-top">
            <Folder className="w-5 h-5" style={{ color: "var(--relationships)" }} />
            <span className="metric-label muted">Sections</span>
          </div>
          <div>
            <div className="metric-val mono" style={FONT_BODY}>
              {groups.length}
            </div>
          </div>
        </div>
      </div>

      {startHere.length > 0 && (
        <div>
          <h2
            className="text-base font-medium uppercase tracking-[0.25em] mb-4 flex items-center gap-2"
            style={{ ...FONT_HEADING, color: "var(--creative)" }}
          >
            <Sparkles className="w-4 h-4" />
            Start Here
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {startHere.map((entry) => (
              <Link
                key={entry.slug}
                href={wikiPageUrl(entry.category ?? "system-doc", entry.slug)}
                className="telos-card group"
                style={{ cursor: "pointer" }}
              >
                <div
                  className="text-base font-semibold transition-colors"
                  style={FONT_BODY}
                >
                  {entry.title}
                </div>
                <div className="text-xs leading-relaxed muted" style={FONT_BODY}>
                  {entry.tagline}
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <span className="pill pill-creative">start here</span>
                  <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--creative)" }}>
                  Open
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <h2
            className="text-base font-medium uppercase tracking-[0.25em] mb-4 flex items-center gap-2"
            style={{ ...FONT_HEADING, color: "var(--freedom)" }}
          >
            <Compass className="w-4 h-4" />
            Browse by Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group) => {
              const firstChild = group.children?.find((c) => c.slug);
              const href =
                firstChild && firstChild.slug
                  ? wikiPageUrl(firstChild.category ?? "system-doc", firstChild.slug)
                  : "#";

              return (
                <Link
                  key={group.label}
                  href={href}
                  className="telos-card group"
                  style={{ cursor: "pointer" }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="text-sm font-semibold transition-colors uppercase tracking-[0.15em]"
                      style={FONT_HEADING}
                    >
                      {group.label}
                    </div>
                    {group.count !== undefined && (
                      <span
                        className="pill pill-freedom tabular-nums"
                        style={FONT_BODY}
                      >
                        {group.count}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-xs muted leading-relaxed line-clamp-2"
                    style={FONT_BODY}
                  >
                    {(group.children ?? [])
                      .filter((c) => c.slug)
                      .slice(0, 3)
                      .map((c) => c.label)
                      .join(" · ")}
                    {(group.children?.length ?? 0) > 3 && " · …"}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {data.recentChanges.length > 0 && (
        <div>
          <h2
            className="text-base font-medium uppercase tracking-[0.25em] mb-4 flex items-center gap-2"
            style={{ ...FONT_HEADING, color: "var(--relationships)" }}
          >
            <Sparkles className="w-4 h-4" />
            Recently Updated
          </h2>
          <div className="recs-list">
            {data.recentChanges.slice(0, 6).map((page, index) => (
              <Link
                key={page.slug}
                href={wikiPageUrl(page.category, page.slug)}
                className={`telos-card rec ${qualityClass(page.quality)}`}
                style={{ cursor: "pointer" }}
              >
                <div className="rec-n mono green-up">{index + 1}</div>
                <div className="rec-body">
                  <div className="rec-action" style={FONT_BODY}>{page.title}</div>
                  <div className="rec-because muted" style={FONT_BODY}>
                    {page.category} · {page.wordCount.toLocaleString()} words
                  </div>
                  <div className="rec-trace">
                    <span className="pill pill-rhythms">updated</span>
                    <span className="green-up">
                      {new Date(page.lastModified).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <div className="rec-meta">
                  <span className="pill pill-relationships">{qualityLabel(page.quality)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WikiErrorState({
  title,
  message,
  hint,
  onRetry,
}: {
  title: string;
  message: string;
  hint?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="max-w-md text-center space-y-3">
        <div className="text-lg font-semibold" style={{ ...FONT_HEADING, color: "#F87171" }}>
          {title}
        </div>
        <div className="text-sm text-slate-300" style={FONT_BODY}>
          {message}
        </div>
        {hint && (
          <div className="text-xs text-slate-500" style={FONT_BODY}>
            {hint}
          </div>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 px-4 py-1.5 text-sm rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          style={FONT_BODY}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function DocsPageInner() {
  const searchParams = useSearchParams();
  const docSlug = searchParams.get("doc");
  const isViewing = !!docSlug;

  const {
    data: indexData,
    isError: indexIsError,
    error: indexError,
    refetch: refetchIndex,
  } = useQuery<WikiIndex>({
    queryKey: ["wiki-index"],
    queryFn: async () => {
      const res = await fetch("/api/wiki");
      if (!res.ok) throw new Error(`Failed to fetch wiki index (HTTP ${res.status})`);
      return res.json();
    },
    staleTime: 30_000,
    enabled: !isViewing,
  });

  const {
    data: docDetail,
    isError: docIsError,
    error: docError,
    refetch: refetchDoc,
  } = useQuery<PageDetail>({
    queryKey: ["wiki-doc", docSlug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/doc/${docSlug}`);
      if (!res.ok) throw new Error(`Failed to fetch doc (HTTP ${res.status})`);
      return res.json();
    },
    enabled: isViewing,
  });

  if (isViewing && docIsError) {
    return (
      <WikiErrorState
        title="Couldn't load this doc"
        message={docError instanceof Error ? docError.message : "Unknown error"}
        onRetry={() => refetchDoc()}
      />
    );
  }

  if (!isViewing && indexIsError) {
    return (
      <WikiErrorState
        title="Couldn't load the wiki"
        message={indexError instanceof Error ? indexError.message : "Unknown error"}
        onRetry={() => refetchIndex()}
        hint="The Pulse wiki module may not be running. Check pulse.log for details."
      />
    );
  }

  if (isViewing && docDetail) {
    return (
      <div className="flex h-full">
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
          <MarkdownRenderer content={docDetail.content} />
        </div>
        <WikiMeta
          title={docDetail.title}
          category={docDetail.category}
          tags={docDetail.tags}
          quality={docDetail.quality}
          lastModified={docDetail.lastModified}
          wordCount={docDetail.wordCount}
          backlinks={docDetail.backlinks}
          filePath={docDetail.filePath}
        />
      </div>
    );
  }

  if (!isViewing && indexData) {
    return <DocsLanding data={indexData} />;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-base text-slate-600" style={FONT_BODY}>
        Loading...
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-base text-slate-600" style={FONT_BODY}>
            Loading...
          </div>
        </div>
      }
    >
      <DocsPageInner />
    </Suspense>
  );
}
