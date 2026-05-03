"use client";

import { useEffect, useState } from "react";
import { Sparkles, MessageSquare, FolderOpen, X } from "lucide-react";

interface OnboardingState {
  templateMode: boolean;
  daName: string;
  interviewCommand: string;
}

const USER_DIR = process.env.NEXT_PUBLIC_PAI_USER_DIR || "~/.claude/PAI/USER";

const DISMISSED_KEY = "pai:template-onboarding:dismissed";

export default function TemplateOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.sessionStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true);
    }
    fetch("/api/onboarding/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setState(d))
      .catch(() => setState(null));
  }, []);

  if (!state || !state.templateMode || dismissed) return null;

  const handleDismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const daName = state.daName || "your DA";
  const cmd = state.interviewCommand || "/interview";

  return (
    <div className="border-b border-blue-500/30 bg-gradient-to-r from-blue-950/60 via-slate-950/70 to-blue-950/60">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/15 p-2 mt-0.5 shrink-0">
            <Sparkles className="w-4 h-4 text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-blue-50">
                You're looking at template content.
              </span>
              <span className="text-sm text-slate-300">
                This is what Pulse looks like before you've made it yours.
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-x-5 gap-y-1.5 flex-wrap text-[13px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <MessageSquare className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                Talk to <span className="text-blue-200 font-medium">{daName}</span> — run
                <code className="px-1.5 py-0.5 rounded bg-slate-800/80 text-blue-200 text-xs font-mono">
                  {cmd}
                </code>
                to walk through your TELOS, identity, goals, and projects.
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <FolderOpen className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                Or edit
                <code className="px-1.5 py-0.5 rounded bg-slate-800/80 text-blue-200 text-xs font-mono">
                  {USER_DIR}/
                </code>
                directly.
              </span>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Hide for this session"
            className="shrink-0 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 p-1.5 transition-colors"
            title="Hide for this session — banner returns until you customize your USER/ files"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
