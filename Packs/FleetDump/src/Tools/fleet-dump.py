#!/usr/bin/env python3
"""
fleet-dump — Daily fleet activity summary for the external governor (Gemini).

Collects activity from all available sources and writes a dated markdown
file to G: Drive for Gemini to read.

Sources:
  1. Git log (PAI repo — today's commits)
  2. Fleet dispatches (NorthwoodsSentinel/fleet_messages)
  3. Work directories (new/updated PRDs)
  4. Memory changes (new/modified memory files)
  5. Flinch log (any new entries)
  6. Inbox activity (files moved in/out)

Output: /mnt/g/My Drive/fleet-dumps/YYYY-MM-DD.md

Usage:
  fleet-dump              — dump today's activity
  fleet-dump --yesterday  — dump yesterday's activity
  fleet-dump --date 2026-03-14  — dump specific date

Designed to run via cron at end of day.
"""

from __future__ import annotations
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

GDRIVE = Path("/mnt/g/My Drive")
DUMP_DIR = GDRIVE / "fleet-dumps"
PAI_ROOT = Path("/root/.claude")
MEMORY_DIR = PAI_ROOT / "projects/-root--claude/memory"
WORK_DIR = MEMORY_DIR / "WORK"

# GitHub repos to monitor (org/repo)
GITHUB_REPOS = [
    "NorthwoodsSentinel/fleet_messages",
    "NorthwoodsSentinel/burn-it-down-grow-it-back",
    "NorthwoodsSentinel/mvOS",
]

def run(cmd: str, cwd: str | None = None) -> str:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=cwd)
        return r.stdout.strip()
    except Exception as e:
        return f"(error: {e})"

def get_date() -> str:
    if "--yesterday" in sys.argv:
        return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    if "--date" in sys.argv:
        idx = sys.argv.index("--date")
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    return datetime.now().strftime("%Y-%m-%d")

def git_activity(date: str) -> str:
    """Today's commits in PAI repo."""
    log = run(f'git log --oneline --after="{date} 00:00" --before="{date} 23:59" --all', cwd=str(PAI_ROOT))
    return log if log else "(no commits)"

def fleet_dispatches(date: str) -> str:
    """Check for fleet dispatches matching date."""
    dispatch_dir = Path("/tmp/fleet_messages/dispatches")
    if not dispatch_dir.exists():
        # Try cloning fresh
        run("cd /tmp && rm -rf fleet_messages && git clone --depth 1 https://github.com/NorthwoodsSentinel/fleet_messages.git 2>/dev/null")
    else:
        run("git pull --quiet", cwd="/tmp/fleet_messages")

    if not dispatch_dir.exists():
        return "(fleet_messages repo unavailable)"

    matches = []
    for f in sorted(dispatch_dir.glob("*.md")):
        if date in f.name:
            matches.append(f"- {f.name}")
    return "\n".join(matches) if matches else "(no dispatches)"

def work_activity(date: str) -> str:
    """New or modified PRDs."""
    if not WORK_DIR.exists():
        return "(no WORK directory)"
    results = []
    for prd in WORK_DIR.glob("*/PRD.md"):
        stat = prd.stat()
        mod_date = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d")
        if mod_date == date:
            slug = prd.parent.name
            results.append(f"- {slug}/PRD.md (modified)")
    return "\n".join(results) if results else "(no PRD changes)"

def memory_activity(date: str) -> str:
    """New or modified memory files."""
    if not MEMORY_DIR.exists():
        return "(no memory directory)"
    results = []
    for md in MEMORY_DIR.glob("*.md"):
        if md.name == "MEMORY.md":
            continue
        stat = md.stat()
        mod_date = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d")
        if mod_date == date:
            results.append(f"- {md.name}")
    return "\n".join(results) if results else "(no memory changes)"

def flinch_check() -> str:
    """Current unresolved flinch entries."""
    flinch = MEMORY_DIR / "flinch-log.md"
    if not flinch.exists():
        return "(no flinch log)"
    content = flinch.read_text()
    # Count unresolved entries
    unresolved = [l for l in content.splitlines() if l.strip().startswith("- [") and "[ ]" in l]
    if unresolved:
        return f"{len(unresolved)} unresolved:\n" + "\n".join(unresolved[:5])
    return "(all clear)"

def github_activity(date: str) -> str:
    """Cross-repo GitHub activity — commits, PRs, issues."""
    results = []
    total_commits = 0
    total_additions = 0
    total_deletions = 0

    for repo in GITHUB_REPOS:
        # Get commits for this date
        commits_json = run(
            f'gh api "repos/{repo}/commits?since={date}T00:00:00Z&until={date}T23:59:59Z" '
            f'--jq \'[.[] | {{sha: .sha[:7], message: .commit.message | split("\\n")[0], '
            f'author: .commit.author.name, time: .commit.author.date}}] | length\''
        )
        commit_count = 0
        try:
            commit_count = int(commits_json) if commits_json.isdigit() else 0
        except (ValueError, AttributeError):
            pass

        if commit_count > 0:
            total_commits += commit_count
            # Get commit details
            details = run(
                f'gh api "repos/{repo}/commits?since={date}T00:00:00Z&until={date}T23:59:59Z" '
                f'--jq \'.[] | "  - " + (.sha[:7]) + " " + (.commit.message | split("\\n")[0])\''
            )
            # Get stats for the day
            stats = run(
                f'gh api "repos/{repo}/commits?since={date}T00:00:00Z&until={date}T23:59:59Z" '
                f'--jq \'.[].sha\''
            )
            for sha in (stats.splitlines() if stats else []):
                sha = sha.strip()
                if sha:
                    stat_line = run(
                        f'gh api "repos/{repo}/commits/{sha}" '
                        f'--jq \'(.stats.additions | tostring) + "+" + (.stats.deletions | tostring) + "-"\''
                    )
                    if "+" in stat_line and "-" in stat_line:
                        try:
                            parts = stat_line.replace("-", "").split("+")
                            total_additions += int(parts[0])
                            total_deletions += int(parts[1])
                        except (ValueError, IndexError):
                            pass

            repo_short = repo.split("/")[1]
            results.append(f"**{repo_short}** — {commit_count} commit(s)")
            if details:
                results.append(details)

    if not results:
        return "(no GitHub activity)"

    summary = "\n".join(results)
    summary += f"\n\n**Totals:** {total_commits} commits, +{total_additions}/-{total_deletions} lines"

    # Pace flags
    flags = []
    if total_commits > 10:
        flags.append(f"⚠️ HIGH COMMIT VOLUME: {total_commits} commits in one day")
    if total_additions > 1000:
        flags.append(f"⚠️ LARGE CODE VOLUME: +{total_additions} lines added")
    if total_deletions > 500:
        flags.append(f"⚠️ LARGE DELETION: -{total_deletions} lines removed — check if intentional")
    if total_commits > 0:
        # Check for late-night commits
        late = run(
            f'gh api "repos/{GITHUB_REPOS[0].split("/")[0]}/events" '
            f'--jq \'[.[] | select(.type == "PushEvent") | .created_at] | .[:5]\''
        )
        # Simple heuristic — if we have commits, note the date for manual time check
        pass

    if flags:
        summary += "\n\n" + "\n".join(flags)

    return summary


def session_hours_estimate(date: str) -> str:
    """Rough estimate based on git commit timestamps."""
    timestamps = run(
        f'git log --format="%aI" --after="{date} 00:00" --before="{date} 23:59" --all',
        cwd=str(PAI_ROOT)
    )
    if not timestamps or timestamps.startswith("("):
        return "(no data)"
    times = timestamps.strip().splitlines()
    if len(times) < 2:
        return f"{len(times)} commit(s) — insufficient for duration estimate"
    try:
        first = datetime.fromisoformat(times[-1])
        last = datetime.fromisoformat(times[0])
        delta = last - first
        hours = delta.total_seconds() / 3600
        return f"~{hours:.1f}h span ({len(times)} commits, {first.strftime('%H:%M')} → {last.strftime('%H:%M')})"
    except Exception:
        return f"{len(times)} commits"

def build_dump(date: str) -> str:
    sections = []
    sections.append(f"# Fleet Activity — {date}")
    sections.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    sections.append("*For: Gemini (External Governor)*")
    sections.append("")
    sections.append("---")
    sections.append("")

    sections.append("## Session Estimate")
    sections.append(session_hours_estimate(date))
    sections.append("")

    sections.append("## Git Activity (PAI repo)")
    sections.append(git_activity(date))
    sections.append("")

    sections.append("## GitHub Activity (all repos)")
    sections.append(github_activity(date))
    sections.append("")

    sections.append("## Fleet Dispatches")
    sections.append(fleet_dispatches(date))
    sections.append("")

    sections.append("## Work Sessions (PRDs)")
    sections.append(work_activity(date))
    sections.append("")

    sections.append("## Memory Changes")
    sections.append(memory_activity(date))
    sections.append("")

    sections.append("## Flinch Log Status")
    sections.append(flinch_check())
    sections.append("")

    sections.append("---")
    sections.append("")
    sections.append("## Governor Questions")
    sections.append("1. What did the fleet agree on today that might be wrong?")
    sections.append("2. Is the operator's self-image shaping output instead of evidence?")
    sections.append("3. What question isn't being asked?")
    sections.append("4. Is the pace sustainable or is the pattern running?")

    return "\n".join(sections)

def main():
    date = get_date()
    dump = build_dump(date)
    out = DUMP_DIR / f"{date}.md"
    out.write_text(dump)
    print(f"OK: {out}")
    print(f"    {len(dump.splitlines())} lines")

if __name__ == "__main__":
    main()
