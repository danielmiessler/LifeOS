# Phase 3: Clean up Tools and Skills Templates

## Overview

- **Priority**: High
- **Status**: Complete
- **Target Files**:
  - `PAI/TOOLS/DAInterview.ts`
  - `PAI/TOOLS/DASchedule.ts`
  - `skills/Prompting/Templates/Primitives/Roster.hbs`
  - `skills/Prompting/Templates/Primitives/Voice.hbs` (deleted)
  - `skills/Prompting/Templates/Data/VoicePresets.yaml` (deleted)
  - `skills/Agents/Templates/CUSTOMAGENTTEMPLATE.md`

## Requirements

1. Remove `voice` channel from interview tool options.
2. Change default channel for scheduled jobs to `telegram` and update the help text.
3. Clean up the prompts to remove rendering of ElevenLabs voice settings and delete custom agent presets for voices.

## Implementation Steps

1. Edit `PAI/TOOLS/DAInterview.ts` to exclude the `voice` channel.
2. Edit `PAI/TOOLS/DASchedule.ts` to set default channel to `telegram` and update help output.
3. Delete `skills/Prompting/Templates/Primitives/Voice.hbs`.
4. Delete `skills/Prompting/Templates/Data/VoicePresets.yaml`.
5. Update `skills/Prompting/Templates/Primitives/Roster.hbs` to remove references to the voice template.
6. Edit `skills/Agents/Templates/CUSTOMAGENTTEMPLATE.md` to remove voice profile details and mapping guidelines.
