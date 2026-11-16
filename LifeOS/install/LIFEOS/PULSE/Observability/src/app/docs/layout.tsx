"use client";

import { useQuery } from "@tanstack/react-query";
import WikiSidebar from "@/components/wiki/WikiSidebar";
import { openPalette } from "@/lib/palette/events";

interface TreeNode {
  label: string;
  slug?: string;
  category?: string;
  children?: TreeNode[];
  count?: number;
}

function filterDocsTree(tree: TreeNode[]): TreeNode[] {
  return tree.filter((node) => {
    const label = node.label?.toLowerCase() ?? "";
    return label === "documentation";
  });
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  // ⌘K is handled globally by CommandPalette (opens WIKI-scoped on this route).
  const { data } = useQuery<{ tree: TreeNode[] }>({
    queryKey: ["wiki-tree"],
    queryFn: async () => {
      const res = await fetch("/api/wiki");
      if (!res.ok) throw new Error("Failed to fetch wiki index");
      return res.json();
    },
    staleTime: 30_000,
  });

  const docsTree = data?.tree ? filterDocsTree(data.tree) : [];

  const openSearch = () => openPalette("wiki");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-w-0 flex-col lg:flex-row">
      <div className="lg:hidden px-3 pt-3">
        <details className="glass rounded-2xl">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs text-ink-2">
            Documentation navigation
          </summary>
          <WikiSidebar
            tree={docsTree}
            onSearchClick={openSearch}
            className="w-auto max-h-[60vh] m-3"
          />
        </details>
      </div>
      <WikiSidebar
        tree={docsTree}
        onSearchClick={openSearch}
        className="hidden lg:flex"
      />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
