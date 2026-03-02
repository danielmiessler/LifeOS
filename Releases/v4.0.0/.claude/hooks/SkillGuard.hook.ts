#!/usr/bin/env bun
/**
 * SkillGuard.hook.ts - Block False-Positive Skill Invocations (PreToolUse)
 *
 * PURPOSE:
 * Prevents the well-documented bug where the model falsely invokes
 * keybindings-help (or other position-biased built-in skills) when the
 * user's request has nothing to do with keybindings.
 *
 * ROOT CAUSE:
 * keybindings-help appears FIRST in every skills list injection, combined
 * with the Skill tool's aggressive "BLOCKING REQUIREMENT" language. On
 * ambiguous/short prompts, the model anchors on this first skill.
 * Documented 10+ times across sessions. This hook is the deterministic fix.
 *
 * TRIGGER: PreToolUse (matcher: Skill)
 *
 * INPUT:
 * - stdin: Hook input JSON with tool_input containing Skill parameters
 *   - tool_input.skill: string (skill name being invoked)
 *
 * OUTPUT:
 * - If blocked skill detected: "deny" decision to prevent invocation
 * - If legitimate skill: silent pass (exit 0)
 *
 * BLOCKED SKILLS (position-bias false positives):
 * - keybindings-help: First in list, triggers on virtually anything
 *
 * PERFORMANCE:
 * - Non-blocking for legitimate skills
 * - <5ms execution (pure string match, no I/O)
 */

// Skills that are known to false-positive due to list position bias.
// These get BLOCKED unless explicitly requested via /keybindings-help
const BLOCKED_SKILLS = ['keybindings-help'];

interface HookInput {
  tool_name: string;
  tool_input: {
    skill?: string;
    args?: string;
  };
}

async function readStdin(timeout = 1000): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeout);
    process.stdin.on('data', chunk => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(''); });
  });
}

async function main() {
  try {
    const input = await readStdin();
    if (!input) {
      process.exit(0);
    }

    const data: HookInput = JSON.parse(input);
    const skillName = (data.tool_input?.skill || '').toLowerCase().trim();

    // Check if this is a blocked skill
    if (BLOCKED_SKILLS.includes(skillName)) {
      // Output deny decision as JSON
      const decision = {
        decision: "block",
        reason: `BLOCKED: "${skillName}" is a known false-positive skill triggered by position bias. The user did NOT ask about keybindings. Continue with the ACTUAL task the user requested. If the user genuinely wants keybinding help, they will explicitly say "keybindings" or use /keybindings-help.`
      };
      console.log(JSON.stringify(decision));
      process.exit(0);
    }

    // All other skills pass through
    process.exit(0);
  } catch (err) {
    // On any error, pass silently — don't block skill execution
    process.exit(0);
  }
}

main();
