---
name: CommunicationCalibration
description: Interactive deep calibration of AI communication style — cultural context, cognitive processing, and personality trait fine-tuning via a three-layer questionnaire. USE WHEN calibrate communication, communication style, adjust how you communicate, calibrate personality, fine-tune communication, calibrate-communication, review communication style, reset communication style, how do you communicate with me, change communication style, update my communication preferences.
---

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**Send this notification BEFORE doing anything else when this skill is invoked.**

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the CommunicationCalibration skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output text notification:
```
Running the **WorkflowName** workflow in the **CommunicationCalibration** skill to ACTION...
```

## Customization

Check for user overrides at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/CommunicationCalibration/` before running.

## Overview

CommunicationCalibration provides two tiers of communication style configuration:

**Quick (installer):** 5 broad cultural profiles selected during PAI installation.

**Deep (this skill):** A three-layer interactive questionnaire that calibrates communication style across cultural context, cognitive processing preferences, and individual personality traits — without requiring cultural self-identification.

The skill writes calibrated personality traits to `settings.json` and generates/updates `~/.claude/PAI/USER/COMMUNICATIONSTYLE.md`.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Calibrate** | "calibrate communication", "adjust how you communicate", "fine-tune", "calibrate-communication" | `Workflows/Calibrate.md` |
| **Review** | "review communication style", "show my communication settings", "what's my style", "how do you communicate" | `Workflows/Review.md` |
| **Reset** | "reset communication style", "restore default", "reset to profile" | `Workflows/Reset.md` |

## Examples

- "Calibrate your communication style" → Calibrate workflow
- "Review how you communicate with me" → Review workflow
- "Reset my communication style to Nordic/Finnish" → Reset workflow
- "Adjust how you give feedback — I prefer blunt" → Calibrate workflow (Layer 1 focus)
- "I think I need a different communication style configured" → Calibrate workflow
