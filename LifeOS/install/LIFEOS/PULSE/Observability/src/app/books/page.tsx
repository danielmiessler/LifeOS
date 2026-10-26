"use client";

import { useEffect, useState } from "react";
import { BookOpen, Star } from "lucide-react";
import { PageShell, PageHeader, Panel, PanelHeader, Pill, EmptyState } from "@/components/ui/chrome";

/**
 * Books tab — {{PRINCIPAL_NAME}}'s favorite books. Zero data in this component; it fetches
 * /api/books (which reads USER/BOOKS.md) and renders it. Data/code separated.
 */

interface Book {
  title: string;
  author?: string;
  year?: number;
  rating?: number;
  themes?: string[];
  canonical?: boolean;
  note?: string;
}
interface Group { category: string; books: Book[] }
interface BooksData { count: number; lastUpdated: string | null; groups: Group[] }

export default function BooksPage() {
  const [data, setData] = useState<BooksData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const subtitle =
    "Favorite books — the ones worth re-reading." +
    (data?.count ? ` ${data.count} tracked.` : "") +
    (data?.lastUpdated ? ` Updated ${data.lastUpdated}.` : "");

  return (
    <PageShell className="max-w-[1100px]">
      <PageHeader icon={BookOpen} title="Books" subtitle={subtitle} />

      {error && <div className="text-warn text-sm">Couldn&apos;t reach Books API: {error}</div>}
      {!data && !error && <div className="text-ink-3 text-sm">Loading…</div>}
      {data && data.groups.length === 0 && !error && (
        <EmptyState icon={BookOpen} title="No books yet" hint="Add books to USER/BOOKS.md to populate this page." />
      )}

      {data?.groups.map((g) => (
        <section key={g.category} className="flex flex-col gap-3">
          <PanelHeader title={g.category} />
          <div className="grid gap-3 sm:grid-cols-2">
            {g.books.map((b, i) => (
              <Panel key={`${b.title}-${i}`} hover className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-ink-1 font-medium flex items-start gap-1.5">
                      {b.canonical && (
                        <Star className="w-3.5 h-3.5 shrink-0 mt-1" style={{ color: "var(--money)" }} fill="currentColor" />
                      )}
                      <span>{b.title}</span>
                    </div>
                    {(b.author || b.year) && (
                      <div className="text-ink-2 text-sm mt-0.5">
                        {b.author}
                        {b.year ? ` · ${b.year}` : ""}
                      </div>
                    )}
                  </div>
                  {typeof b.rating === "number" && (
                    <span className="shrink-0 font-semibold tabular-nums text-sm" style={{ color: "var(--accent-blue)" }}>
                      {b.rating}/10
                    </span>
                  )}
                </div>
                {b.themes && b.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {b.themes.map((t) => (
                      <Pill key={t} dim="neutral">{t}</Pill>
                    ))}
                  </div>
                )}
                {b.note && (
                  <p className="text-ink-2 text-xs mt-2 leading-relaxed">{b.note}</p>
                )}
              </Panel>
            ))}
          </div>
        </section>
      ))}
    </PageShell>
  );
}
