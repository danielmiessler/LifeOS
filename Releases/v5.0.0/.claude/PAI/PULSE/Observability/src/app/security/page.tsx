"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX, Eye, Lock,
  FileWarning, Activity, Server, Plus, Trash2, X, Info, ChevronDown, ChevronRight,
  BookOpen, Save, AlertTriangle,
} from "lucide-react";

interface SecurityPattern { pattern: string; reason: string }
interface PathTier { tier: string; paths: string[]; effect: string }
interface SecurityEvent {
  timestamp: string; event_type: string; tool: string;
  category: string; target: string; reason: string; action_taken: string;
}
interface HookRegistration { type: string; matcher: string; command: string; status: "active" | "missing" }
interface HookDetail { description: string; behavior: string; event: string; canBlock: boolean }
interface InjectionPattern { category: string; description: string; pattern: string }
interface PromptGuardCategory { category: string; count: number }
interface SecurityData {
  version: string; lastUpdated: string; philosophy: string;
  blocked: SecurityPattern[]; alerts: SecurityPattern[]; trusted: SecurityPattern[];
  pathTiers: PathTier[]; events: SecurityEvent[];
  eventCounts: { blocks: number; alerts: number; injections: number; total: number };
  hooks: HookRegistration[];
  securityRules: string;
  injectionPatterns: InjectionPattern[];
  promptGuardPatterns: PromptGuardCategory[];
}

const COLORS = {
  danger: "#F87B7B",
  severityHigh: "#F87171",
  warn: "#FBBF24",
  health: "#34D399",
  money: "#E0A458",
  freedom: "#7DD3FC",
  creative: "#F87B7B",
  relationships: "#B794F4",
  rhythms: "#2DD4BF",
  muted: "#A8A5C8",
  quiet: "#6B80AB",
  text: "#E8EFFF",
  textSoft: "#D6E1F5",
};

const TINTS = {
  danger: "rgba(248,123,123,0.14)",
  warn: "rgba(251,191,36,0.14)",
  health: "rgba(52,211,153,0.14)",
  money: "rgba(224,164,88,0.14)",
  freedom: "rgba(125,211,252,0.14)",
  creative: "rgba(248,123,123,0.14)",
  relationships: "rgba(183,148,244,0.14)",
  rhythms: "rgba(45,212,191,0.14)",
};

type StatTone = "default" | "danger" | "warn" | "ok" | "info" | "money" | "creative" | "relationships" | "freedom" | "rhythms";

// ── Stat Card (metric-grid child) ──
function StatCard({
  icon: Icon, label, value, tone = "default",
}: {
  icon: typeof Shield; label: string; value: number | string;
  tone?: StatTone;
}) {
  const toneColor: Record<StatTone, string> = {
    default: COLORS.freedom,
    danger: COLORS.danger,
    warn: COLORS.warn,
    ok: COLORS.health,
    info: COLORS.freedom,
    money: COLORS.money,
    creative: COLORS.creative,
    relationships: COLORS.relationships,
    freedom: COLORS.freedom,
    rhythms: COLORS.rhythms,
  };
  const toneClass: Partial<Record<StatTone, string>> = {
    danger: "rec-high",
    warn: "rec-med",
    ok: "rec-low",
    info: "rec-low",
  };
  const toneBorder: Partial<Record<StatTone, string>> = {
    default: COLORS.freedom,
    money: COLORS.money,
    creative: COLORS.creative,
    relationships: COLORS.relationships,
    freedom: COLORS.freedom,
    rhythms: COLORS.rhythms,
  };
  return (
    <div className={"telos-card metric " + (toneClass[tone] || "")} style={{ cursor: "default", borderLeft: toneBorder[tone] ? `3px solid ${toneBorder[tone]}` : undefined }}>
      <div className="metric-top">
        <Icon className="w-4 h-4" style={{ color: toneColor[tone] }} />
        <span className="metric-label muted">{label}</span>
      </div>
      <div className="metric-row">
        <span className="metric-val mono" style={{ color: toneColor[tone] }}>{value}</span>
      </div>
    </div>
  );
}

// ── Section Header ──
function SectionHeader({ icon: Icon, title, count, children }: {
  icon: typeof Shield; title: string; count?: number; color?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-8 first:mt-0">
      <Icon className="w-5 h-5" style={{ color: arguments[0].color || COLORS.freedom }} />
      <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: COLORS.text }}>{title}</h2>
      {count !== undefined && <span className="text-xs muted ml-1">({count})</span>}
      <div className="flex-1" />
      {children}
    </div>
  );
}

// ── Add Pattern Form ──
function AddPatternForm({ section, onAdd }: { section: string; onAdd: (p: string, r: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!pattern.trim() || !reason.trim()) return;
    onAdd(pattern.trim(), reason.trim());
    setPattern(""); setReason(""); setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors"
        style={{ color: "#9BB0D6" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#E8EFFF")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#9BB0D6")}
      >
        <Plus className="w-3 h-3" /> Add {section} pattern
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-lg mt-2"
      style={{ background: "#12203D", border: "1px solid #1A2A4D" }}
    >
      <input
        value={pattern}
        onChange={e => setPattern(e.target.value)}
        placeholder="Regex pattern"
        className="flex-1 rounded px-2 py-1.5 text-xs mono"
        style={{ background: "#0F1A33", border: "1px solid #1A2A4D", color: "#E8EFFF" }}
      />
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason"
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        className="flex-1 rounded px-2 py-1.5 text-xs"
        style={{ background: "#0F1A33", border: "1px solid #1A2A4D", color: "#E8EFFF" }}
      />
      <button
        onClick={handleSubmit}
        className="pill"
        style={{
          padding: "6px 12px",
          background: "rgba(59,130,246,0.25)",
          color: "#9ACBFF",
          border: "1px solid rgba(154,203,255,0.4)",
          cursor: "pointer",
        }}
      >
        Add
      </button>
      <button onClick={() => setOpen(false)} className="p-1" style={{ color: "#9BB0D6" }}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Add Path Form ──
function AddPathForm({ onAdd }: { tier: string; onAdd: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");

  const handleSubmit = () => {
    if (!path.trim()) return;
    onAdd(path.trim()); setPath(""); setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs mt-2 px-1 py-0.5 rounded"
        style={{ color: "#9BB0D6" }}
      >
        <Plus className="w-3 h-3" /> Add path
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        value={path}
        onChange={e => setPath(e.target.value)}
        placeholder="~/.example/path/**"
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        className="flex-1 rounded px-2 py-1 text-xs mono"
        style={{ background: "#0F1A33", border: "1px solid #1A2A4D", color: "#E8EFFF" }}
      />
      <button
        onClick={handleSubmit}
        className="pill"
        style={{
          padding: "4px 10px",
          background: "rgba(59,130,246,0.25)",
          color: "#9ACBFF",
          border: "1px solid rgba(154,203,255,0.4)",
          cursor: "pointer",
        }}
      >
        Add
      </button>
      <button onClick={() => setOpen(false)} className="p-0.5" style={{ color: "#9BB0D6" }}>
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Editable Pattern Row ──
function EditablePatternRow({ pattern, index, color, onEdit, onRemove }: {
  pattern: SecurityPattern; index: number; color: string;
  onEdit: (i: number, field: "pattern" | "reason", value: string) => void;
  onRemove: (i: number) => void;
}) {
  const [editingField, setEditingField] = useState<"pattern" | "reason" | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: "pattern" | "reason") => {
    setEditingField(field);
    setEditValue(field === "pattern" ? pattern.pattern : pattern.reason);
  };

  const commitEdit = () => {
    if (editingField && editValue.trim()) {
      onEdit(index, editingField, editValue.trim());
    }
    setEditingField(null);
  };

  const cancelEdit = () => { setEditingField(null); };

  return (
    <tr className="group" style={{ borderBottom: "1px solid rgba(26,42,77,0.6)" }}>
      <td className="px-4 py-2">
        {editingField === "pattern" ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            onBlur={commitEdit}
            className="w-full rounded px-2 py-1 text-xs mono"
            style={{ background: "#0F1A33", border: "1px solid #3B82F6", color: "#E8EFFF" }}
          />
        ) : (
          <code
            className="text-xs mono cursor-pointer hover:underline"
            style={{ color }}
            onClick={() => startEdit("pattern")}
            title="Click to edit"
          >
            {pattern.pattern}
          </code>
        )}
      </td>
      <td className="px-4 py-2">
        {editingField === "reason" ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            onBlur={commitEdit}
            className="w-full rounded px-2 py-1 text-xs"
            style={{ background: "#0F1A33", border: "1px solid #3B82F6", color: "#E8EFFF" }}
          />
        ) : (
          <span
            className="text-xs cursor-pointer"
            style={{ color: "#9BB0D6" }}
            onClick={() => startEdit("reason")}
            title="Click to edit"
          >
            {pattern.reason}
          </span>
        )}
      </td>
      <td className="px-2">
        <button
          onClick={() => onRemove(index)}
          className="opacity-0 group-hover:opacity-100 p-1 transition-all"
          style={{ color: "#6B80AB" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#F87171")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6B80AB")}
          title="Remove pattern"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Pattern Table ──
function PatternTable({ patterns, type, onRemove, onEdit }: {
  patterns: SecurityPattern[]; type: "blocked" | "alert" | "trusted";
  onRemove: (i: number) => void; onEdit: (i: number, field: "pattern" | "reason", value: string) => void;
}) {
  const tone: Record<string, string> = {
    blocked: "#F87171",
    alert: "#FBBF24",
    trusted: "#4ADE80",
  };
  const text = tone[type];

  return (
    <div className="telos-card" style={{ padding: 0, cursor: "default", overflow: "hidden" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid #1A2A4D" }}>
            <th className="text-left px-4 py-2 text-xs tracking-wider uppercase muted" style={{ width: "45%" }}>Pattern</th>
            <th className="text-left px-4 py-2 text-xs tracking-wider uppercase muted">Reason</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {patterns.map((p, i) => (
            <EditablePatternRow key={i} pattern={p} index={i} color={text} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Editable Path Entry ──
function EditablePathEntry({ path, tierName, index, onEdit, onRemove }: {
  path: string; tierName: string; index: number;
  onEdit: (tier: string, index: number, value: string) => void;
  onRemove: (tier: string, index: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(path);

  const commitEdit = () => {
    if (editValue.trim() && editValue.trim() !== path) {
      onEdit(tierName, index, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1 group">
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
          onBlur={commitEdit}
          className="flex-1 rounded px-2 py-1 text-xs mono"
          style={{ background: "#0F1A33", border: "1px solid #3B82F6", color: "#E8EFFF" }}
        />
      ) : (
        <code
          className="flex-1 text-xs mono rounded px-2 py-1 cursor-pointer transition-colors"
          style={{ background: "#12203D", color: "#D6E1F5" }}
          onClick={() => { setEditValue(path); setEditing(true); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#17284A")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#12203D")}
          title="Click to edit"
        >
          {path}
        </code>
      )}
      <button
        onClick={() => onRemove(tierName, index)}
        className="opacity-0 group-hover:opacity-100 p-0.5 transition-all"
        style={{ color: "#6B80AB" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#F87171")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#6B80AB")}
        title="Remove path"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Path Tier Card ──
function PathTierCard({ tier, onRemovePath, onEditPath }: {
  tier: PathTier;
  onRemovePath: (tierName: string, index: number) => void;
  onEditPath: (tierName: string, index: number, value: string) => void;
}) {
  const tierConfig: Record<string, { icon: typeof Lock; color: string }> = {
    zeroAccess: { icon: ShieldX, color: "#F87171" },
    alertAccess: { icon: AlertTriangle, color: "#FBBF24" },
    confirmAccess: { icon: ShieldAlert, color: "#FBBF24" },
    readOnly: { icon: Eye, color: "#9ACBFF" },
    confirmWrite: { icon: FileWarning, color: "#9ACBFF" },
    noDelete: { icon: Lock, color: "#9ACBFF" },
  };
  const c = tierConfig[tier.tier] ?? tierConfig.noDelete;
  const Icon = c.icon;

  return (
    <div className="telos-card" style={{ cursor: "default", gap: 8, borderLeft: `3px solid ${c.color}` }}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: c.color }} />
        <span className="text-sm font-semibold" style={{ color: c.color }}>{tier.tier}</span>
      </div>
      <p className="text-xs muted">{tier.effect}</p>
      <div className="space-y-1">
        {tier.paths.map((path, i) => (
          <EditablePathEntry
            key={i}
            path={path}
            tierName={tier.tier}
            index={i}
            onEdit={onEditPath}
            onRemove={onRemovePath}
          />
        ))}
      </div>
    </div>
  );
}

// ── Event Row ──
function EventRow({ event }: { event: SecurityEvent }) {
  const typeTone: Record<string, string> = {
    block: "high",
    alert: "med",
    injection_detected: "high",
    confirm: "low",
  };
  const impact = typeTone[event.event_type] || "low";
  const impactColor: Record<string, string> = { high: "#F87171", med: "#FBBF24", low: "#9BB0D6" };
  const time = event.timestamp ? new Date(event.timestamp).toLocaleString() : "unknown";
  return (
    <div
      className="telos-card rec"
      style={{ cursor: "default", borderLeft: `3px solid ${impactColor[impact]}`, padding: "14px 18px" }}
    >
      <div className="rec-n mono muted" style={{ fontSize: 12, letterSpacing: 1 }}>
        {event.event_type}
      </div>
      <div className="rec-body">
        <div className="rec-action" style={{ fontSize: 14 }} data-sensitive>{event.reason}</div>
        <div className="rec-because muted" style={{ fontSize: 12 }}>
          {event.tool} · {event.target?.slice(0, 80)}
        </div>
      </div>
      <div className="rec-meta">
        <div className="mono muted" style={{ fontSize: 11 }}>{time}</div>
        <div>
          <span className="rec-label">severity</span>
          <span className={"rec-impact " + impact}>{impact}</span>
        </div>
      </div>
    </div>
  );
}

// ── Hook Detail Row ──
function HookDetailRow({ hook, detail }: { hook: HookRegistration; detail?: HookDetail }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = hook.status === "active";
  const Arrow = expanded ? ChevronDown : ChevronRight;

  return (
    <div style={{ borderBottom: "1px solid rgba(26,42,77,0.5)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 py-2.5 w-full text-left px-2 rounded transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = "#12203D")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Arrow className="w-3 h-3 shrink-0" style={{ color: "#6B80AB" }} />
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: isActive ? "#4ADE80" : "#F87171" }}
        />
        <span className="text-xs mono flex-1 truncate" style={{ color: "#E8EFFF" }}>{hook.command}</span>
        <span className="text-xs muted">{hook.type} · {hook.matcher}</span>
        {detail?.canBlock && (
          <span
            className="pill"
            style={{ padding: "2px 8px", background: "rgba(248,113,113,0.15)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" }}
          >
            CAN BLOCK
          </span>
        )}
        {detail && !detail.canBlock && (
          <span className="pill" style={{ padding: "2px 8px" }}>ADVISORY</span>
        )}
      </button>
      {expanded && detail && (
        <div className="pl-10 pr-4 pb-3 space-y-2">
          <div>
            <div className="text-xs tracking-wider uppercase mb-0.5 muted">Description</div>
            <div className="text-xs" style={{ color: "#E8EFFF" }}>{detail.description}</div>
          </div>
          <div>
            <div className="text-xs tracking-wider uppercase mb-0.5 muted">Behavior</div>
            <div className="text-xs" style={{ color: "#D6E1F5" }}>{detail.behavior}</div>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-xs muted">Event: </span>
              <span className="text-xs mono" style={{ color: "#9ACBFF" }}>{detail.event}</span>
            </div>
            <div>
              <span className="text-xs muted">Blocking: </span>
              <span className="text-xs" style={{ color: detail.canBlock ? "#F87171" : "#9BB0D6" }}>
                {detail.canBlock ? "Yes (exit 2)" : "No (advisory)"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════

export default function SecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [hookDetails, setHookDetails] = useState<Record<string, HookDetail>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"policy" | "rules" | "events" | "hooks">("policy");
  const [rulesContent, setRulesContent] = useState("");
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ type: string; section?: string; tier?: string; index: number } | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/security").then(r => r.json()).then(d => { setData(d); setRulesContent(d.securityRules || ""); setLoading(false); }).catch(() => setLoading(false));
    fetch("/api/security/hooks-detail").then(r => r.json()).then(setHookDetails).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mutatePolicy = async (body: Record<string, unknown>) => {
    await fetch("/api/security/patterns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    fetchData();
  };

  const saveRules = async () => {
    setRulesSaving(true);
    await fetch("/api/security/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: rulesContent }) });
    setRulesSaving(false);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  const handleAddPattern = (section: string) => (pattern: string, reason: string) => {
    mutatePolicy({ action: "add_pattern", section, pattern, reason });
  };

  const handleRemovePattern = (section: string, index: number) => {
    setConfirmRemove({ type: "pattern", section, index });
  };

  const handleEditPattern = (section: string) => (index: number, field: "pattern" | "reason", value: string) => {
    mutatePolicy({ action: "edit_pattern", section, index, [field]: value });
  };

  const handleAddPath = (tier: string) => (path: string) => {
    mutatePolicy({ action: "add_path", tier, path });
  };

  const handleEditPath = (tier: string, index: number, value: string) => {
    mutatePolicy({ action: "edit_path", tier, index, path: value });
  };

  const handleRemovePath = (tier: string, index: number) => {
    setConfirmRemove({ type: "path", tier, index });
  };

  const confirmAction = () => {
    if (!confirmRemove) return;
    if (confirmRemove.type === "pattern") {
      mutatePolicy({ action: "remove_pattern", section: confirmRemove.section, index: confirmRemove.index });
    } else {
      mutatePolicy({ action: "remove_path", tier: confirmRemove.tier, index: confirmRemove.index });
    }
    setConfirmRemove(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: "#9BB0D6" }}>
        <Shield className="w-6 h-6 animate-pulse mr-2" style={{ color: "#9ACBFF" }} /> Loading security policy...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: "#F87171" }}>
        <ShieldAlert className="w-6 h-6 mr-2" /> Failed to load security data
      </div>
    );
  }

  const tabPill = (tab: "policy" | "rules" | "events" | "hooks", label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className="pill capitalize"
      style={{
        padding: "6px 14px",
        fontSize: 13,
        cursor: "pointer",
        background: activeTab === tab ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.08)",
        color: activeTab === tab ? "#E8EFFF" : "#9ACBFF",
        border: activeTab === tab ? "1px solid rgba(154,203,255,0.5)" : "1px solid rgba(154,203,255,0.2)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Confirm Dialog */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        >
          <div className="telos-card max-w-md" style={{ cursor: "default", padding: 24 }}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5" style={{ color: "#FBBF24" }} />
              <h3 className="text-sm font-semibold" style={{ color: "#E8EFFF" }}>Remove Security Rule?</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: "#9BB0D6" }}>
              This will immediately update the security policy. The change takes effect on the next tool call.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="pill"
                style={{ padding: "6px 14px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="pill"
                style={{
                  padding: "6px 14px",
                  background: "rgba(248,113,113,0.2)",
                  color: "#F87171",
                  border: "1px solid rgba(248,113,113,0.4)",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-6 h-6" style={{ color: "#3B82F6" }} />
          <h1 className="text-lg tracking-[0.2em]" style={{ color: "#E8EFFF", fontWeight: 600 }}>SECURITY</h1>
          <span className="text-xs mono muted">v{data.version} · Inspector Pipeline</span>
        </div>
        <p className="text-xs ml-9" style={{ color: "#9BB0D6" }}>{data.philosophy}</p>
      </div>

      {/* Architecture Visual */}
      <div className="telos-card mb-6" style={{ cursor: "default" }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" style={{ color: "#9ACBFF" }} />
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: "#E8EFFF" }}>
            How the Security Pipeline Works
          </span>
        </div>

        {/* Pipeline Flow */}
        <div className="flex flex-wrap items-center gap-2 mb-5 text-xs mono">
          <span className="pill" style={{ padding: "4px 10px" }}>Tool Call</span>
          <span style={{ color: "#6B80AB" }}>→</span>
          <span
            className="pill"
            style={{ padding: "4px 10px", background: "rgba(59,130,246,0.18)", color: "#9ACBFF", border: "1px solid rgba(154,203,255,0.35)" }}
          >
            SecurityPipeline.hook.ts
          </span>
          <span style={{ color: "#6B80AB" }}>→</span>
          <span
            className="pill"
            style={{ padding: "4px 10px", background: "rgba(248,113,113,0.15)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" }}
          >
            PatternInspector <span style={{ color: "rgba(248,113,113,0.7)" }}>(100)</span>
          </span>
          <span style={{ color: "#6B80AB" }}>→</span>
          <span
            className="pill"
            style={{ padding: "4px 10px", background: "rgba(251,191,36,0.14)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}
          >
            EgressInspector <span style={{ color: "rgba(251,191,36,0.7)" }}>(90)</span>
          </span>
          <span style={{ color: "#6B80AB" }}>→</span>
          <span className="pill" style={{ padding: "4px 10px" }}>deny | approve | alert | allow</span>
        </div>

        {/* Other hooks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-xs">
          <div className="px-3 py-2 rounded" style={{ background: "#12203D", border: "1px solid #1A2A4D" }}>
            <span className="font-semibold" style={{ color: "#9ACBFF" }}>PostToolUse →</span>{" "}
            <span style={{ color: "#9BB0D6" }}>ContentScanner · Injection detection (advisory)</span>
          </div>
          <div className="px-3 py-2 rounded" style={{ background: "#12203D", border: "1px solid #1A2A4D" }}>
            <span className="font-semibold" style={{ color: "#9ACBFF" }}>PermissionRequest →</span>{" "}
            <span style={{ color: "#9BB0D6" }}>SmartApprover · Read=auto, Write=ask</span>
          </div>
          <div className="px-3 py-2 rounded" style={{ background: "#12203D", border: "1px solid #1A2A4D" }}>
            <span className="font-semibold" style={{ color: "#9ACBFF" }}>UserPromptSubmit →</span>{" "}
            <span style={{ color: "#9BB0D6" }}>PromptGuard · PromptInspector (injection/exfil/evasion)</span>
          </div>
        </div>

        {/* Policy Files — WHERE TO EDIT */}
        <div style={{ borderTop: "1px dashed #1A2A4D", paddingTop: 16 }}>
          <div className="text-xs tracking-wider uppercase mb-3 muted">Where to Edit Policy</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: "#12203D", border: "1px solid #1A2A4D" }}
            >
              <ShieldX className="w-4 h-4 shrink-0" style={{ color: "#F87171" }} />
              <div className="flex-1 min-w-0">
                <code className="text-sm mono" style={{ color: "#E8EFFF" }}>PATTERNS.yaml</code>
                <p className="text-xs mt-0.5" style={{ color: "#9BB0D6" }}>Regex patterns for commands + file path protections</p>
              </div>
              <button
                onClick={() => setActiveTab("policy")}
                className="shrink-0 px-2 py-1 text-xs rounded transition-colors pill"
                style={{ cursor: "pointer" }}
              >
                Edit
              </button>
            </div>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: "#12203D", border: "1px solid #1A2A4D" }}
            >
              <BookOpen className="w-4 h-4 shrink-0" style={{ color: "#9ACBFF" }} />
              <div className="flex-1 min-w-0">
                <code className="text-sm mono" style={{ color: "#E8EFFF" }}>SECURITY_RULES.md</code>
                <p className="text-xs mt-0.5" style={{ color: "#9BB0D6" }}>Natural language BLOCK/ALLOW rules (disabled)</p>
              </div>
              <button
                onClick={() => setActiveTab("rules")}
                className="shrink-0 px-2 py-1 text-xs pill"
                style={{ cursor: "pointer" }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="metric-grid mb-6">
        <StatCard icon={Shield} label="Inspectors" value={4} tone="ok" />
        <StatCard icon={ShieldX} label="Blocked Patterns" value={data.blocked.length} tone="danger" />
        <StatCard icon={FileWarning} label="Alert Patterns" value={data.alerts.length} tone="warn" />
        <StatCard icon={Lock} label="Protected Paths" value={data.pathTiers.reduce((n, t) => n + t.paths.length, 0)} tone="info" />
        <StatCard icon={Activity} label="Recent Events" value={data.eventCounts.total} tone="info" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6" style={{ borderBottom: "1px solid #1A2A4D", paddingBottom: 12 }}>
        {tabPill("policy", "Policy")}
        {tabPill("rules", "Rules")}
        {tabPill("events", "Events")}
        {tabPill("hooks", "Hooks")}
      </div>

      {/* ── POLICY TAB ── */}
      {activeTab === "policy" && (
        <div>
          <SectionHeader icon={ShieldX} title="Hard-Blocked Commands" count={data.blocked.length}>
            <AddPatternForm section="blocked" onAdd={handleAddPattern("blocked")} />
          </SectionHeader>
          <PatternTable patterns={data.blocked} type="blocked" onRemove={i => handleRemovePattern("blocked", i)} onEdit={handleEditPattern("blocked")} />

          <SectionHeader icon={FileWarning} title="Alert-Only Commands" count={data.alerts.length}>
            <AddPatternForm section="alert" onAdd={handleAddPattern("alert")} />
          </SectionHeader>
          <PatternTable patterns={data.alerts} type="alert" onRemove={i => handleRemovePattern("alert", i)} onEdit={handleEditPattern("alert")} />

          <SectionHeader icon={ShieldCheck} title="Trusted Fast-Paths" count={data.trusted.length}>
            <AddPatternForm section="trusted" onAdd={handleAddPattern("trusted")} />
          </SectionHeader>
          <PatternTable patterns={data.trusted} type="trusted" onRemove={i => handleRemovePattern("trusted", i)} onEdit={handleEditPattern("trusted")} />

          <SectionHeader icon={BookOpen} title="Security Rules">
            <button
              onClick={() => setActiveTab("rules")}
              className="flex items-center gap-1 text-sm px-2 py-1 rounded"
              style={{ color: "#9ACBFF" }}
            >
              Edit rules
            </button>
          </SectionHeader>
          {rulesContent.trim() ? (
            <div className="telos-card mb-2" style={{ cursor: "default", borderLeft: "3px solid #9ACBFF" }}>
              <pre className="text-xs mono whitespace-pre-wrap max-h-48 overflow-y-auto" style={{ color: "#D6E1F5" }}>{rulesContent}</pre>
            </div>
          ) : (
            <div className="telos-card mb-2" style={{ cursor: "default" }}>
              <p className="text-xs text-center muted">
                No security rules defined.{" "}
                <button onClick={() => setActiveTab("rules")} className="hover:underline" style={{ color: "#9ACBFF" }}>
                  Add rules
                </button>{" "}
                to enable LLM-based policy evaluation.
              </p>
            </div>
          )}

          <SectionHeader icon={Lock} title="Path Protection Tiers" count={data.pathTiers.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pathTiers.map((tier, i) => (
              <div key={i}>
                <PathTierCard tier={tier} onRemovePath={handleRemovePath} onEditPath={handleEditPath} />
                <AddPathForm tier={tier.tier} onAdd={handleAddPath(tier.tier)} />
              </div>
            ))}
          </div>

          {/* Injection Defense */}
          <SectionHeader icon={ShieldAlert} title="Prompt Injection Defense" count={data.injectionPatterns?.length || 0} />
          <div className="telos-card mb-4" style={{ cursor: "default", borderLeft: "3px solid #9ACBFF" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold" style={{ color: "#9ACBFF" }}>ContentScanner (PostToolUse)</span>
              <span className="text-xs muted">— Scans tool output for injection. Advisory only.</span>
            </div>
            {data.injectionPatterns && data.injectionPatterns.length > 0 ? (
              <div className="space-y-0">
                <div className="grid grid-cols-[120px_1fr_1fr] gap-2 mb-1">
                  <span className="text-xs tracking-wider uppercase muted">Category</span>
                  <span className="text-xs tracking-wider uppercase muted">Description</span>
                  <span className="text-xs tracking-wider uppercase muted">Pattern</span>
                </div>
                {data.injectionPatterns.map((p, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[120px_1fr_1fr] gap-2 py-1.5"
                    style={{ borderTop: "1px solid rgba(26,42,77,0.5)" }}
                  >
                    <span className="text-xs mono" style={{ color: "#9ACBFF" }}>{p.category}</span>
                    <span className="text-xs" style={{ color: "#E8EFFF" }}>{p.description}</span>
                    <code className="text-xs mono truncate" style={{ color: "#9BB0D6" }} title={p.pattern}>{p.pattern}</code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs muted">No injection patterns loaded</p>
            )}
            <p className="text-xs mt-3 muted">
              Source: <code style={{ color: "#D6E1F5" }}>hooks/security/inspectors/InjectionInspector.ts</code> — hardcoded regex, not editable from UI
            </p>
          </div>

          {/* Prompt Guard */}
          <div className="telos-card" style={{ cursor: "default", borderLeft: "3px solid #FBBF24" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold" style={{ color: "#FBBF24" }}>PromptGuard (UserPromptSubmit)</span>
              <span className="text-xs muted">— Scans your prompts before Claude processes them. Can block.</span>
            </div>
            {data.promptGuardPatterns && data.promptGuardPatterns.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {data.promptGuardPatterns.map((p, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded"
                    style={{ background: "#12203D", border: "1px solid #1A2A4D" }}
                  >
                    <div className="text-xs font-semibold" style={{ color: "#FBBF24" }}>{p.category.replace(/_/g, " ")}</div>
                    <div className="text-lg font-bold" style={{ color: "#FBBF24" }}>{p.count}</div>
                    <div className="text-xs muted">patterns</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs muted">No prompt guard patterns loaded</p>
            )}
            <p className="text-xs mt-3 muted">
              Heuristic-only deterministic scanning (~1-5ms, no LLM inference). Covers injection, exfiltration, evasion, security disable.
            </p>
            <p className="text-xs muted">
              Source: <code style={{ color: "#D6E1F5" }}>hooks/PromptGuard.hook.ts</code>
            </p>
          </div>
        </div>
      )}

      {/* ── RULES TAB ── */}
      {activeTab === "rules" && (
        <div>
          <SectionHeader icon={BookOpen} title="Security Rules">
            <div className="flex items-center gap-2">
              {rulesSaved && <span className="text-xs" style={{ color: "#4ADE80" }}>Saved</span>}
              <button
                onClick={saveRules}
                disabled={rulesSaving}
                className="flex items-center gap-1 text-sm pill"
                style={{
                  padding: "6px 14px",
                  background: "rgba(59,130,246,0.25)",
                  color: "#9ACBFF",
                  border: "1px solid rgba(154,203,255,0.4)",
                  cursor: rulesSaving ? "not-allowed" : "pointer",
                  opacity: rulesSaving ? 0.5 : 1,
                }}
              >
                <Save className="w-3 h-3" /> {rulesSaving ? "Saving..." : "Save Rules"}
              </button>
            </div>
          </SectionHeader>
          <div className="telos-card" style={{ cursor: "default", padding: 0, overflow: "hidden", borderLeft: "3px solid #9ACBFF" }}>
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid rgba(26,42,77,0.5)" }}
            >
              <BookOpen className="w-4 h-4" style={{ color: "#9ACBFF" }} />
              <span className="text-xs font-semibold" style={{ color: "#E8EFFF" }}>SECURITY_RULES.md</span>
              <span className="text-xs muted ml-2">Natural language BLOCK/ALLOW rules — currently disabled</span>
            </div>
            <textarea
              value={rulesContent}
              onChange={e => setRulesContent(e.target.value)}
              className="w-full text-xs mono p-4 border-0 resize-y"
              style={{ background: "#060B1A", color: "#E8EFFF", outline: "none" }}
              rows={20}
              spellCheck={false}
              placeholder="# Security Rules&#10;&#10;## BLOCK&#10;- Never do X&#10;&#10;## ALLOW&#10;- Always allow Y"
            />
          </div>
          <div className="telos-card mt-3" style={{ cursor: "default" }}>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4" style={{ color: "#9ACBFF" }} />
              <span className="text-xs font-semibold" style={{ color: "#E8EFFF" }}>How SECURITY_RULES.md Works</span>
            </div>
            <div className="text-xs space-y-1.5" style={{ color: "#D6E1F5" }}>
              <p>
                <code style={{ color: "#9ACBFF" }}>RulesInspector</code> (priority 50) is currently{" "}
                <span className="font-semibold" style={{ color: "#FBBF24" }}>disabled</span>. All previous rules have been migrated to deterministic inspectors.
              </p>
              <p>PatternInspector handles command blocking and path protection. EgressInspector handles credential exfiltration. PromptInspector handles injection and security disable attempts.</p>
              <p>
                To re-enable: add <code style={{ color: "#9ACBFF" }}>## BLOCK</code> and <code style={{ color: "#9ACBFF" }}>## ALLOW</code> sections with rules.
              </p>
              <p>If this file is empty, the RulesInspector is completely disabled (zero cost, zero latency).</p>
              <p className="muted">Changes take effect on the next tool call. No restart needed.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === "events" && (
        <div>
          <SectionHeader icon={Activity} title="Recent Security Events" count={data.events.length} />
          <div className="metric-grid mb-4">
            <StatCard icon={ShieldX} label="Blocks" value={data.eventCounts.blocks} tone="danger" />
            <StatCard icon={FileWarning} label="Alerts" value={data.eventCounts.alerts} tone="warn" />
            <StatCard icon={ShieldAlert} label="Injections" value={data.eventCounts.injections} tone="danger" />
          </div>
          <div className="recs-list">
            {data.events.length === 0 ? (
              <div className="telos-card" style={{ cursor: "default" }}>
                <p className="text-xs text-center py-8 muted">No recent security events</p>
              </div>
            ) : (
              data.events.map((event, i) => <EventRow key={i} event={event} />)
            )}
          </div>
        </div>
      )}

      {/* ── HOOKS TAB ── */}
      {activeTab === "hooks" && (
        <div>
          <SectionHeader icon={Server} title="Security Hook Status" count={data.hooks.length} />
          <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "#9BB0D6" }}>
            <Info className="w-3 h-3" /> Click a hook to see what it does, how it works, and whether it can block tool calls.
          </p>
          <div className="telos-card" style={{ cursor: "default", padding: 8 }}>
            {data.hooks.map((hook, i) => (
              <HookDetailRow key={i} hook={hook} detail={hookDetails[hook.command]} />
            ))}
          </div>
          <p className="text-xs mt-3 ml-1 muted">
            All hooks use <code style={{ color: "#D6E1F5" }}>bun</code> prefix. Green = file exists and registered. Hook wiring in the selected harness config.
          </p>
        </div>
      )}
    </div>
  );
}
