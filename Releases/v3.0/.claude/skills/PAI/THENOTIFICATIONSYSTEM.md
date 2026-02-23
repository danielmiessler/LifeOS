# The Notification System

**Voice notifications for PAI workflows and task execution.**

This system provides:
- Voice feedback when workflows start
- Consistent user experience across all skills

---

## Task Start Announcements

**When STARTING a task, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "[Doing what {PRINCIPAL.NAME} asked]"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   [Doing what {PRINCIPAL.NAME} asked]...
   ```

**Skip curl for conversational responses** (greetings, acknowledgments, simple Q&A). The 🎯 COMPLETED line already drives voice output—adding curl creates redundant voice messages.

---

## Context-Aware Announcements

**Match your announcement to what {PRINCIPAL.NAME} asked.** Start with the appropriate gerund:

| {PRINCIPAL.NAME}'s Request | Announcement Style |
|------------------|-------------------|
| Question ("Where is...", "What does...") | "Checking...", "Looking up...", "Finding..." |
| Command ("Fix this", "Create that") | "Fixing...", "Creating...", "Updating..." |
| Investigation ("Why isn't...", "Debug this") | "Investigating...", "Debugging...", "Analyzing..." |
| Research ("Find out about...", "Look into...") | "Researching...", "Exploring...", "Looking into..." |

**Examples:**
- "Where's the config file?" → "Checking the project for config files..."
- "Fix this bug" → "Fixing the null pointer in auth handler..."
- "Why isn't the API responding?" → "Investigating the API connection..."
- "Create a new component" → "Creating the new component..."

---

## Workflow Invocation Notifications

**For skills with `Workflows/` directories, use "Executing..." format:**

```
Executing the **WorkflowName** workflow within the **SkillName** skill...
```

**Examples:**
- "Executing the **GIT** workflow within the **CORE** skill..."
- "Executing the **Publish** workflow within the **Blogging** skill..."

**NEVER announce fake workflows:**
- "Executing the file organization workflow..." - NO SUCH WORKFLOW EXISTS
- If it's not listed in a skill's Workflow Routing, DON'T use "Executing" format
- For non-workflow tasks, use context-appropriate gerund

### The curl Pattern (Workflow-Based Skills Only)

When executing an actual workflow file from a `Workflows/` directory:

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the SKILLNAME skill to ACTION", "voice_id": "{DAIDENTITY.VOICEID}", "title": "{DAIDENTITY.NAME}"}' \
  > /dev/null 2>&1 &
```

**Parameters:**
- `message` - The spoken text (workflow and skill name)
- `voice_id` - ElevenLabs voice ID (default: {DAIDENTITY.NAME}'s voice)
- `title` - Display name for the notification

---

## Effort Level in Voice Notifications

**Automatic:** THE ALGORITHM tasks automatically include effort level in voice:

| Event | Hook | Voice Format |
|-------|------|--------------|
| Task Start | `TaskNotifier.ts` | "Running THE ALGORITHM at **thorough** effort **with multi-agent analysis** to [summary]" |
| Phase Transition | `AlgorithmPhaseNotifier.ts` | "Entering observe phase - gathering context at **thorough** effort" |
| Task Completion | `PAICompletion.ts` | "[COMPLETED line content]" |

**Effort levels (Algorithm v1.1.0):**

| Effort | Budget | Spoken |
|--------|--------|--------|
| Instant | <10s | (none — no voice curls) |
| Fast | <1min | (none — no voice curls) |
| Standard | <2min | OBSERVE + VERIFY curls only |
| Extended | <8min | All phase curls |
| Advanced | <16min | All phase curls |
| Deep | <32min | All phase curls |
| Comprehensive | <120min | All phase curls |
| Loop | Unbounded | All phase curls (first iteration) |

**Example voice messages:**
- Standard: Algorithm entry + VERIFY only (2 curls)
- Extended+: Full 7-phase voice announcements

**Voice curls are the phase announcements in the Algorithm template** — each phase has a `curl -s -X POST http://localhost:8888/notify` call that gets spoken. The effort level gates which curls fire, but all phases always execute.

---

## Voice IDs

| Agent | Voice ID | Notes |
|-------|----------|-------|
| **{DAIDENTITY.NAME}** (default) | `{DAIDENTITY.VOICEID}` | Use for most workflows |
| **Priya** (Artist) | `ZF6FPAbjXT4488VcRRnw` | Art skill workflows |

**Full voice registry:** `~/.claude/skills/Agents/SKILL.md` (see Named Agents and voice configuration)

---

## Copy-Paste Templates

### Template A: Skills WITH Workflows

For skills that have a `Workflows/` directory:

```markdown
## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the SKILLNAME skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **SkillName** skill to ACTION...
   ```
```

Replace `WORKFLOWNAME`, `SKILLNAME`, and `ACTION` with actual values when executing. ACTION should be under 6 words describing what the workflow does.

### Template B: Skills WITHOUT Workflows

For skills that handle requests directly (no `Workflows/` directory), **do NOT include a Voice Notification section**. These skills just describe what they're doing naturally in their responses.

If you need to indicate this explicitly:

```markdown
## Task Handling

This skill handles requests directly without workflows. When executing, simply describe what you're doing:
- "Let me [action]..."
- "I'll [action]..."
```

---

## Why Direct curl (Not Shell Script)

Direct curl is:
- **More reliable** - No script execution dependencies
- **Faster** - No shell script overhead
- **Visible** - The command is explicit in the skill file
- **Debuggable** - Easy to test in isolation

The backgrounded `&` and redirected output (`> /dev/null 2>&1`) ensure the curl doesn't block workflow execution.

---

## When to Skip Notifications

**Always skip notifications when:**
- **Conversational responses** - Greetings, acknowledgments, simple Q&A
- **Skill has no workflows** - The skill has no `Workflows/` directory
- **Direct skill handling** - SKILL.md handles request without invoking a workflow file
- **Quick utility operations** - Simple file reads, status checks
- **Sub-workflows** - When a workflow calls another workflow (avoid double notification)

**The rule:** Only notify when actually loading and following a `.md` file from a `Workflows/` directory, or when starting significant task work.

---

## External Notifications (Push, Discord)

**Beyond voice notifications, PAI supports external notification channels:**

### Available Channels

| Channel | Service | Purpose | Configuration |
|---------|---------|---------|---------------|
| **ntfy** | ntfy.sh | Mobile push notifications | `settings.json → notifications.ntfy` |
| **Discord** | Webhook | Team/server notifications | `settings.json → notifications.discord` |
| **Desktop** | macOS native | Local desktop alerts | Always available |

### Smart Routing

Notifications are automatically routed based on event type:

| Event | Default Channels | Trigger |
|-------|------------------|---------|
| `taskComplete` | Voice only | Normal task completion |
| `longTask` | Voice + ntfy | Task duration > 5 minutes |
| `backgroundAgent` | ntfy | Background agent completes |
| `error` | Voice + ntfy | Error in response |
| `security` | Voice + ntfy + Discord | Security alert |

### Configuration

Located in `~/.claude/settings.json`:

```json
{
  "notifications": {
    "ntfy": {
      "enabled": true,
      "topic": "kai-[random-topic]",
      "server": "ntfy.sh"
    },
    "discord": {
      "enabled": false,
      "webhook": "https://discord.com/api/webhooks/..."
    },
    "thresholds": {
      "longTaskMinutes": 5
    },
    "routing": {
      "taskComplete": [],
      "longTask": ["ntfy"],
      "backgroundAgent": ["ntfy"],
      "error": ["ntfy"],
      "security": ["ntfy", "discord"]
    }
  }
}
```

### ntfy.sh Setup

1. **Generate topic**: `echo "kai-$(openssl rand -hex 8)"`
2. **Install app**: iOS App Store or Android Play Store → "ntfy"
3. **Subscribe**: Add your topic in the app
4. **Test**: `curl -d "Test" ntfy.sh/your-topic`

Topic name acts as password - use random string for security.

### Discord Setup

1. Create webhook in your Discord server
2. Add webhook URL to `settings.json`
3. Set `discord.enabled: true`

### SMS (Not Recommended)

**SMS is impractical for personal notifications.** US carriers require A2P 10DLC campaign registration since Dec 2024, which involves:
- Brand registration + verification (weeks)
- Campaign approval + monthly fees
- Carrier bureaucracy for each number

**Alternatives researched (Jan 2025):**

| Option | Status | Notes |
|--------|--------|-------|
| **ntfy.sh** | ✅ RECOMMENDED | Same result (phone alert), zero hassle |
| **Textbelt** | ❌ Blocked | Free tier disabled for US due to abuse |
| **AppleScript + Messages.app** | ⚠️ Requires permissions | Works if you grant automation access |
| **Twilio Toll-Free** | ⚠️ Simpler | 5-14 day verification (vs 3-5 weeks for 10DLC) |
| **Email-to-SMS** | ⚠️ Carrier-dependent | `number@vtext.com` (Verizon), `@txt.att.net` (AT&T) |

**Bottom line:** ntfy.sh already alerts your phone. SMS adds carrier bureaucracy for the same outcome.

### Implementation

The notification service is in `~/.claude/hooks/lib/notifications.ts`:

```typescript
import { notify, notifyTaskComplete, notifyBackgroundAgent, notifyError } from './lib/notifications';

// Smart routing based on task duration
await notifyTaskComplete("Task completed successfully");

// Explicit background agent notification
await notifyBackgroundAgent("Researcher", "Found 5 relevant articles");

// Error notification
await notifyError("Database connection failed");

// Direct channel access
await sendPush("Message", { title: "Title", priority: "high" });
await sendDiscord("Message", { title: "Title", color: 0x00ff00 });
```

### Design Principles

1. **Fire and forget** - Notifications never block hook execution
2. **Fail gracefully** - Missing services don't cause errors
3. **Conservative defaults** - Avoid notification fatigue
4. **Duration-aware** - Only push for long-running tasks (>5 min)
