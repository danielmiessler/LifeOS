# PAI v5.0 — Flow Maps

## FL-01: Algorithm Main Lifecycle [HIGH]

```mermaid
flowchart TD
    U[User Request] --> MC{Mode Classifier}
    MC -->|MINIMAL| A[Direct Answer]
    MC -->|NATIVE| B[Standard Processing]
    MC -->|ALGORITHM| C[Full Algorithm]

    C --> OBSERVE
    OBSERVE --> THINK
    THINK --> PLAN
    PLAN --> BUILD
    BUILD --> EXECUTE
    EXECUTE --> VERIFY
    VERIFY --> LEARN

    LEARN --> Q{More iterations?}
    Q -->|Yes| OBSERVE
    Q -->|No| DONE[Done — Return to User]

    subgraph OBSERVE
        O1[Reverse-engineer request]
        O2[Select effort tier]
        O3[Scaffold ISA]
        O4[Define ISCs]
        O3 --> O4
    end

    subgraph THINK
        T1[Select thinking capabilities]
        T2[Identify risks and unknowns]
        T3[Run premortem]
        T4[Check prerequisites]
    end

    subgraph PLAN
        P1[Design approach]
        P2[Choose depth vs breadth]
        P3[Define features with dependencies]
        P4[Check feasibility]
    end

    subgraph BUILD
        B1[Prepare artifacts]
        B2[Invoke capabilities]
        B3[Create test harness]
    end

    subgraph EXECUTE
        E1[Do the work]
        E2[Execute features in dependency order]
        E3[Mark ISCs as they pass]
    end

    subgraph VERIFY
        V1[Test every ISC]
        V2[Collect evidence]
        V3[Cross-vendor audit at E4/E5]
        V4{All ISCs verified?}
        V4 -->|Pass| LEARN
        V4 -->|Fail| REVISE[Revise ISA → Re-execute]
    end

    subgraph LEARN
        L1[Capture satisfaction signal]
        L2[Record changelog]
        L3[Identify what worked]
        L4[Persist learning to LEARNING tier]
        L5[Reconcile ephemeral files]
    end
```

## FL-02: Skill Invocation Flow [HIGH]

```mermaid
flowchart TD
    ALGO[Algorithm Phase] -->|"Skill('Name', 'action')"| SKILL[Skill Loaded]
    SKILL --> CUST{User customization exists?}
    CUST -->|Yes| LOAD_CUST[Load PREFERENCES.md override]
    CUST -->|No| DEFAULT[Use skill defaults]
    LOAD_CUST --> NOTIFY[Fire voice notification]
    DEFAULT --> NOTIFY
    NOTIFY --> ROUTE[Match action to Workflow Routing Table]
    ROUTE --> WF[Load Workflow file]
    WF --> STEP1[Execute Step 1]
    STEP1 --> STEP2[Execute Step 2]
    STEP2 --> MORE{More steps?}
    MORE -->|Yes| STEP_N[Next step]
    MORE -->|No| LOG[Append to execution log]
    LOG --> RESULT[Return result]
    STEP_N -.->|"Cross-invocation"| OTHER_SKILL[Other skill via Skill()]
    OTHER_SKILL -.-> RESULT
```

## FL-03: Hook Lifecycle Events [HIGH]

```mermaid
flowchart LR
    subgraph Session
        START[SessionStart] --> INSTRUCTIONS[InstructionsLoaded]
        INSTRUCTIONS --> READY[Ready for user input]
    end

    subgraph Interaction
        INPUT[User Input] --> PRE_TOOL{PreToolUse}
        PRE_TOOL -->|Security check| ALLOWED{Allowed?}
        ALLOWED -->|Yes| TOOL_EXEC[Tool executes]
        ALLOWED -->|No| BLOCKED[Operation blocked]
        TOOL_EXEC --> POST_TOOL[PostToolUse]
        POST_TOOL --> MORE_INPUT{More tool calls?}
        MORE_INPUT -->|Yes| PRE_TOOL
        MORE_INPUT -->|No| RESPONSE[Generate response]
    end

    subgraph Lifecycle
        RESPONSE --> COMPACT?{Context compact?}
        COMPACT? -->|Yes| PRECOMPACT[PreCompact hook]
        PRECOMPACT --> CONTINUE[Continue]
        COMPACT? -->|No| CONTINUE
        CONTINUE --> STOP{Session ends?}
        STOP -->|Yes| STOP_HOOK[Stop hook]
        STOP -->|No| MORE_Q{More questions?}
        MORE_Q -->|Yes| QUESTION[QuestionAnswered]
        QUESTION --> PRE_TOOL
        MORE_Q -->|No| STOP_HOOK
    end

    subgraph Background
        FILEWATCH[FileChanged] -.->|Watcher| CONTINUE
        CONFIGAUDIT[ConfigAudited] -.->|On config change| CONTINUE
        INTEGRITY[IntegrityCheck] -.->|Periodic| CONTINUE
    end
```

## FL-04: ISA Lifecycle Through Algorithm [HIGH]

```mermaid
flowchart LR
    subgraph OBSERVE
        SCAFFOLD[Skill: ISA scaffold from prompt]
        CHECK[Skill: ISA check completeness at tier T]
        ISCS[Define ISCs]
    end

    subgraph PLAN
        EXTRACT[Skill: ISA extract feature as ephemeral file]
        FEATURES[Define features with dependency graph]
    end

    subgraph EXECUTE
        PASS[Mark ISCs: ISC-7 = pass]
        PROGRESS[Update progress: 5/12]
    end

    subgraph VERIFY
        VERIFY_ALL[Verify each ISC with evidence]
        V_STATUS{All pass?}
        V_STATUS -->|Yes| LEARN_PHASE
        V_STATUS -->|No| REVISE_PHASE
    end

    subgraph LEARN
        RECONCILE[Skill: ISA reconcile ephemeral→master]
        CHANGELOG[Append changelog entry]
        SATISFACTION[Capture satisfaction]
    end

    SCAFFOLD --> CHECK --> ISCS
    ISCS --> EXTRACT
    EXTRACT --> FEATURES
    FEATURES --> PASS
    PASS --> VERIFY_ALL
    FEATURES -.->|Parallel| EPHEMERAL[Worker on ephemeral file]
    EPHEMERAL -.->|Result| RECONCILE
```

## FL-05: Memory Read Flow [MEDIUM]

```mermaid
flowchart TD
    AGENT[Agent needs context] --> WHAT{What kind?}
    WHAT -->|Current task| READ_WORK[Read MEMORY/WORK/{slug}/ISA.md]
    WHAT -->|Entity knowledge| READ_KNOWLEDGE[Search MEMORY/KNOWLEDGE/]
    WHAT -->|Past patterns| READ_LEARNING[Search MEMORY/LEARNING/]
    WHAT -->|User identity| READ_USER[Read MEMORY/../USER/ files]
    WHAT -->|System config| READ_PAI[Read MEMORY/../PAI/ files]
    WHAT -->|Project context| READ_PROJECT[Read MEMORY/PROJECT/{name}/]

    READ_WORK --> RESULT[Return context]
    READ_KNOWLEDGE --> RESULT
    READ_LEARNING --> RESULT
    READ_USER --> RESULT
    READ_PAI --> RESULT
    READ_PROJECT --> RESULT
```

## FL-06: Skill Customization Lookup [MEDIUM]

```mermaid
flowchart TD
    INVOKE[Skill invoked] --> CHECK{USER/SKILLCUSTOMIZATIONS/<Skill>/ exists?}
    CHECK -->|Yes| LOAD[Load PREFERENCES.md]
    LOAD --> APPLY[Apply overrides]
    CHECK -->|No| DEFAULT[Use skill defaults]
    APPLY --> EXECUTE[Execute workflow]
    DEFAULT --> EXECUTE
    EXECUTE --> CUSTOM_LOG[Append customization used to execution log]
```

## FL-07: Telegram iMessage Message Processing [MEDIUM]

```mermaid
flowchart TD
    MSG[Incoming message] --> AUTH{Is sender authorized?}
    AUTH -->|No| SILENT[Silently drop]
    AUTH -->|Yes| SANITIZE[Sanitize input]
    SANITIZE --> INJECT{Injection detected?}
    INJECT -->|Yes| REJECT[Return error, log warning]
    INJECT -->|No| CONTEXT[Load conversation history]
    CONTEXT --> CLASSIFY{Classify mode}
    CLASSIFY -->|Simple chat| CONVERSATIONAL[Respond conversationally]
    CLASSIFY -->|Task| ALGORITHM[Run Algorithm]
    CONVERSATIONAL --> STREAM[Stream response live]
    ALGORITHM --> STREAM
    STREAM --> DONE[Mark message processed]
```

## FL-08: Secure Release Flow [HIGH]

```mermaid
flowchart TD
    INITIATE[Initiate release] --> STAGE[Stage 1: Stage release]
    STAGE --> GATES[Run 12 security gates]
    GATES --> CLEAN{All gates pass?}
    CLEAN -->|No| FIX[Fix flagged items]
    FIX --> GATES
    CLEAN -->|Yes| ZIP[Package release artifact]
    ZIP --> REVIEW[Stage complete — waiting for human review]
    REVIEW --> APPROVED{Approved?}
    APPROVED -->|Yes| PUBLISH[Stage 2: Publish]
    APPROVED -->|No| DISCARD[Discard staged artifact]
    PUBLISH --> DISTRIBUTE[Deploy release]
```

## FL-09: Pulse Daemon Lifecycle [MEDIUM]

```mermaid
flowchart TD
    START[Pulse starts] --> LOAD_CONFIG[Load PULSE.toml + .env]
    LOAD_CONFIG --> ENV_GUARD[Strip billing keys from environment]
    ENV_GUARD --> INIT[Initialize modules: voice, hooks, wiki, observability]
    INIT --> HTTP[Start HTTP server on port 31337]
    HTTP --> SUPERVISE[Start supervised subsystems: Telegram, iMessage]
    SUPERVISE --> CRON_LOOP[Cron heartbeat loop]
    CRON_LOOP --> CHECK_DUE{Due jobs?}
    CHECK_DUE -->|Yes| EXEC_JOB[Execute job: script or agent]
    EXEC_JOB --> DISPATCH[Dispatch output to targets]
    DISPATCH --> UPDATE_STATE[Write state.json]
    UPDATE_STATE --> SLEEP[Sleep 1-60s]
    SLEEP --> CHECK_DUE
    CHECK_DUE -->|No| SLEEP
    SUPERVISE -.->|Subsystem crash| RESTART[Restart after 10s clean / 30s crash]
```

## FL-10: Skill Invocation Execution Log [MEDIUM]

```mermaid
flowchart TD
    WF_START[Workflow step starts] --> LOG_START[Record: ts, skill, workflow, input]
    LOG_START --> EXEC[Execute action]
    EXEC --> RESULT{Success?}
    RESULT -->|Yes| LOG_OK[Record: status=ok, duration_s]
    RESULT -->|No| LOG_ERR[Record: status=error]
    LOG_OK --> APPEND[Append to execution.jsonl]
    LOG_ERR --> APPEND
```
