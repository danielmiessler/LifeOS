#!/usr/bin/env bun

/**
 * BuildCLAUDE.ts — SessionStart hook
 *
 * Checks if CLAUDE.md needs rebuilding (algorithm version changed,
 * DA name changed, unresolved variables). If so, regenerates from template.
 *
 * Current session uses the existing CLAUDE.md (already loaded).
 * Rebuild ensures the NEXT session gets the fresh version.
 */

import { needsRebuild, build } from "../../PAI/Tools/BuildCLAUDE.ts";

const needs = needsRebuild();
if (needs) {
  const result = build();
  if (result.rebuilt) {
    console.error("🔄 CLAUDE.md rebuilt from template (will take effect next session)");
  }
}
