# Phase 2: Remove Voice Logic from Pulse (Unified Daemon)

## Overview

- **Priority**: High
- **Status**: Complete
- **Target Files**:
  - `PAI/PULSE/checks/notification-governor.ts`
  - `PAI/PULSE/checks/calendar.ts`
  - `PAI/PULSE/setup.ts`
  - `PAI/PULSE/Observability/observability.ts`

## Requirements

1. Remove voice pings daily limit and quiet hour checks for voice in notification governor.
2. Route status notifications using Telegram and other text-based channels.
3. Clean up voice-events JSONL parsing and `/api/observability/voice-events` endpoint in observability daemon.

## Implementation Steps

1. Edit `PAI/PULSE/checks/notification-governor.ts`:
   - Remove voice daily cap (3) reached logic.
   - Adjust quiet hours check to only affect `telegram`.
   - Update help/status print to remove voice line metrics.
2. Edit `PAI/PULSE/checks/calendar.ts` to document that it routes to text notification.
3. Edit `PAI/PULSE/setup.ts` to remove `voice` channel from candidate outputs.
4. Edit `PAI/PULSE/Observability/observability.ts`:
   - Remove `VOICE_EVENTS_PATH` and logic parsing/tailing it.
   - Remove `/api/observability/voice-events` endpoint handler.
