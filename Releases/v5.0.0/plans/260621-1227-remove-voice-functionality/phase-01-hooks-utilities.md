# Phase 1: Remove Voice Logic from Hooks and Utilities

## Overview

- **Priority**: High
- **Status**: Complete
- **Target Files**:
  - `hooks/lib/identity.ts`
  - `hooks/lib/tab-setter.ts` (if it contains voice references)
  - `hooks/RelationshipMemory.hook.ts` (comments/references check)

## Requirements

1. Remove voice-related types and properties from the Identity model.
2. Deprecate or remove functions loading voice configs.
3. Clean up hook dependencies on voice features.

## Implementation Steps

1. Edit `hooks/lib/identity.ts`:
   - Remove interfaces `VoiceProsody` and `VoicePersonality`.
   - Remove `voice` and `personality` from `Identity` interface.
   - Remove `mainDAVoiceID` from `Identity` and `DEFAULT_IDENTITY`.
   - Remove functions: `getAlgorithmVoice`, `getVoiceProsody`, `getVoicePersonality`.
   - Clean up `getIdentity` to not read `voices` or `voice` or `voiceId`.
2. Compile and verify compile errors in other hooks.
