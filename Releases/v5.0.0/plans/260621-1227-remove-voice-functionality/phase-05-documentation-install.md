# Phase 5: Clean up Documentation and Build Scripts

## Overview

- **Priority**: High
- **Status**: Complete
- **Target Files**:
  - `README.md`
  - `PAI/DOCUMENTATION/PAISystemArchitecture.md`
  - `PAI/DOCUMENTATION/ARCHITECTURE_SUMMARY.md`
  - `PAI/DOCUMENTATION/Notifications/NotificationSystem.md`
  - `install.sh`
  - `ISA.md`

## Requirements

1. Remove mentions of voice notifications, ElevenLabs setup, and audio phase announcements from documentation.
2. Edit `install.sh` to remove ElevenLabs key check/prompting.
3. Update `ISA.md` system criteria (ISC-4 tombstoned, voice references removed from descriptions).

## Implementation Steps

1. Edit `README.md` and `PAI/DOCUMENTATION/PAISystemArchitecture.md` to remove references to voice endpoints.
2. Edit `PAI/DOCUMENTATION/ARCHITECTURE_SUMMARY.md` to rename custom agents heading.
3. Edit `PAI/DOCUMENTATION/Notifications/NotificationSystem.md` to clean up Pulse voice notifications and API routes documentation.
4. Edit `install.sh` comment to remove mention of voice hooks.
5. Update `ISA.md` to tombstone ISC-4, update ISC-18 definition, and clear voice mentions from subsystem descriptions and verification logs.
