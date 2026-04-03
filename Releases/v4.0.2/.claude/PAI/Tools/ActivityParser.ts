#!/usr/bin/env bun
/**
 * ActivityParser - Parse session activity for PAI repo update documentation
 *
 * Commands:
 *   --today              Parse all today's activity
 *   --session <id>       Parse specific session only
 *   --generate           Generate MEMORY/PAISYSTEMUPDATES/ file (outputs path)
 *
 * Examples:
 *   bun run ActivityParser.ts --today
 *   bun run ActivityParser.ts --today --generate
 *   bun run ActivityParser.ts --session abc-123
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_DIR = path.join(process.env.HOME!, ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const USERNAME = process.env.USER || require("os").userInfo().username;
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects", `-Users-${USERNAME}--claude`);  // Claude Code native storage
const SYSTEM_UPDATES_DIR = path.join(MEMORY_DIR, "PAISYSTEMUPDATES");  // Canonical system change history

// ============================================================================
// Types
// ============================================================================

interface FileChange {
  file: string;
  action: "created" | "modified";
  relativePath: string;
}

interface ParsedActivity {
  date: string;
  session_id: string | null;
  categories: {
    skills: FileChange[];
    workflows: FileChange[];
    tools: FileChange[];
    hooks: FileChange[];
    architecture: FileChange[];
    documentation: FileChange[];
    other: FileChange[];
  };
  summary: string;
  files_modified: string[];
  files_created: string[];
  skills_affected: string[];
}

// ============================================================================
// Category Detection
// ============================================================================

const PATTERNS = {
  // Skip patterns (check first)
  skip: [
    /MEMORY\/PAISYSTEMUPDATES\//,    // Don't self-reference
    /MEMORY\//,                    // Memory outputs (all of MEMORY is capture, not source)
    /WORK\/.*\/scratch\//,         // Temporary work session files
    /\.quote-cache$/,              // Cache files
    /history\.jsonl$/,             // History file
    /cache\//,                     // Cache directory
    /plans\//i,                    // Plan files
  ],

  // Category patterns
  skills: /skills\/[^/]+\/(SKILL\.md|Workflows\/|Tools\/|Data\/)/,
  workflows: /Workflows\/.*\.md$/,
  tools: /skills\/[^/]+\/Tools\/.*\.ts$/,
  hooks: /hooks\/.*\.ts$/,
  architecture: /(ARCHITECTURE|PAISYSTEMARCHITECTURE|SKILLSYSTEM)\.md$/i,
  documentation: /\.(md|txt)$/,
};

function shouldSkip(filePath: string): boolean {
  return PATTERNS.skip.some(pattern => pattern.test(filePath));
}

function categorizeFile(filePath: string): keyof ParsedActivity["categories"] | null {
  if (shouldSkip(filePath)) return null;
  if (!filePath.includes("/.claude/")) return null;

  if (PATTERNS.skills.test(filePath)) return "skills";
  if (PATTERNS.workflows.test(filePath)) return "workflows";
  if (PATTERNS.tools.test(filePath)) return "tools";
  if (PATTERNS.hooks.test(filePath)) return "hooks";
  if (PATTERNS.architecture.test(filePath)) return "architecture";
  if (PATTERNS.documentation.test(filePath)) return "documentation";

  return "other";
}

function extractSkillName(filePath: string): string | null {
  const match = filePath.match(/skills\/([^/]+)\//);
  return match ? match[1] : null;
}

function getRelativePath(filePath: string): string {
  const claudeIndex = filePath.indexOf("/.claude/");
  if (claudeIndex === -1) return filePath;
  return filePath.substring(claudeIndex + 9); // Skip "/.claude/"
}

// ============================================================================
// Event Parsing
// ============================================================================

// Projects/ format from Claude Code native storage
interface ProjectsEntry {
  sessionId?: string;
  type?: "user" | "assistant" | "summary";
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      name?: string;
      input?: {
        file_path?: string;
        command?: string;
      };
    }>;
  };
  timestamp?: string;
}

/**
 * Get session files from today (modified within last 24 hours)
 */
function getTodaySessionFiles(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return [];
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(PROJECTS_DIR, f),
      mtime: fs.statSync(path.join(PROJECTS_DIR, f)).mtime.getTime()
    }))
    .filter(f => f.mtime > oneDayAgo)
    .sort((a, b) => b.mtime - a.mtime);

  return files.map(f => f.path);
}

async function parseEvents(sessionFilter?: string): Promise<ParsedActivity> {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  // Get today's session files from projects/
  const sessionFiles = getTodaySessionFiles();

  if (sessionFiles.length === 0) {
    console.error(`No session files found for today in: ${PROJECTS_DIR}`);
    return emptyActivity(dateStr, sessionFilter || null);
  }

  // Parse all session files (or just the filtered one)
  const entries: ProjectsEntry[] = [];

  for (const sessionFile of sessionFiles) {
    // If filtering by session, check filename matches
    if (sessionFilter && !sessionFile.includes(sessionFilter)) {
      continue;
    }

    const content = fs.readFileSync(sessionFile, "utf-8");
    const lines = content.split("\n").filter(line => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ProjectsEntry;
        entries.push(entry);
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Extract file operations from tool_use entries
  const filesModified = new Set<string>();
  const filesCreated = new Set<string>();

  for (const entry of entries) {
    // Only process assistant messages with tool_use
    if (entry.type !== "assistant" || !entry.message?.content) continue;

    for (const contentItem of entry.message.content) {
      if (contentItem.type !== "tool_use") continue;

      // Write tool = new files
      if (contentItem.name === "Write" && contentItem.input?.file_path) {
        const filePath = contentItem.input.file_path;
        if (filePath.includes("/.claude/")) {
          filesCreated.add(filePath);
        }
      }

      // Edit tool = modified files
      if (contentItem.name === "Edit" && contentItem.input?.file_path) {
        const filePath = contentItem.input.file_path;
        if (filePath.includes("/.claude/")) {
          filesModified.add(filePath);
        }
      }
    }
  }

  // Remove from modified if also in created (it's just created)
  for (const file of filesCreated) {
    filesModified.delete(file);
  }

  // Categorize changes
  const categories: ParsedActivity["categories"] = {
    skills: [],
    workflows: [],
    tools: [],
    hooks: [],
    architecture: [],
    documentation: [],
    other: [],
  };

  const skillsAffected = new Set<string>();

  const processFile = (file: string, action: "created" | "modified") => {
    const category = categorizeFile(file);
    if (!category) return;

    const change: FileChange = {
      file,
      action,
      relativePath: getRelativePath(file),
    };

    categories[category].push(change);

    // Track affected skills
    const skill = extractSkillName(file);
    if (skill) skillsAffected.add(skill);
  };

  for (const file of filesCreated) processFile(file, "created");
  for (const file of filesModified) processFile(file, "modified");

  // Generate summary
  const summaryParts: string[] = [];
  if (skillsAffected.size > 0) {
    summaryParts.push(`${skillsAffected.size} skill(s) affected`);
  }
  if (categories.tools.length > 0) {
    summaryParts.push(`${categories.tools.length} tool(s)`);
  }
  if (categories.hooks.length > 0) {
    summaryParts.push(`${categories.hooks.length} hook(s)`);
  }
  if (categories.workflows.length > 0) {
    summaryParts.push(`${categories.workflows.length} workflow(s)`);
  }
  if (categories.architecture.length > 0) {
    summaryParts.push("architecture changes");
  }

  return {
    date: dateStr,
    session_id: sessionFilter || null,
    categories,
    summary: summaryParts.join(", ") || "documentation updates",
    files_modified: [...filesModified],
    files_created: [...filesCreated],
    skills_affected: [...skillsAffected],
  };
}

function emptyActivity(date: string, sessionId: string | null): ParsedActivity {
  return {
    date,
    session_id: sessionId,
    categories: {
      skills: [],
      workflows: [],
      tools: [],
      hooks: [],
      architecture: [],
      documentation: [],
      other: [],
    },
    summary: "no changes detected",
    files_modified: [],
    files_created: [],
    skills_affected: [],
  };
}

// ============================================================================
// Update File Generation
// ============================================================================

type SignificanceLabel = 'trivial' | 'minor' | 'moderate' | 'major' | 'critical';
type ChangeType = 'skill_update' | 'structure_change' | 'doc_update' | 'hook_update' | 'workflow_update' | 'config_update' | 'tool_update' | 'multi_area';

function determineChangeType(activity: ParsedActivity): ChangeType {
  const { categories } = activity;
  const totalCategories = Object.entries(categories)
    .filter(([key, items]) => key !== 'other' && items.length > 0)
    .length;

  // Multi-area if changes span 3+ categories
  if (totalCategories >= 3) return 'multi_area';

  // Priority order for single-category determination
  if (categories.hooks.length > 0) return 'hook_update';
  if (categories.tools.length > 0) return 'tool_update';
  if (categories.workflows.length > 0) return 'workflow_update';
  if (categories.architecture.length > 0) return 'structure_change';
  if (categories.skills.length > 0) return 'skill_update';
  if (categories.documentation.length > 0) return 'doc_update';

  return 'doc_update';
}

function determineSignificance(activity: ParsedActivity): SignificanceLabel {
  const { categories, files_created, files_modified } = activity;
  const totalFiles = files_created.length + files_modified.length;
  const hasArchitecture = categories.architecture.length > 0;
  const hasNewSkill = categories.skills.some(c => c.action === 'created' && c.file.endsWith('SKILL.md'));
  const hasNewTool = categories.tools.some(c => c.action === 'created');
  const hasNewWorkflow = categories.workflows.some(c => c.action === 'created');

  // Critical: Breaking changes or major restructuring
  if (hasArchitecture && totalFiles >= 10) return 'critical';

  // Major: New skills, significant features
  if (hasNewSkill) return 'major';
  if (hasArchitecture) return 'major';
  if ((hasNewTool || hasNewWorkflow) && totalFiles >= 5) return 'major';

  // Moderate: Multi-file updates, new tools/workflows
  if (hasNewTool || hasNewWorkflow) return 'moderate';
  if (totalFiles >= 5) return 'moderate';
  if (categories.hooks.length > 0) return 'moderate';

  // Minor: Small changes to existing files
  if (totalFiles >= 2) return 'minor';

  // Trivial: Single file doc updates
  return 'trivial';
}

function generateTitle(activity: ParsedActivity): string {
  const { categories, skills_affected } = activity;

  // Helper to extract meaningful name from path
  const extractName = (filePath: string): string => {
    const base = path.basename(filePath, path.extname(filePath));
    // Convert kebab-case or snake_case to Title Case
    return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Helper to pluralize if needed
  const plural = (count: number, word: string): string =>
    count === 1 ? word : `${word}s`;

  // New tool created - most specific
  if (categories.tools.some((c) => c.action === "created")) {
    const newTool = categories.tools.find((c) => c.action === "created");
    const name = extractName(newTool!.file);
    if (skills_affected.length === 1) {
      return `Added ${name} Tool to ${skills_affected[0]} Skill`;
    }
    return `Created ${name} Tool for System`;
  }

  // New workflow created
  if (categories.workflows.some((c) => c.action === "created")) {
    const newWorkflow = categories.workflows.find((c) => c.action === "created");
    const name = extractName(newWorkflow!.file);
    if (skills_affected.length === 1) {
      return `Added ${name} Workflow to ${skills_affected[0]}`;
    }
    return `Created ${name} Workflow`;
  }

  // Hook changes - describe what hooks
  if (categories.hooks.length > 0) {
    const hookNames = categories.hooks
      .map(h => extractName(h.file))
      .slice(0, 2);
    if (hookNames.length === 1) {
      return `Updated ${hookNames[0]} Hook Handler`;
    }
    return `Updated ${hookNames[0]} and ${hookNames.length - 1} Other ${plural(hookNames.length - 1, 'Hook')}`;
  }

  // Single skill affected - describe what changed
  if (skills_affected.length === 1) {
    const skill = skills_affected[0];
    const skillChanges = categories.skills;
    const hasWorkflowMod = categories.workflows.length > 0;
    const hasToolMod = categories.tools.length > 0;

    if (hasWorkflowMod && hasToolMod) {
      return `Enhanced ${skill} Workflows and Tools`;
    }
    if (hasWorkflowMod) {
      return `Updated ${skill} Workflow Configuration`;
    }
    if (hasToolMod) {
      return `Modified ${skill} Tool Implementation`;
    }
    if (skillChanges.some(c => c.file.includes('SKILL.md'))) {
      return `Updated ${skill} Skill Documentation`;
    }
    return `Updated ${skill} Skill Files`;
  }

  // Multiple skills affected
  if (skills_affected.length > 1) {
    const topTwo = skills_affected.slice(0, 2);
    if (skills_affected.length === 2) {
      return `Updated ${topTwo[0]} and ${topTwo[1]} Skills`;
    }
    return `Updated ${topTwo[0]} and ${skills_affected.length - 1} Other Skills`;
  }

  // Architecture changes
  if (categories.architecture.length > 0) {
    const archFile = extractName(categories.architecture[0].file);
    return `Modified ${archFile} Architecture Document`;
  }

  // Documentation only
  if (categories.documentation.length > 0) {
    const docCount = categories.documentation.length;
    if (docCount === 1) {
      const docName = extractName(categories.documentation[0].file);
      return `Updated ${docName} Documentation`;
    }
    return `Updated ${docCount} Documentation ${plural(docCount, 'File')}`;
  }

  // Fallback with date context
  return `System Updates for ${activity.date}`;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getSignificanceBadge(significance: SignificanceLabel): string {
  const badges: Record<SignificanceLabel, string> = {
    critical: '🔴 Critical',
    major: '🟠 Major',
    moderate: '🟡 Moderate',
    minor: '🟢 Minor',
    trivial: '⚪ Trivial',
  };
  return badges[significance];
}

function formatChangeType(changeType: ChangeType): string {
  const labels: Record<ChangeType, string> = {
    skill_update: 'Skill Update',
    structure_change: 'Structure Change',
    doc_update: 'Documentation Update',
    hook_update: 'Hook Update',
    workflow_update: 'Workflow Update',
    config_update: 'Config Update',
    tool_update: 'Tool Update',
    multi_area: 'Multi-Area',
  };
  return labels[changeType];
}

function generatePurpose(activity: ParsedActivity): string {
  const { categories, skills_affected } = activity;

  if (categories.tools.some(c => c.action === 'created')) {
    return 'Add new tooling capability to the system';
  }
  if (categories.workflows.some(c => c.action === 'created')) {
    return 'Introduce new workflow for improved task execution';
  }
  if (categories.hooks.length > 0) {
    return 'Update hook system for better lifecycle management';
  }
  if (skills_affected.length > 0) {
    return `Improve ${skills_affected.slice(0, 2).join(' and ')} skill functionality`;
  }
  if (categories.architecture.length > 0) {
    return 'Refine system architecture documentation';
  }
  return 'Maintain and improve system documentation';
}

function generateExpectedImprovement(activity: ParsedActivity): string {
  const { categories, skills_affected } = activity;

  if (categories.tools.some(c => c.action === 'created')) {
    return 'New capabilities available for system tasks';
  }
  if (categories.workflows.some(c => c.action === 'created')) {
    return 'Streamlined execution of related tasks';
  }
  if (categories.hooks.length > 0) {
    return 'More reliable system event handling';
  }
  if (skills_affected.length > 0) {
    return 'Enhanced skill behavior and documentation clarity';
  }
  if (categories.architecture.length > 0) {
    return 'Clearer understanding of system design';
  }
  return 'Better documentation accuracy';
}

function generateUpdateFile(activity: ParsedActivity): string {
  const title = generateTitle(activity);
  const significance = determineSignificance(activity);
  const changeType = determineChangeType(activity);
  const purpose = generatePurpose(activity);
  const expectedImprovement = generateExpectedImprovement(activity);

  // Build YAML frontmatter
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const id = `${activity.date}-${toKebabCase(title)}`;

  const allFiles = [
    ...activity.files_created,
    ...activity.files_modified,
  ].filter(f => !shouldSkip(f)).map(f => getRelativePath(f));

  let content = `---
id: "${id}"
timestamp: "${timestamp}"
title: "${title}"
significance: "${significance}"
change_type: "${changeType}"
files_affected:
${allFiles.slice(0, 20).map(f => `  - "${f}"`).join('\n')}
purpose: "${purpose}"
expected_improvement: "${expectedImprovement}"
integrity_work:
  references_found: 0
  references_updated: 0
  locations_checked: []
---

# ${title}

**Timestamp:** ${timestamp}
**Significance:** ${getSignificanceBadge(significance)}
**Change Type:** ${formatChangeType(changeType)}

---

## Purpose

${purpose}

## Expected Improvement

${expectedImprovement}

## Summary

Session activity documentation for ${activity.date}.
${activity.summary}.

## Changes Made

`;

  // Add sections for non-empty categories
  const categoryNames: Record<keyof ParsedActivity["categories"], string> = {
    skills: "Skills",
    workflows: "Workflows",
    tools: "Tools",
    hooks: "Hooks",
    architecture: "Architecture",
    documentation: "Documentation",
    other: "Other",
  };

  for (const [key, displayName] of Object.entries(categoryNames)) {
    const items = activity.categories[key as keyof ParsedActivity["categories"]];
    if (items.length > 0) {
      content += `### ${displayName}\n`;
      for (const item of items) {
        content += `- \`${item.relativePath}\` - ${item.action}\n`;
      }
      content += "\n";
    }
  }

  content += `## Integrity Check

- **References Found:** 0 files reference the changed paths
- **References Updated:** 0

## Verification

*Auto-generated from session activity.*

---

**Status:** Auto-generated
`;

  return content;
}

async function writeUpdateFile(activity: ParsedActivity): Promise<string> {
  const title = generateTitle(activity);
  const slug = toKebabCase(title);
  const [year, month] = activity.date.split("-");
  const filename = `${activity.date}_${slug}.md`;

  // Structure: MEMORY/PAISYSTEMUPDATES/YYYY/MM/YYYY-MM-DD_title.md
  const yearMonthDir = path.join(SYSTEM_UPDATES_DIR, year, month);
  const filepath = path.join(yearMonthDir, filename);

  // Ensure directory exists
  if (!fs.existsSync(yearMonthDir)) {
    fs.mkdirSync(yearMonthDir, { recursive: true });
  }

  const content = generateUpdateFile(activity);
  fs.writeFileSync(filepath, content);

  return filepath;
}

// ============================================================================
// CLI
// ============================================================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    session: { type: "string" },
    today: { type: "boolean" },
    generate: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(`
ActivityParser - Parse session activity for PAI repo updates

Usage:
  bun run ActivityParser.ts --today              Parse all today's activity
  bun run ActivityParser.ts --today --generate   Parse and generate update file
  bun run ActivityParser.ts --session <id>       Parse specific session

Output: JSON with categorized changes (or filepath if --generate)
`);
  process.exit(0);
}

// Default to --today if no option specified
const useToday = values.today || (!values.session);
const activity = await parseEvents(values.session);

if (values.generate) {
  const filepath = await writeUpdateFile(activity);
  console.log(JSON.stringify({ filepath, activity }, null, 2));
} else {
  console.log(JSON.stringify(activity, null, 2));
}
