"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { wikiPageUrl, WIKI_GRAPH_URL } from "@/lib/wiki-links";
import {
  ChevronRight,
  BookOpen,
  Cpu,
  Layers,
  Server,
  FileText,
  FlaskConical,
  GraduationCap,
  Users,
  Building2,
  Lightbulb,
  Search,
  Network,
  Library,
  BookCopy,
  Sparkles,
  Workflow,
  Folder,
  Compass,
  ShieldCheck,
  Webhook,
  TreePine,
  Zap,
  Bot,
  Heart,
  Database,
  Bell,
  Eye,
  Activity,
  Wrench,
  GitBranch,
  Radio,
} from "lucide-react";

interface TreeNode {
  label: string;
  slug?: string;
  category?: string;
  children?: TreeNode[];
  count?: number;
  icon?: string;
}

interface WikiSidebarProps {
  tree: TreeNode[];
  onSearchClick: () => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  // Top-level tree nodes
  "Knowledge Archive": Library,
  Documentation: BookCopy,
  // Documentation groups (one per LIFEOS/DOCUMENTATION/ subfolder + Overview)
  Overview: Compass,
  Agents: Bot,
  Algorithm: Cpu,
  Arbol: TreePine,
  Config: Wrench,
  Delegation: GitBranch,
  Fabric: Layers,
  Feed: Radio,
  Hooks: Webhook,
  LifeOs: Heart,
  Memory: Database,
  Notifications: Bell,
  Observability: Eye,
  Pulse: Activity,
  Security: ShieldCheck,
  Skills: Zap,
  Tools: Server,
  // Memory object types
  People: Users,
  Companies: Building2,
  Ideas: Lightbulb,
  Blogs: FileText,
  Books: BookOpen,
  Research: FlaskConical,
  ISAs: Workflow,
  Lessons: GraduationCap,
  Wisdom: Sparkles,
  // Fallback
  Other: Folder,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Knowledge Archive": "text-emerald-400",
  Documentation: "text-cyan-400",
  Overview: "text-emerald-400",
  Agents: "text-violet-400",
  Algorithm: "text-cyan-400",
  Arbol: "text-emerald-400",
  Config: "text-ink-2",
  Delegation: "text-amber-400",
  Fabric: "text-violet-400",
  Feed: "text-sky-400",
  Hooks: "text-amber-400",
  LifeOs: "text-rose-400",
  Memory: "text-violet-400",
  Notifications: "text-amber-400",
  Observability: "text-sky-400",
  Pulse: "text-emerald-400",
  Security: "text-rose-400",
  Skills: "text-amber-400",
  Tools: "text-ink-2",
  People: "text-sky-400",
  Companies: "text-amber-400",
  Ideas: "text-violet-400",
  Books: "text-rose-400",
  Research: "text-cyan-400",
  ISAs: "text-emerald-400",
  Lessons: "text-amber-400",
  Wisdom: "text-violet-400",
  Other: "text-ink-3",
};

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const hasChildren = node.children && node.children.length > 0;
  const Icon = CATEGORY_ICONS[node.label] || FileText;
  const color = CATEGORY_COLORS[node.label] || "text-ink-2";

  const linkPath = node.slug && node.category
    ? wikiPageUrl(node.category, node.slug)
    : undefined;

  const isActive = linkPath && pathname === linkPath;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md transition-colors group",
            "text-ink-2 hover:text-ink-1 hover:bg-surface-3"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px`, fontFamily: "'concourse-t3', sans-serif" }}
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform shrink-0",
              expanded && "rotate-90"
            )}
          />
          <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
          <span className="truncate">{node.label}</span>
          {node.count !== undefined && (
            <span className="ml-auto text-[13px] text-ink-3 tabular-nums">{node.count}</span>
          )}
        </button>
        {expanded && (
          <div className="mt-0.5">
            {node.children!.map((child, i) => (
              <TreeItem key={child.slug || child.label + i} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node
  return (
    <Link
      href={linkPath || "#"}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
        isActive
          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
          : "text-ink-3 hover:text-ink-2 hover:bg-surface-3"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px`, fontFamily: "'concourse-t3', sans-serif" }}
    >
      <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-40" />
      <span className="truncate">{node.label}</span>
    </Link>
  );
}

export default function WikiSidebar({ tree, onSearchClick, className }: WikiSidebarProps) {
  return (
    <aside className={cn("w-64 shrink-0 border-r border-line-1 bg-surface-1 overflow-y-auto h-[calc(100vh-3.5rem)]", className)}>
      {/* Search trigger */}
      <div className="p-3 border-b border-line-1">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-ink-3 rounded-lg border border-line-1 bg-surface-2 hover:border-line-3 hover:text-ink-2 transition-colors"
          style={{ fontFamily: "'concourse-t3', sans-serif" }}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <kbd className="ml-auto text-[13px] px-1.5 py-0.5 rounded bg-surface-3 border border-line-2 text-ink-3">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Graph link — one graph over the whole memory corpus */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href={WIKI_GRAPH_URL}
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-ink-3 rounded-md hover:text-violet-400 hover:bg-violet-500/5 transition-colors"
          style={{ fontFamily: "'concourse-t3', sans-serif" }}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Graph</span>
        </Link>
      </div>

      {/* Tree navigation — memory object types render directly, no section
          header (2026-07-19 directive: it's all just objects in memory). */}
      <nav className="p-3 space-y-1">
        {(() => {
          const docNodes = tree.filter((n) => n.label === "Documentation");
          const memoryNodes = tree.filter((n) => n.label !== "Documentation");
          return (
            <>
              {docNodes.length > 0 && (
                <div className="mb-3">
                  <div
                    className="text-[13px] font-medium tracking-[0.2em] text-ink-3 uppercase px-2 mb-2"
                    style={{ fontFamily: "'advocate-c14', sans-serif" }}
                  >
                    Documentation
                  </div>
                  {docNodes.map((node, i) => (
                    <TreeItem key={node.label + i} node={node} />
                  ))}
                </div>
              )}

              {memoryNodes.map((node, i) => (
                <TreeItem key={node.label + i} node={node} />
              ))}
            </>
          );
        })()}
      </nav>
    </aside>
  );
}
