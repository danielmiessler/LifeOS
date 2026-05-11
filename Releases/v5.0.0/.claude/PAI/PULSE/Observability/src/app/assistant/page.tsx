"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localApiCall } from "@/lib/local-api";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import {
  Bot, Zap, Terminal, Clock, Plus, X, Trash2,
  Heart, Brain, Shield, Pencil, Check,
} from "lucide-react";

// ── Types ──

interface Identity {
  name: string;
  full_name: string;
  display_name: string;
  color: string;
  role: string;
  origin_story: string;
  has_avatar: boolean;
  principal: string;
  uptime_ms: number;
}

interface Personality {
  base_description: string;
  traits: Record<string, number>;
  anchors: Array<{ name: string; description: string }>;
  preferences: {
    what_i_love: string[];
    what_i_dislike: string[];
    working_style: string[];
    intellectual_interests: string[];
  };
  companion: { name: string; species: string; personality: string } | null;
  relationship: { dynamic: string; interaction_style: string };
  autonomy: { can_initiate: string[]; must_ask: string[] };
  writing: { style: string; avoid: string[]; prefer: string[] };
  voice: { provider: string } | null;
}

interface UnifiedTask {
  name: string;
  schedule: string;
  status: string;
  source: "da" | "pulse" | "claude-code";
  details?: Record<string, unknown>;
}

interface TasksResponse {
  tasks: UnifiedTask[];
  count: number;
  by_source: { da: number; pulse: number; "claude-code": number };
}

interface DiaryEntry {
  date: string;
  interaction_count: number;
  topics: string[];
  mood: "positive" | "neutral" | "frustrated";
  avg_rating: number;
  notable_moments: string[];
  learning: string | null;
}

interface Health {
  status: string;
  primary_da: string;
  identity_loaded: boolean;
  scheduled_tasks: number;
  last_heartbeat: string | null;
  diary_entries_today: number;
  opinions_count: number;
}

// ── Helpers ──

type Dimension = "health" | "money" | "freedom" | "creative" | "relationships" | "rhythms";

const dimColors: Record<Dimension, string> = {
  health: "var(--health)",
  money: "var(--money)",
  freedom: "var(--freedom)",
  creative: "var(--creative)",
  relationships: "var(--relationships)",
  rhythms: "var(--rhythms)",
};

const dimTints: Record<Dimension, string> = {
  health: "rgba(52,211,153,0.16)",
  money: "rgba(224,164,88,0.16)",
  freedom: "rgba(125,211,252,0.16)",
  creative: "rgba(248,123,123,0.16)",
  relationships: "rgba(183,148,244,0.16)",
  rhythms: "rgba(45,212,191,0.16)",
};

const tabDimensions: Record<"tasks" | "personality" | "diary", Dimension> = {
  tasks: "creative",
  personality: "relationships",
  diary: "rhythms",
};

const traitDimensions: Dimension[] = ["creative", "relationships", "freedom", "rhythms", "money", "health"];

const statusClass: Record<string, "green-up" | "flat-muted" | "coral-down"> = {
  active: "green-up",
  disabled: "flat-muted",
  completed: "flat-muted",
  cancelled: "coral-down",
};

function formatUptime(ms: number): string {
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Section({
  title,
  icon: Icon,
  action,
  children,
  dimension = "creative",
}: {
  title: string;
  icon?: typeof Brain;
  action?: React.ReactNode;
  children: React.ReactNode;
  dimension?: Dimension;
}) {
  return (
    <div className="telos-card" style={{ cursor: "default", gap: 14 }}>
      <div className="flex items-center justify-between" style={{ paddingBottom: 10, borderBottom: "1px dashed #1A2A4D" }}>
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-5 h-5" style={{ color: dimColors[dimension] }} />}
          <h2 className="text-sm font-medium tracking-[0.15em] uppercase" style={{ color: dimColors[dimension] }}>{title}</h2>
        </div>
        {action}
      </div>
      <div data-sensitive>{children}</div>
    </div>
  );
}

function TraitBar({ name, value, color, onEdit }: { name: string; value: number; color: string; onEdit?: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  return (
    <div className="flex items-center gap-4 group">
      <span className="w-32 truncate capitalize text-sm" style={{ color: "#D6E1F5" }} data-sensitive>
        {name.replace(/_/g, " ")}
      </span>
      <div className="progress-bar flex-1" style={{ height: 6, margin: 0 }}>
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            value={editValue}
            onChange={(e) => setEditValue(Number(e.target.value))}
            className="w-14 text-sm rounded px-2 py-1"
            style={{ background: "#12203D", border: "1px solid #1A2A4D", color: "#E8EFFF" }}
          />
          <button onClick={() => { onEdit?.(editValue); setEditing(false); }} className="green-up">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} style={{ color: "#6B80AB" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <span className="w-10 text-right text-sm mono flat-muted">{value}</span>
          {onEdit && (
            <button
              onClick={() => { setEditValue(value); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "#6B80AB" }}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ──

export default function AssistantPage() {
  const queryClient = useQueryClient();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskSchedule, setNewTaskSchedule] = useState("");
  const [activeTab, setActiveTab] = useState<"tasks" | "personality" | "diary">("tasks");

  const { data: identity } = useQuery<Identity>({ queryKey: ["assistant-identity"], queryFn: () => localApiCall("/assistant/identity"), refetchInterval: 30_000 });
  const { data: health } = useQuery<Health>({ queryKey: ["assistant-health"], queryFn: () => localApiCall("/assistant/health"), refetchInterval: 10_000 });
  const { data: personality } = useQuery<Personality>({ queryKey: ["assistant-personality"], queryFn: () => localApiCall("/assistant/personality"), refetchInterval: 60_000 });
  const { data: tasksData } = useQuery<TasksResponse>({ queryKey: ["assistant-tasks"], queryFn: () => localApiCall("/assistant/tasks"), refetchInterval: 15_000 });
  const { data: diaryData } = useQuery<{ entries: DiaryEntry[] }>({ queryKey: ["assistant-diary"], queryFn: () => localApiCall("/assistant/diary"), refetchInterval: 60_000 });
  const { data: opinionsData } = useQuery<{ raw: string }>({ queryKey: ["assistant-opinions"], queryFn: () => localApiCall("/assistant/opinions"), refetchInterval: 60_000 });

  const createTask = useMutation({
    mutationFn: (task: { description: string; schedule?: { type: string; cron?: string }; action: { type: string; message: string; channel: string } }) =>
      localApiCall("/assistant/tasks", { method: "POST", body: JSON.stringify(task) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["assistant-tasks"] }); setShowAddTask(false); setNewTaskDesc(""); setNewTaskSchedule(""); },
  });

  const cancelTask = useMutation({
    mutationFn: (id: string) => localApiCall(`/assistant/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-tasks"] }),
  });

  const updateTrait = useMutation({
    mutationFn: (update: Record<string, number>) =>
      localApiCall("/assistant/personality/traits", { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-personality"] }),
  });

  const tabButton = (tab: "tasks" | "personality" | "diary", label: string) => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`pill pill-${tabDimensions[tab]} capitalize ${activeTab === tab ? "on" : ""}`}
      style={{
        padding: "6px 14px",
        fontSize: 13,
        cursor: "pointer",
        background: activeTab === tab ? dimTints[tabDimensions[tab]] : "rgba(168,165,200,0.08)",
        color: activeTab === tab ? "#E8EFFF" : dimColors[tabDimensions[tab]],
        border: activeTab === tab ? `1px solid ${dimColors[tabDimensions[tab]]}` : "1px solid rgba(168,165,200,0.22)",
      }}
    >
      {label}
    </button>
  );

  const isFreshInstall = health ? !health.identity_loaded : !identity;

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-8">

        {isFreshInstall && (
          <EmptyStateGuide
            section="DA Identity"
            description="Your DA's name, voice, personality, and the diary they keep about your work together."
            userDir="DA"
            daPromptExample="set up my DA's identity and personality"
          />
        )}

        {/* Identity Card */}
        {identity && (
          <div className="telos-card mission-card goal-card dim-creative" style={{ cursor: "default", flexDirection: "row", alignItems: "center", gap: 24 }}>
            {identity.has_avatar ? (
              <img
                src="/assistant/avatar"
                alt={identity.display_name}
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: "2px solid var(--creative)" }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                style={{ backgroundColor: "rgba(248,123,123,0.14)", color: "var(--creative)", flexShrink: 0 }}
              >
                {identity.display_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0" data-sensitive>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="mission-title" style={{ fontSize: 20 }}>{identity.full_name}</h1>
                <span
                  className="pill pill-creative"
                  style={{ letterSpacing: 1.2, fontWeight: 600 }}
                >
                  {identity.display_name}
                </span>
              </div>
              <p className="mt-1" style={{ color: "#D6E1F5", fontSize: 14 }}>{identity.role}</p>
              {identity.origin_story && (
                <p className="mt-1.5 leading-relaxed" style={{ color: "#9BB0D6", fontSize: 13 }}>{identity.origin_story}</p>
              )}
            </div>
            <div className="text-right text-sm space-y-1.5 shrink-0" style={{ color: "#9BB0D6" }}>
              <div className="flex items-center gap-2 justify-end">
                <Clock className="w-4 h-4" style={{ color: "var(--creative)" }} />
                <span>Up {formatUptime(identity.uptime_ms)}</span>
              </div>
              <div>Principal: <span style={{ color: "#E8EFFF" }}>{identity.principal}</span></div>
              <div>{health?.opinions_count ?? 0} opinions formed</div>
            </div>
          </div>
        )}

        {/* Stats */}
        {health && (
          <div className="metric-grid">
            {[
              { label: "Status", value: health.status === "ok" ? "Online" : health.status, trend: health.status === "ok" ? "up" : "down" },
              { label: "DA Tasks", value: String(tasksData?.by_source.da ?? 0), trend: "flat" as const },
              { label: "Cron Jobs", value: String(tasksData?.by_source.pulse ?? 0), trend: "flat" as const },
              { label: "CC Triggers", value: String(tasksData?.by_source["claude-code"] ?? 0), trend: "flat" as const },
            ].map(({ label, value, trend }) => (
              <div key={label} className="telos-card metric" style={{ cursor: "default" }}>
                <div className="metric-top">
                  <span className="metric-label muted">{label}</span>
                </div>
                <div className="metric-row">
                  <span className={`metric-val mono ${trend === "up" ? "green-up" : trend === "down" ? "coral-down" : "flat-muted"}`}>{value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex items-center gap-2" style={{ borderBottom: "1px solid #1A2A4D", paddingBottom: 12 }}>
          {tabButton("tasks", "Tasks")}
          {tabButton("personality", "Personality")}
          {tabButton("diary", "Diary")}
        </div>

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div className="space-y-6">
            <Section
              title="Scheduled Tasks"
              icon={Bot}
              dimension="creative"
              action={
                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: "var(--creative)" }}
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              }
            >
              {showAddTask && (
                <div className="mb-5 p-4 rounded-md space-y-3" style={{ background: "#12203D", border: "1px solid #1A2A4D" }}>
                  <input
                    placeholder="Task description..."
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    className="w-full text-sm rounded px-4 py-2"
                    style={{ background: "#0F1A33", border: "1px solid #1A2A4D", color: "#E8EFFF" }}
                  />
                  <div className="flex gap-3">
                    <input
                      placeholder="Cron schedule (e.g. 0 9 * * 1) or leave empty for one-time"
                      value={newTaskSchedule}
                      onChange={(e) => setNewTaskSchedule(e.target.value)}
                      className="flex-1 text-sm rounded px-4 py-2 mono"
                      style={{ background: "#0F1A33", border: "1px solid #1A2A4D", color: "#E8EFFF" }}
                    />
                    <button
                      onClick={() => {
                        if (!newTaskDesc.trim()) return;
                        createTask.mutate({
                          description: newTaskDesc.trim(),
                          schedule: newTaskSchedule.trim() ? { type: "recurring", cron: newTaskSchedule.trim() } : undefined,
                          action: { type: "notify", message: newTaskDesc.trim(), channel: "voice" },
                        });
                      }}
                      className="pill pill-creative"
                      style={{
                        padding: "6px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              {(() => {
                const daTasks = tasksData?.tasks.filter((t) => t.source === "da") ?? [];
                return daTasks.length === 0 ? (
                  <div style={{ color: "#6B80AB", fontSize: 14 }}>No scheduled tasks</div>
                ) : (
                  <div className="space-y-1">
                    {daTasks.map((task, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-4 py-3 rounded-md group"
                        style={{ background: "transparent", transition: "background 180ms" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#12203D")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Bot className="w-5 h-5 shrink-0" style={{ color: "var(--creative)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ color: "#E8EFFF" }}>{task.name}</div>
                          <div className="text-xs mono muted">{task.schedule}</div>
                        </div>
                        <span
                          className={`text-xs font-medium tracking-wider uppercase ${statusClass[task.status] ?? "flat-muted"}`}
                        >
                          {task.status}
                        </span>
                        {task.status === "active" && task.details?.id && (
                          <button
                            onClick={() => cancelTask.mutate(task.details!.id as string)}
                            className="opacity-0 group-hover:opacity-100 transition-all"
                            style={{ color: "#6B80AB" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#F87171")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#6B80AB")}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Section>

            <Section title="Pulse Cron Jobs" icon={Zap} dimension="rhythms">
              <div className="space-y-1">
                {(tasksData?.tasks.filter((t) => t.source === "pulse") ?? []).map((task, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-md">
                    <Zap className="w-5 h-5 shrink-0" style={{ color: "var(--rhythms)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ color: "#E8EFFF" }}>{task.name}</div>
                      <div className="text-xs mono muted">{task.schedule}</div>
                    </div>
                    <span
                      className={`text-xs font-medium tracking-wider uppercase ${statusClass[task.status] ?? "flat-muted"}`}
                    >
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {(tasksData?.by_source["claude-code"] ?? 0) > 0 && (
              <Section title="Claude Code Triggers" icon={Terminal} dimension="freedom">
                <div className="space-y-1">
                  {(tasksData?.tasks.filter((t) => t.source === "claude-code") ?? []).map((task, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-md">
                      <Terminal className="w-5 h-5 shrink-0" style={{ color: "var(--freedom)" }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: "#E8EFFF" }}>{task.name}</div>
                        <div className="text-xs mono muted">{task.schedule}</div>
                      </div>
                      <span
                        className={`text-xs font-medium tracking-wider uppercase ${statusClass[task.status] ?? "flat-muted"}`}
                      >
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* PERSONALITY TAB */}
        {activeTab === "personality" && personality && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Personality Traits" icon={Brain} dimension="creative">
              {personality.base_description && (
                <p className="mb-5 leading-relaxed" style={{ color: "#D6E1F5", fontSize: 14 }}>
                  {personality.base_description}
                </p>
              )}
              <div className="space-y-3">
                {Object.entries(personality.traits).map(([name, value], index) => (
                  <TraitBar
                    key={name}
                    name={name}
                    value={value as number}
                    color={dimColors[traitDimensions[index % traitDimensions.length]]}
                    onEdit={(v) => updateTrait.mutate({ [name]: v })}
                  />
                ))}
              </div>
            </Section>

            <div className="space-y-6">
              <Section title="What I Love" icon={Heart} dimension="money">
                <ul className="space-y-2">
                  {personality.preferences.what_i_love.map((item, i) => (
                    <li key={i} className="leading-relaxed flex gap-2" style={{ color: "#D6E1F5", fontSize: 14 }}>
                      <span className="shrink-0 mt-0.5 green-up">+</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="What I Dislike" dimension="money">
                <ul className="space-y-2">
                  {personality.preferences.what_i_dislike.map((item, i) => (
                    <li key={i} className="leading-relaxed flex gap-2" style={{ color: "#D6E1F5", fontSize: 14 }}>
                      <span className="shrink-0 mt-0.5 coral-down">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            {personality.anchors.length > 0 && (
              <Section title="Key Moments" dimension="relationships">
                <div className="space-y-4">
                  {personality.anchors.map((anchor, i) => (
                    <div key={i}>
                      <div className="text-sm font-medium" style={{ color: "var(--relationships)" }}>{anchor.name}</div>
                      <div className="text-sm mt-1" style={{ color: "#9BB0D6" }}>{anchor.description}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {personality.companion && (
              <Section title="Companion" dimension="relationships">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">🐱</div>
                  <div>
                    <div className="text-base font-medium" style={{ color: "#E8EFFF" }}>{personality.companion.name}</div>
                    <div className="text-sm" style={{ color: "#9BB0D6" }}>
                      {personality.companion.species} — {personality.companion.personality}
                    </div>
                  </div>
                </div>
              </Section>
            )}

            <Section title="Autonomy" icon={Shield} dimension="freedom">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs tracking-wider uppercase mb-2 green-up">Can Initiate</div>
                  {personality.autonomy.can_initiate.map((item, i) => (
                    <div key={i} className="py-1 text-sm" style={{ color: "#D6E1F5" }}>{item.replace(/_/g, " ")}</div>
                  ))}
                </div>
                <div>
                  <div className="text-xs tracking-wider uppercase mb-2" style={{ color: "var(--money)" }}>Must Ask</div>
                  {personality.autonomy.must_ask.map((item, i) => (
                    <div key={i} className="py-1 text-sm" style={{ color: "#D6E1F5" }}>{item.replace(/_/g, " ")}</div>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Formed Opinions" dimension="creative">
              {(() => {
                const blocks = opinionsData?.raw?.split(/^\s*- topic:/m).slice(1).slice(0, 10) ?? [];
                if (blocks.length === 0) {
                  return <div style={{ color: "#6B80AB", fontSize: 14 }}>No opinions yet</div>;
                }
                return (
                  <div className="space-y-3">
                    {blocks.map((block, i) => {
                      const topic = block.match(/^\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim() ?? "";
                      const belief = block.match(/belief:\s*"?([^"\n]+)"?/)?.[1]?.trim() ?? "";
                      const confidence = parseFloat(block.match(/confidence:\s*([\d.]+)/)?.[1] ?? "0");
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div
                            className="w-2 h-2 rounded-full mt-2 shrink-0"
                            style={{ backgroundColor: `rgba(248, 123, 123, ${Math.max(0.2, confidence)})` }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm" style={{ color: "#E8EFFF" }}>{topic}</div>
                            <div className="text-sm" style={{ color: "#9BB0D6" }}>{belief}</div>
                          </div>
                          <span className="text-xs shrink-0 mono" style={{ color: "#6B80AB" }}>
                            {(confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Section>
          </div>
        )}

        {/* DIARY TAB */}
        {activeTab === "diary" && (
          <Section title="Diary Entries" dimension="rhythms">
            {!diaryData || diaryData.entries.length === 0 ? (
              <div style={{ color: "#6B80AB", fontSize: 14 }}>No diary entries</div>
            ) : (
              <div className="space-y-4">
                {diaryData.entries.slice().reverse().map((entry) => (
                  <div
                    key={entry.date}
                    className="p-4 rounded-md space-y-3"
                    style={{ background: "#12203D", border: "1px solid #1A2A4D" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="mono" style={{ color: "#E8EFFF", fontSize: 15 }}>{entry.date}</span>
                      <div className="flex items-center gap-4 text-sm" style={{ color: "#9BB0D6" }}>
                        <span>{entry.interaction_count} sessions</span>
                        <span className={entry.mood === "positive" ? "green-up" : entry.mood === "frustrated" ? "coral-down" : "flat-muted"}>
                          {entry.mood}
                        </span>
                        <span>{entry.avg_rating}/10</span>
                      </div>
                    </div>
                    {entry.topics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entry.topics.map((topic, i) => (
                          <span key={i} className="pill pill-rhythms">{topic}</span>
                        ))}
                      </div>
                    )}
                    {entry.notable_moments.map((moment, i) => (
                      <div key={i} className="text-sm" style={{ color: "#D6E1F5" }}>{moment}</div>
                    ))}
                    {entry.learning && (
                      <div
                        className="text-sm italic pl-3"
                        style={{ color: "#9BB0D6", borderLeft: "2px solid rgba(45,212,191,0.4)" }}
                      >
                        {entry.learning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
