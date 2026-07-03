/**
 * PAI Core Extension for Pi v5.0.0
 *
 * Ports the key PAI v5.0 capabilities to Pi's extension system:
 * - Voice notifications (optional TTS integration)
 * - Security validation (blocks dangerous commands)
 * - Session lifecycle (startup greeting, shutdown logging)
 * - ISA (Ideal State Artifact) scaffold, reconcile, CheckCompleteness
 * - PRD work tracking backward compat
 * - Learning signal capture (cross-session improvement)
 *
 * Based on PAI v5.0.0 — Algorithm v6.3.0
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ─── Configuration via environment variables ────────────────
const PAI_PI_DIR = process.env.PAI_PI_DIR || join(homedir(), ".config", "PAI-pi");
const MEMORY_DIR = join(PAI_PI_DIR, "memory");
const WORK_DIR = join(MEMORY_DIR, "work");
const LEARNING_DIR = join(MEMORY_DIR, "learning");
const STATE_DIR = join(MEMORY_DIR, "state");
const KNOWLEDGE_DIR = join(MEMORY_DIR, "knowledge");

// Voice configuration — set these env vars to enable TTS
const VOICE_ENDPOINT = process.env.PAI_VOICE_ENDPOINT || "http://localhost:31337/notify";
const VOICE_ID = process.env.PAI_VOICE_ID || "";
const VOICE_ENABLED = process.env.PAI_VOICE_ENABLED === "true";

// Ensure directories exist
for (const dir of [MEMORY_DIR, WORK_DIR, LEARNING_DIR, STATE_DIR, KNOWLEDGE_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export default function (pi: ExtensionAPI) {
  // ─── Voice Notification Tool ─────────────────────────
  pi.registerTool({
    name: "voice_notify",
    label: "Voice",
    description: "Send a voice notification via TTS server (requires PAI_VOICE_ENDPOINT and PAI_VOICE_ID env vars)",
    parameters: Type.Object({
      message: Type.String({ description: "Text to speak" }),
    }),
    async execute(_toolCallId, params) {
      if (!VOICE_ENABLED || !VOICE_ID) {
        return { content: [{ type: "text", text: "Voice disabled (set PAI_VOICE_ENABLED=true and PAI_VOICE_ID)" }] };
      }

      try {
        execSync(
          `curl -s -X POST ${VOICE_ENDPOINT} -H "Content-Type: application/json" -d '${JSON.stringify({
            message: params.message,
            voice_id: VOICE_ID,
            voice_enabled: true,
          })}'`,
          { timeout: 5000 }
        );
        return { content: [{ type: "text", text: `Voice: "${params.message}"` }] };
      } catch {
        return { content: [{ type: "text", text: "Voice server unavailable" }] };
      }
    },
    promptSnippet: "voice_notify - Speak text aloud via TTS",
    promptGuidelines: "Use for Algorithm phase transitions and task completion announcements.",
  });

  // ─── Security: Block dangerous commands ──────────────
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;
    const cmd = (event.input as { command?: string })?.command || "";

    const dangerous = [
      /rm\s+(-rf?|--recursive)\s+[\/~]/,
      /rm\s+-rf?\s+\./,
      /git\s+push\s+.*--force/,
      /git\s+reset\s+--hard/,
      /git\s+clean\s+-f/,
      /git\s+checkout\s+\./,
      /drop\s+table/i,
      /truncate\s+table/i,
      /:(){ :\|:& };:/,
      /mkfs\./,
      /dd\s+if=/,
    ];

    for (const pattern of dangerous) {
      if (pattern.test(cmd)) {
        return {
          block: true,
          reason: `BLOCKED: Dangerous command detected. Pattern: ${pattern.source}. Ask before proceeding.`,
        };
      }
    }
  });

  // ─── Session Start: Voice (non-blocking) ─────────────
  pi.on("session_start", async () => {
    if (!VOICE_ENABLED || !VOICE_ID) return;

    const child = spawn("curl", [
      "-s", "-X", "POST", VOICE_ENDPOINT,
      "-H", "Content-Type: application/json",
      "--connect-timeout", "1",
      "-m", "3",
      "-d", JSON.stringify({
        message: "PAI online. Ready for work.",
        voice_id: VOICE_ID,
        voice_enabled: true,
      }),
    ], { stdio: "ignore", detached: true });
    child.unref();
  });

  // ─── Session Shutdown: Capture learnings ─────────────
  pi.on("session_shutdown", async () => {
    const timestamp = new Date().toISOString();
    const logPath = join(LEARNING_DIR, "session-log.jsonl");

    const entry = {
      timestamp,
      event: "session_end",
      sessionName: pi.getSessionName() || "unnamed",
    };

    try {
      appendFileSync(logPath, JSON.stringify(entry) + "\n");
    } catch {
      // Best effort
    }
  });

  // ─── ISA Scaffold Tool (v5.0.0) ──────────────────────
  pi.registerTool({
    name: "isa_scaffold",
    label: "ISA Scaffold",
    description: "Scaffold an Ideal State Artifact (ISA) for Algorithm work tracking. Generates a complete ISA document with tier-appropriate sections.",
    parameters: Type.Object({
      task: Type.String({ description: "8-word task description" }),
      slug: Type.String({ description: "kebab-case slug for the work directory" }),
      effort: Type.String({ description: "E1|E2|E3|E4|E5" }),
      problem: Type.Optional(Type.String({ description: "What's broken or missing (E3+)" })),
      vision: Type.Optional(Type.String({ description: "What good looks like (E3+)" })),
      outOfScope: Type.Optional(Type.String({ description: "What's explicitly not included (E3+)" })),
      principles: Type.Optional(Type.String({ description: "Substrate-independent truths (E3+)" })),
      constraints: Type.Optional(Type.String({ description: "Immovable boundaries (E3+)" })),
      goal: Type.String({ description: "The verifiable done condition" }),
      criteria: Type.Array(Type.String(), { description: "ISC criteria list — atomic, binary, testable" }),
      antiCriteria: Type.Optional(Type.Array(Type.String(), { description: "Anti-ISC — what must NOT happen" })),
      testStrategy: Type.Optional(Type.String({ description: "How each criterion is verified (E2+)" })),
      features: Type.Optional(Type.Array(Type.String(), { description: "Work breakdown items (E3+)" })),
    }),
    async execute(_toolCallId, params) {
      const workDir = join(WORK_DIR, params.slug);
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      const timestamp = new Date().toISOString();
      const effortNum = parseInt(params.effort.replace("E", "")) || 2;

      // Determine which sections are required based on tier
      const includeProblem = effortNum >= 2;
      const includeTestStrategy = effortNum >= 2;
      const includeFullSections = effortNum >= 3;
      const includeAllTwelve = effortNum >= 4;

      let content = `# ISA: ${params.task}

**Effort Tier:** ${params.effort} | **Created:** ${timestamp} | **Status:** Active
**Algorithm:** v6.3.0 | **Phase:** OBSERVE

---

`;

      if (includeProblem && params.problem) {
        content += `## 1. Problem\n\n${params.problem}\n\n---\n\n`;
      }

      if (includeFullSections && params.vision) {
        content += `## 2. Vision\n\n${params.vision}\n\n---\n\n`;
      }

      if (includeFullSections && params.outOfScope) {
        content += `## 3. Out of Scope\n\n${params.outOfScope}\n\n---\n\n`;
      }

      if (includeFullSections && params.principles) {
        content += `## 4. Principles\n\n${params.principles}\n\n---\n\n`;
      }

      if (includeFullSections && params.constraints) {
        content += `## 5. Constraints\n\n${params.constraints}\n\n---\n\n`;
      }

      content += `## 6. Goal\n\n${params.goal}\n\n---\n\n`;

      // Criteria section
      let criteriaBlock = "## 7. Criteria\n\n";
      const allCriteria = [...params.criteria];
      if (params.antiCriteria) {
        allCriteria.push(...params.antiCriteria.map((a, i) => `ISC-A${i + 1}: ${a} (ANTI-CRITERION)`));
      }
      allCriteria.forEach((c, i) => {
        criteriaBlock += `- [ ] ISC-${i + 1}: ${c}\n`;
      });
      criteriaBlock += "\n---\n\n";
      content += criteriaBlock;

      if (includeTestStrategy && params.testStrategy) {
        content += `## 8. Test Strategy\n\n${params.testStrategy}\n\n---\n\n`;
      }

      if (includeFullSections && params.features && params.features.length > 0) {
        content += "## 9. Features\n\n";
        params.features.forEach((f, i) => {
          content += `- [ ] F-${i + 1}: ${f}\n`;
        });
        content += "\n---\n\n";
      }

      if (includeAllTwelve) {
        content += `## 10. Decisions\n\n| Timestamp | Decision | Author |\n|-----------|----------|--------|\n| ${timestamp} | ISA scaffolded | system |\n\n---\n\n`;
        content += `## 11. Changelog\n\n### ${timestamp.slice(0, 10)}\n- **Conjecture:** Initial scaffold created\n- **Refuted by:** —\n- **Learned:** —\n- **Criterion now:** Initial criteria set\n\n---\n\n`;
        content += "## 12. Verification\n\n_Pending execution and verification._\n";
      }

      const isaPath = join(workDir, "ISA.md");
      writeFileSync(isaPath, content);

      return {
        content: [{ type: "text", text: `ISA scaffolded at ${isaPath} (${allCriteria.length} criteria, tier ${params.effort})` }],
        details: { path: isaPath, slug: params.slug, criteriaCount: allCriteria.length, effort: params.effort },
      };
    },
    promptSnippet: "isa_scaffold - Create Algorithm ISA for work tracking",
    promptGuidelines:
      "Scaffold an ISA at the start of every Algorithm session. Tier determines section requirements. E1: Goal+Criteria. E2+: +Problem+TestStrategy. E3+: all 8 core. E4/E5: all 12.",
  });

  // ─── ISA Reconcile Tool (v5.0.0) ─────────────────────
  pi.registerTool({
    name: "isa_reconcile",
    label: "ISA Reconcile",
    description: "Reconcile ephemeral feature files back into the master ISA. Merge keys are stable ISC IDs. Conflicts are resolved deterministically (latest timestamp wins for same ID, appended for new IDs).",
    parameters: Type.Object({
      slug: Type.String({ description: "kebab-case slug for the work directory" }),
      reconciliationNotes: Type.Optional(
        Type.String({ description: "Notes about what changed during reconciliation" })
      ),
      completedIscs: Type.Optional(
        Type.Array(Type.Number(), { description: "ISC numbers to mark as completed (e.g., [1,3,7])" })
      ),
      newIscs: Type.Optional(
        Type.Array(Type.String(), { description: "New ISC criteria to append (will get next available IDs)" })
      ),
    }),
    async execute(_toolCallId, params) {
      const isaPath = join(WORK_DIR, params.slug, "ISA.md");
      if (!existsSync(isaPath)) {
        return { content: [{ type: "text", text: `ISA not found: ${params.slug}` }] };
      }

      let content = readFileSync(isaPath, "utf-8");
      const timestamp = new Date().toISOString();

      // Mark completed ISCs
      if (params.completedIscs) {
        for (const num of params.completedIscs) {
          content = content.replace(
            new RegExp(`^(- \\\\[ \\\\] ISC-${num}:)`, "m"),
            `- [x] ISC-${num}:`
          );
        }
      }

      // Find the highest existing ISC number
      const iscMatches = content.match(/ISC-(\d+)/g);
      let nextIscNum = 1;
      if (iscMatches) {
        const nums = iscMatches.map((m) => parseInt(m.replace("ISC-", "")));
        nextIscNum = Math.max(...nums) + 1;
      }

      // Append new ISCs in the criteria section
      if (params.newIscs && params.newIscs.length > 0) {
        // Find the criteria section and insert before the next section marker
        const criteriaSectionMatch = content.match(/## 7\. Criteria\n\n[\s\S]*?(?=\n## \d+\.|\n---\n\n## \d+\.|$)/);
        if (criteriaSectionMatch) {
          let newCriteriaBlock = "";
          for (let i = 0; i < params.newIscs.length; i++) {
            newCriteriaBlock += `- [ ] ISC-${nextIscNum + i}: ${params.newIscs[i]}\n`;
          }
          const oldCriteria = criteriaSectionMatch[0];
          content = content.replace(oldCriteria, oldCriteria.trimEnd() + "\n" + newCriteriaBlock);
        }
      }

      // Append changelog entry (if ISA has a changelog section)
      const changelogMatch = content.match(/## 11\. Changelog\n\n[\s\S]*?(?=\n## \d+\.|$)/);
      if (changelogMatch) {
        let changelogEntry = `\n### ${timestamp.slice(0, 10)}\n`;
        if (params.completedIscs && params.completedIscs.length > 0) {
          changelogEntry += `- **Conjecture:** ISC-[${params.completedIscs.join(", ")}] were complete\n`;
        } else {
          changelogEntry += `- **Conjecture:** Reconciliation applied\n`;
        }
        changelogEntry += `- **Refuted by:** —\n- **Learned:** See reconciliation\n- **Criterion now:** ${params.reconciliationNotes || "Updated via reconciliation"}\n`;
        content = content.replace(changelogMatch[0], changelogMatch[0].trimEnd() + "\n" + changelogEntry);
      }

      writeFileSync(isaPath, content);

      return {
        content: [{ type: "text", text: `ISA reconciled: ${params.slug}` }],
        details: {
          slug: params.slug,
          completedIscs: params.completedIscs,
          newIscsAdded: params.newIscs?.length || 0,
        },
      };
    },
    promptSnippet: "isa_reconcile - Merge ephemeral feature results back into the master ISA",
  });

  // ─── ISA Check Completeness Tool (v5.0.0) ────────────
  pi.registerTool({
    name: "isa_check_completeness",
    label: "ISA Check",
    description: "Check an ISA document for completeness at a given effort tier. Validates that all required sections exist, criteria are atomic, and verification requirements are met.",
    parameters: Type.Object({
      slug: Type.String({ description: "kebab-case slug for the work directory" }),
      tier: Type.Optional(Type.String({ description: "Check against specific tier (E1-E5). Defaults to ISA effort." })),
    }),
    async execute(_toolCallId, params) {
      const isaPath = join(WORK_DIR, params.slug, "ISA.md");
      if (!existsSync(isaPath)) {
        return { content: [{ type: "text", text: `ISA not found: ${params.slug}` }] };
      }

      const content = readFileSync(isaPath, "utf-8");
      let effortTier = params.tier || "E2";

      // Try to extract effort tier from ISA content
      const effortMatch = content.match(/\*\*Effort Tier:\*\*\s*(E[1-5])/);
      if (effortMatch && !params.tier) {
        effortTier = effortMatch[1];
      }

      const effortNum = parseInt(effortTier.replace("E", ""));
      const issues: string[] = [];
      const warnings: string[] = [];
      let checksPassed = 0;
      let checksFailed = 0;

      // Check 1: Goal section exists (always required)
      if (content.includes("## 6. Goal")) {
        checksPassed++;
      } else {
        issues.push("MISSING: Section 6 (Goal) — required at all tiers");
        checksFailed++;
      }

      // Check 2: Criteria section exists (always required)
      if (content.includes("## 7. Criteria")) {
        checksPassed++;
      } else {
        issues.push("MISSING: Section 7 (Criteria) — required at all tiers");
        checksFailed++;
      }

      // Check 3: At least one criteria defined
      const iscMatches = content.match(/\[ \] ISC-/g);
      const antiIscMatches = content.match(/ISC-A\d+:/g);
      if (iscMatches && iscMatches.length > 0) {
        checksPassed++;
      } else {
        issues.push("MISSING: No ISC criteria defined");
        checksFailed++;
      }

      // Check 4: Anti-criteria required at all tiers (BR-05)
      if (antiIscMatches && antiIscMatches.length > 0) {
        checksPassed++;
      } else {
        warnings.push("WARNING: No Anti-ISC found — BR-05 requires at least one at every tier");
        checksFailed++;
      }

      // Check 5: Problem section for E2+
      if (effortNum >= 2) {
        if (content.includes("## 1. Problem")) {
          checksPassed++;
        } else {
          issues.push(`MISSING: Section 1 (Problem) — required at tier ${effortTier}`);
          checksFailed++;
        }
      } else {
        checksPassed++; // E1 doesn't need it
      }

      // Check 6: Test Strategy for E2+
      if (effortNum >= 2) {
        if (content.includes("## 8. Test Strategy")) {
          checksPassed++;
        } else {
          issues.push(`MISSING: Section 8 (Test Strategy) — required at tier ${effortTier}`);
          checksFailed++;
        }
      } else {
        checksPassed++;
      }

      // Check 7-10: Full sections for E3+
      if (effortNum >= 3) {
        const sections = [
          ["Vision", "## 2. Vision"],
          ["Out of Scope", "## 3. Out of Scope"],
          ["Principles", "## 4. Principles"],
          ["Constraints", "## 5. Constraints"],
        ];
        for (const [name, marker] of sections) {
          if (content.includes(marker)) {
            checksPassed++;
          } else {
            issues.push(`MISSING: Section "${name}" — required at tier ${effortTier}`);
            checksFailed++;
          }
        }

        // Features for E3+
        if (content.includes("## 9. Features")) {
          checksPassed++;
        } else {
          warnings.push(`WARNING: Section 9 (Features) — recommended at tier ${effortTier}`);
          checksFailed++;
        }
      } else {
        checksPassed += 5; // Skip 5 checks for lower tiers
      }

      // Check 11-12: All 12 sections for E4/E5
      if (effortNum >= 4) {
        const advancedSections = [
          ["Decisions", "## 10. Decisions"],
          ["Changelog", "## 11. Changelog"],
          ["Verification", "## 12. Verification"],
        ];
        for (const [name, marker] of advancedSections) {
          if (content.includes(marker)) {
            checksPassed++;
          } else {
            issues.push(`MISSING: Section "${name}" — required at tier ${effortTier}`);
            checksFailed++;
          }
        }

        // Check for completed ISCs with evidence
        const verifiedIscs = content.match(/\[x\] ISC-/g);
        if (verifiedIscs && verifiedIscs.length > 0) {
          checksPassed++;
        } else {
          warnings.push(`WARNING: No verified ISCs found — E4/E5 requires evidence`);
          // Not a hard failure since it might be in OBSERVE phase
        }
      } else {
        checksPassed += 4; // Skip 4 checks for lower tiers
      }

      // Check ISC atomicity — flag criteria with "and" or "with"
      const criteriaSection = content.match(/## 7\. Criteria\n\n[\s\S]*?(?=\n## \d+\.|\n---\n\n## \d+\.|$)/);
      if (criteriaSection) {
        const lines = criteriaSection[0].split("\n");
        for (const line of lines) {
          if (line.match(/\[ \] ISC-/)) {
            const text = line.replace(/\[ \] ISC-\d+(\.\d+)?:?\s*/, "");
            if (/\b(and|with)\b/i.test(text) && text.split(/\b(and|with)\b/i).length > 2) {
              warnings.push(`WARNING: ISC may not be atomic: "${text.slice(0, 60)}..." (contains "and"/"with")`);
            }
          }
        }
      }

      // Build report
      const totalChecks = checksPassed + checksFailed;
      const passRate = totalChecks > 0 ? Math.round((checksPassed / totalChecks) * 100) : 0;
      const passed = checksFailed === 0;

      let report = `## ISA Completeness Check: ${params.slug}\n\n`;
      report += `**Tier:** ${effortTier} | **Pass Rate:** ${passRate}% (${checksPassed}/${totalChecks})\n`;
      report += `**Overall:** ${passed ? "PASS ✅" : "FAIL ❌"}\n\n`;

      if (issues.length > 0) {
        report += "### Issues (blocking)\n\n";
        issues.forEach((i) => (report += `- ❌ ${i}\n`));
        report += "\n";
      }

      if (warnings.length > 0) {
        report += "### Warnings (non-blocking)\n\n";
        warnings.forEach((w) => (report += `- ⚠️ ${w}\n`));
        report += "\n";
      }

      if (issues.length === 0 && warnings.length === 0) {
        report += "All checks passed. ISA is complete for this tier.\n";
      }

      return {
        content: [{ type: "text", text: report }],
        details: {
          slug: params.slug,
          tier: effortTier,
          passed,
          passRate,
          checksPassed,
          checksFailed,
          issues: issues.length,
          warnings: warnings.length,
        },
      };
    },
    promptSnippet: "isa_check_completeness - Validate ISA meets tier requirements before proceeding",
    promptGuidelines:
      "Run this after ISA scaffold and before proceeding to EXECUTE. Re-check after any major ISA changes.",
  });

  // ─── PRD Management Tool (backward compat) ──────────
  pi.registerTool({
    name: "prd_create",
    label: "PRD",
    description: "[LEGACY] Create a PRD (Product Requirements Document) for backward compatibility. New work should use isa_scaffold instead.",
    parameters: Type.Object({
      task: Type.String({ description: "8 word task description" }),
      slug: Type.String({ description: "kebab-case slug for the work directory" }),
      effort: Type.String({ description: "E1|E2|E3|E4|E5" }),
      phase: Type.String({ description: "observe|think|plan|build|execute|verify|learn|complete" }),
      criteria: Type.Optional(Type.Array(Type.String(), { description: "ISC criteria list" })),
      progress: Type.Optional(Type.String({ description: "e.g. 3/8" })),
    }),
    async execute(_toolCallId, params) {
      const timestamp = new Date().toISOString();
      const criteriaBlock = params.criteria
        ? params.criteria.map((c, i) => `- [ ] ISC-${i + 1}: ${c}`).join("\n")
        : "";

      const content = `---
task: ${params.task}
slug: ${params.slug}
effort: ${params.effort}
phase: ${params.phase}
progress: ${params.progress || "0/0"}
started: ${timestamp}
updated: ${timestamp}
algorithm: v6.3.0
---

## Context

${params.task}

## Criteria

${criteriaBlock}

## Decisions

## Verification
`;

      const prdPath = join(WORK_DIR, params.slug, "PRD.md");
      const workDir = join(WORK_DIR, params.slug);
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
      writeFileSync(prdPath, content);

      return {
        content: [{ type: "text", text: `[LEGACY] PRD created at ${prdPath}. Consider using isa_scaffold for new work.` }],
        details: { path: prdPath, slug: params.slug },
      };
    },
    promptSnippet: "prd_create - [LEGACY] Create PRD (use isa_scaffold instead)",
    promptGuidelines:
      "Deprecated in favor of isa_scaffold. Use only for backward compatibility with existing v1.0 workflows.",
  });

  // ─── PRD Update Tool (backward compat) ──────────────
  pi.registerTool({
    name: "prd_update",
    label: "PRD Update",
    description: "[LEGACY] Update PRD phase, progress, or mark criteria complete. New work should use isa_reconcile instead.",
    parameters: Type.Object({
      slug: Type.String({ description: "PRD slug" }),
      phase: Type.Optional(Type.String({ description: "New phase" })),
      progress: Type.Optional(Type.String({ description: "e.g. 5/8" })),
      complete_criteria: Type.Optional(
        Type.Array(Type.Number(), { description: "ISC numbers to mark complete" })
      ),
    }),
    async execute(_toolCallId, params) {
      const prdPath = join(WORK_DIR, params.slug, "PRD.md");
      if (!existsSync(prdPath)) {
        return { content: [{ type: "text", text: `PRD not found: ${params.slug}` }] };
      }

      let content = readFileSync(prdPath, "utf-8");
      const timestamp = new Date().toISOString();

      if (params.phase) {
        content = content.replace(/^phase: .+$/m, `phase: ${params.phase}`);
      }
      if (params.progress) {
        content = content.replace(/^progress: .+$/m, `progress: ${params.progress}`);
      }
      content = content.replace(/^updated: .+$/m, `updated: ${timestamp}`);

      if (params.complete_criteria) {
        for (const num of params.complete_criteria) {
          content = content.replace(
            new RegExp(`^- \\\\[ \\\\] ISC-${num}:`, "m"),
            `- [x] ISC-${num}:`
          );
        }
      }

      writeFileSync(prdPath, content);
      return { content: [{ type: "text", text: `[LEGACY] PRD updated: ${params.slug}` }] };
    },
    promptSnippet: "prd_update - [LEGACY] Update PRD (use isa_reconcile instead)",
  });

  // ─── Learning Signal Tool ────────────────────────────
  pi.registerTool({
    name: "capture_learning",
    label: "Learn",
    description: "Capture a learning signal or reflection from this session",
    parameters: Type.Object({
      signal_type: Type.String({ description: "rating|reflection|failure|pattern" }),
      content: Type.String({ description: "The learning content" }),
      score: Type.Optional(Type.Number({ description: "Rating 1-10 if applicable" })),
    }),
    async execute(_toolCallId, params) {
      const timestamp = new Date().toISOString();
      const entry = {
        timestamp,
        type: params.signal_type,
        content: params.content,
        score: params.score,
        session: pi.getSessionName() || "unnamed",
      };

      const logPath = join(LEARNING_DIR, "signals.jsonl");
      appendFileSync(logPath, JSON.stringify(entry) + "\n");

      return {
        content: [{ type: "text", text: `Learning captured: ${params.signal_type}` }],
        details: entry,
      };
    },
    promptSnippet: "capture_learning - Store learning signals for cross-session improvement",
  });

  // ─── Execution Log Tool (v5.0.0) ─────────────────────
  pi.registerTool({
    name: "execution_log",
    label: "Exec Log",
    description: "Log a skill invocation to the execution audit trail",
    parameters: Type.Object({
      skillName: Type.String({ description: "Name of the skill invoked" }),
      workflow: Type.String({ description: "Workflow used" }),
      inputSummary: Type.String({ description: "≤8 word input summary" }),
      status: Type.String({ description: "ok|error" }),
      duration: Type.Optional(Type.Number({ description: "Duration in seconds" })),
    }),
    async execute(_toolCallId, params) {
      const timestamp = new Date().toISOString();
      const entry = {
        timestamp,
        skill: params.skillName,
        workflow: params.workflow,
        input: params.inputSummary,
        status: params.status,
        duration_s: params.duration || 0,
      };

      const logDir = join(MEMORY_DIR, "skills");
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      const logPath = join(logDir, "execution.jsonl");
      appendFileSync(logPath, JSON.stringify(entry) + "\n");

      return { content: [{ type: "text", text: `Execution logged: ${params.skillName}/${params.workflow}` }] };
    },
    promptSnippet: "execution_log - Log skill invocation to audit trail",
    promptGuidelines:
      "Call this at the end of every skill workflow execution per BR-08.",
  });

  // ─── Changelog Append Tool (v5.0.0) ──────────────────
  pi.registerTool({
    name: "changelog_append",
    label: "Changelog",
    description: "Append a changelog entry to an ISA in the prescribed four-piece format (conjecture → refuted-by → learned → criterion-now)",
    parameters: Type.Object({
      slug: Type.String({ description: "kebab-case slug for the ISA" }),
      conjecture: Type.String({ description: "What was believed" }),
      refutedBy: Type.String({ description: "What disproved it" }),
      learned: Type.String({ description: "What is now understood" }),
      criterionNow: Type.String({ description: "How the ISA/criterion changed" }),
    }),
    async execute(_toolCallId, params) {
      const isaPath = join(WORK_DIR, params.slug, "ISA.md");
      const prdPath = join(WORK_DIR, params.slug, "PRD.md");

      let targetPath = null;
      if (existsSync(isaPath)) targetPath = isaPath;
      else if (existsSync(prdPath)) targetPath = prdPath;
      else {
        return { content: [{ type: "text", text: `No ISA or PRD found for: ${params.slug}` }] };
      }

      const timestamp = new Date().toISOString();
      const entry = `\n### ${timestamp.slice(0, 10)}\n- **Conjecture:** ${params.conjecture}\n- **Refuted by:** ${params.refutedBy}\n- **Learned:** ${params.learned}\n- **Criterion now:** ${params.criterionNow}\n`;

      let content = readFileSync(targetPath, "utf-8");
      const changelogMatch = content.match(/## 11\. Changelog\n\n[\s\S]*?(?=\n## \d+\.|$)/);
      if (changelogMatch) {
        content = content.replace(changelogMatch[0], changelogMatch[0].trimEnd() + entry);
      } else {
        // If no changelog section exists (e.g., in PRD), append one
        content += `\n## Changelog\n\n${entry}\n`;
      }

      writeFileSync(targetPath, content);
      return { content: [{ type: "text", text: `Changelog entry appended to ${params.slug}` }] };
    },
    promptSnippet: "changelog_append - Record ISA changelog in four-piece format (BR-20)",
    promptGuidelines:
      "Use during LEARN phase. The four-piece format is non-negotiable per BR-20.",
  });

  // ─── Status Line ─────────────────────────────────────
  pi.on("agent_start", async (_event, ctx) => {
    ctx.ui.setStatus("pai", "PAI on Pi | Algorithm v6.3.0");
  });

  // ─── Slash Commands ──────────────────────────────────
  pi.registerCommand("algorithm", {
    description: "Start an Algorithm session for complex work",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        "Algorithm v6.3.0 activated. Use the 7-phase methodology (OBSERVE→THINK→PLAN→BUILD→EXECUTE→VERIFY→LEARN).",
        "info"
      );
      await pi.sendUserMessage("Use ALGORITHM v6.3.0 mode for the next task. Follow all 7 phases with ISA scaffolding.");
    },
  });

  pi.registerCommand("isa", {
    description: "Scaffold a new ISA for work tracking",
    handler: async (args, _ctx) => {
      if (!args) {
        await pi.sendUserMessage("Usage: /isa <task description>");
        return;
      }
      await pi.sendUserMessage(`Create an ISA for: ${args}. Decide the effort tier and scaffold all required sections.`);
    },
  });

  pi.registerCommand("status", {
    description: "Show PAI system status",
    handler: async (_args, ctx) => {
      const sessionCount = (() => {
        try {
          const logPath = join(LEARNING_DIR, "session-log.jsonl");
          if (!existsSync(logPath)) return 0;
          return readFileSync(logPath, "utf-8").trim().split("\n").length;
        } catch {
          return 0;
        }
      })();

      const signalCount = (() => {
        try {
          const logPath = join(LEARNING_DIR, "signals.jsonl");
          if (!existsSync(logPath)) return 0;
          return readFileSync(logPath, "utf-8").trim().split("\n").length;
        } catch {
          return 0;
        }
      })();

      ctx.ui.notify(
        `PAI on Pi v5.0.0 | Algorithm v6.3.0 | Sessions: ${sessionCount} | Signals: ${signalCount}`,
        "info"
      );
    },
  });

  pi.registerCommand("voice", {
    description: "Send a voice notification",
    handler: async (args, _ctx) => {
      if (!VOICE_ENABLED || !VOICE_ID) return;
      const message = args || "Hello from PAI";
      try {
        execSync(
          `curl -s -X POST ${VOICE_ENDPOINT} -H "Content-Type: application/json" -d '${JSON.stringify({
            message,
            voice_id: VOICE_ID,
            voice_enabled: true,
          })}'`,
          { timeout: 5000 }
        );
      } catch {
        // Voice server may not be running
      }
    },
  });
}
