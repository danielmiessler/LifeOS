"use client";

import { Sparkles, MessageSquare, FolderOpen, BookOpen } from "lucide-react";

interface EmptyStateGuideProps {
  /** What this section is — used in the headline. e.g. "Telos", "Knowledge Archive". */
  section: string;
  /** Short sentence describing what kind of content lives here. */
  description: string;
  /** Subdir under PAI/USER/ that holds this section's data, if any. e.g. "TELOS". */
  userDir?: string;
  /** Concrete interview command to surface. Defaults to "/interview". */
  interviewCommand?: string;
  /** Optional CTA-style example prompt the user can paste to the DA. */
  daPromptExample?: string;
  /** Hide a path if it doesn't apply (e.g. some sections aren't interview-driven). */
  hideInterview?: boolean;
}

export default function EmptyStateGuide({
  section,
  description,
  userDir,
  interviewCommand = "/interview",
  daPromptExample,
  hideInterview = false,
}: EmptyStateGuideProps) {
  const baseUserDir = process.env.NEXT_PUBLIC_PAI_USER_DIR || "~/.claude/PAI/USER";
  const userPath = userDir ? `${baseUserDir}/${userDir}/` : `${baseUserDir}/`;
  const readmePath = userDir ? `${baseUserDir}/${userDir}/README.md` : `${baseUserDir}/README.md`;
  const defaultDaPrompt = daPromptExample ?? `help me set up my ${section.toLowerCase()}`;

  return (
    <div className="rounded-xl border border-blue-900/40 bg-gradient-to-br from-blue-950/30 to-slate-950/50 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-blue-500/10 p-2 mt-0.5">
          <Sparkles className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-blue-50">
            {section} is empty — let's fill it in
          </h3>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
      </div>

      <div className="space-y-2.5 ml-1">
        {!hideInterview && (
          <div className="flex items-start gap-2.5 text-sm">
            <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-200">Run </span>
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-xs font-mono">
                {interviewCommand}
              </code>
              <span className="text-slate-400">
                {" "}— your DA walks you through the questions and writes the answers to disk.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 text-sm">
          <FolderOpen className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-200">Edit files at </span>
            <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-xs font-mono">
              {userPath}
            </code>
            <span className="text-slate-400">
              {" "}— or import existing data (Obsidian, Notion, journals) with the{" "}
            </span>
            <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-xs font-mono">
              Migrate
            </code>
            <span className="text-slate-400"> skill.</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm">
          <BookOpen className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-200">Read </span>
            <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-xs font-mono">
              {readmePath}
            </code>
            <span className="text-slate-400"> for the full layout and customization guide.</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm pt-1">
          <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-200">Or just ask your DA: </span>
            <span className="text-blue-300 italic">"{defaultDaPrompt}"</span>
          </div>
        </div>
      </div>
    </div>
  );
}
