#!/usr/bin/env python3
"""
FlowDetect — User Flow State Detector
Analyzes Rob's message patterns to detect deep flow states.

Companion to DriftMon (which watches AI behavioral drift).
FlowDetect watches the HUMAN side — message brevity, typo density,
punctuation drops, command directness, message velocity.

Usage:
  python3 flowdetect.py                    # Analyze all sessions, build baseline + report
  python3 flowdetect.py --csv              # CSV only (for hook use)
  python3 flowdetect.py --live SESSION_ID  # Analyze current session, compare to baseline
  python3 flowdetect.py --score SESSION_ID # Just output flow score 0-100 for current session

The --live and --score modes are designed for mid-session hook use.
When flow score > 70, the hook can suggest starting a Garmin session
to capture biometric data during the flow state.

Flow Indicators (higher = more flow):
  - Shorter messages (fewer words per message)
  - Higher typo density (typing fast, not proofing)
  - Less punctuation (dropping periods, commas)
  - More direct commands (imperatives, less hedging)
  - Higher message velocity (messages per minute)
  - Less small talk / more task-oriented
  - Word dropping (incomplete sentences)
  - Less capitalization (not bothering with shift key)

Anti-Flow Indicators (higher = less flow):
  - Long explanatory messages
  - Perfect grammar and punctuation
  - Questions about approach (deliberating, not doing)
  - Greetings, pleasantries, filler

Author: Rob + Archie
"""

import re
import os
import sys
import json
import csv
import statistics
from pathlib import Path
from datetime import datetime, timedelta

# ── CONFIG ────────────────────────────────────────────────────────────────────

TRANSCRIPT_DIRS = [
    Path("/root/.claude/projects/-root--claude"),
    Path("/root/.claude/projects/-root"),
    Path("/root/.claude/projects/-root-flowlabs"),
    Path("/root/.claude/projects/-root-northwoods-sentinel"),
    Path("/root/.claude/projects/-root-projects"),
]
OUTPUT_CSV = "/root/flowdetect_results.csv"
WINDOWS_PATH = "/mnt/c/Users/rober/OneDrive/Documents/_Archie_homework_2_review/flowdetect_results.csv"

# ── PATTERN DICTIONARIES ─────────────────────────────────────────────────────

# Common typo patterns (character swaps, missing letters, double letters)
# We detect these by looking for words not in a basic vocab + short word heuristics
COMMON_TYPOS = [
    r"\bcluade\b", r"\bteh\b", r"\byuo\b", r"\bwaht\b", r"\bthat\b",
    r"\bscreenhotinbox\b", r"\bscreenshot\b.*\binbox\b", r"\bplase\b",
    r"\bdidnt\b", r"\bwasnt\b", r"\bwouldnt\b", r"\bcouldnt\b",
    r"\bshouldnt\b", r"\bisnt\b", r"\bdont\b", r"\bcant\b", r"\bwont\b",
    r"\bIm\b", r"\bIve\b", r"\bId\b", r"\bIll\b",
    r"\byeha\b", r"\byeh\b", r"\byep\b", r"\bnah\b",
    r"\bfo r\b", r"\bth e\b", r"\bin to\b",
]

# Contraction-without-apostrophe as flow indicator (typing fast, skipping punctuation)
MISSING_APOSTROPHE = [
    r"\bdidnt\b", r"\bwasnt\b", r"\bwouldnt\b", r"\bcouldnt\b",
    r"\bshouldnt\b", r"\bisnt\b", r"\bdont\b", r"\bcant\b", r"\bwont\b",
    r"\bIm\b", r"\bIve\b", r"\bId\b", r"\bIll\b", r"\btheyre\b",
    r"\byoure\b", r"\bwere\b", r"\bthats\b", r"\bwhats\b", r"\bheres\b",
    r"\blets\b", r"\baint\b", r"\bhasnt\b", r"\bhavent\b",
]

# Direct commands / imperatives (flow = terse orders)
IMPERATIVE_PATTERNS = [
    r"^(do|fix|build|run|check|look|find|give|show|make|read|write|add|remove|update|get|set|move|copy|open|close|stop|start|send|push|pull|deploy|test|verify)\b",
    r"^(can you|could you|please)\b",
]

# Small talk / non-flow indicators
SMALL_TALK = [
    r"\bhow are you\b", r"\bthanks\b", r"\bthank you\b",
    r"\bplease\b", r"\bsorry\b", r"\bexcuse me\b",
    r"\bgood morning\b", r"\bgood evening\b", r"\bhello\b", r"\bhey\b",
    r"\bhi there\b",
]

# Deliberation phrases (thinking out loud = less flow, more planning)
DELIBERATION = [
    r"\bshould (we|I)\b", r"\bwhat if\b", r"\bmaybe\b",
    r"\bI('m| am) (thinking|wondering)\b", r"\blet me think\b",
    r"\bI('m| am) not sure\b", r"\bwhat do you think\b",
]

# ── TEXT EXTRACTION ───────────────────────────────────────────────────────────

def extract_user_messages(jsonl_path):
    """
    Extract user text messages from a Claude Code JSONL transcript.
    Returns list of (timestamp_estimate, text) tuples.
    Filters out tool_result messages, system commands, and very short messages.
    """
    messages = []
    msg_index = 0

    with open(jsonl_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if obj.get('type') != 'user':
                continue

            msg = obj.get('message', {})
            if not isinstance(msg, dict):
                continue

            content = msg.get('content', '')

            # Skip tool_result messages (these are system, not user typing)
            if isinstance(content, list):
                continue

            if not isinstance(content, str):
                continue

            # Skip system/command messages
            if content.startswith('<local-command') or content.startswith('<command'):
                continue
            if '<tool_result>' in content:
                continue

            # Strip system-reminder tags for analysis
            text = re.sub(r'<system-reminder>.*?</system-reminder>', '', content, flags=re.DOTALL).strip()

            # Skip empty or very short (just "ok", "yes", etc are still valid flow signals)
            if len(text) < 1:
                continue

            # Use message index as time proxy (actual timestamps not in transcript)
            messages.append((msg_index, text))
            msg_index += 1

    return messages


def get_session_id(jsonl_path):
    """Extract session ID from first line of transcript."""
    with open(jsonl_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            try:
                obj = json.loads(line)
                sid = obj.get('sessionId', '')
                if sid:
                    return sid
            except:
                continue
    return Path(jsonl_path).stem


def get_session_timestamp(jsonl_path):
    """Get file modification time as session timestamp."""
    return datetime.fromtimestamp(os.path.getmtime(jsonl_path)).strftime('%Y-%m-%d %H:%M')

# ── METRIC FUNCTIONS ──────────────────────────────────────────────────────────

def avg_message_length(messages):
    """Average words per user message. Lower = more flow."""
    if not messages:
        return 0
    lengths = [len(m[1].split()) for m in messages]
    return round(statistics.mean(lengths), 1)


def median_message_length(messages):
    """Median words per user message. More robust than mean."""
    if not messages:
        return 0
    lengths = [len(m[1].split()) for m in messages]
    return round(statistics.median(lengths), 1)


def short_message_ratio(messages):
    """Fraction of messages under 10 words. Higher = more flow."""
    if not messages:
        return 0
    short = sum(1 for _, text in messages if len(text.split()) < 10)
    return round(short / len(messages), 2)


def typo_density(messages):
    """Missing apostrophes + known typo patterns per 100 words. Higher = more flow."""
    all_text = ' '.join(m[1] for m in messages).lower()
    wc = len(all_text.split())
    if wc == 0:
        return 0
    count = 0
    for p in MISSING_APOSTROPHE + COMMON_TYPOS:
        count += len(re.findall(p, all_text, re.IGNORECASE))
    return round((count / wc) * 100, 2)


def punctuation_density(messages):
    """Punctuation marks per 100 chars. Lower = more flow."""
    all_text = ' '.join(m[1] for m in messages)
    if not all_text:
        return 0
    punct = len(re.findall(r'[.,;:!?\'\"()\-]', all_text))
    return round((punct / len(all_text)) * 100, 2)


def capitalization_ratio(messages):
    """
    Ratio of properly capitalized sentence starts. Lower = more flow.
    Checks first char of each message.
    """
    if not messages:
        return 0
    caps = sum(1 for _, text in messages if text and text[0].isupper())
    return round(caps / len(messages), 2)


def imperative_ratio(messages):
    """Fraction of messages starting with imperative/command verbs. Higher = more flow."""
    if not messages:
        return 0
    count = 0
    for _, text in messages:
        first_line = text.strip().split('\n')[0].lower()
        for p in IMPERATIVE_PATTERNS:
            if re.match(p, first_line):
                count += 1
                break
    return round(count / len(messages), 2)


def small_talk_ratio(messages):
    """Fraction of messages containing small talk. Lower = more flow."""
    if not messages:
        return 0
    count = 0
    for _, text in messages:
        t = text.lower()
        if any(re.search(p, t) for p in SMALL_TALK):
            count += 1
    return round(count / len(messages), 2)


def deliberation_ratio(messages):
    """Fraction of messages with deliberation/uncertainty. Lower = more flow."""
    if not messages:
        return 0
    count = 0
    for _, text in messages:
        t = text.lower()
        if any(re.search(p, t) for p in DELIBERATION):
            count += 1
    return round(count / len(messages), 2)


def message_velocity(messages):
    """Messages per "unit" — higher message count = higher velocity = more engagement."""
    return len(messages)


def word_dropping_score(messages):
    """
    Detect incomplete sentences / dropped words.
    Proxy: ratio of messages without a verb-like word. Higher = more flow.
    (Very rough heuristic — looks for messages that are noun-only or fragment-like)
    """
    if not messages:
        return 0
    fragments = 0
    for _, text in messages:
        words = text.strip().split()
        if len(words) <= 3 and not any(w.lower() in ('is','are','was','were','do','did','can','will','have','has') for w in words):
            fragments += 1
    return round(fragments / len(messages), 2)


def lowercase_start_ratio(messages):
    """Fraction of messages starting with lowercase. Higher = more flow."""
    if not messages:
        return 0
    lower = sum(1 for _, text in messages if text and text[0].islower())
    return round(lower / len(messages), 2)


# ── COMPOSITE FLOW SCORE ──────────────────────────────────────────────────────

def compute_flow_score(metrics, baselines=None):
    """
    Compute a 0-100 flow score from individual metrics.
    Each metric contributes positively or negatively.
    If baselines provided, scores relative to baseline. Otherwise absolute.
    """
    score = 50  # Start at neutral

    # Shorter messages = more flow (max +15)
    if metrics['median_msg_length'] < 8:
        score += 15
    elif metrics['median_msg_length'] < 15:
        score += 10
    elif metrics['median_msg_length'] < 25:
        score += 5
    elif metrics['median_msg_length'] > 50:
        score -= 10

    # High short message ratio = more flow (max +10)
    score += metrics['short_msg_ratio'] * 10

    # Typos = typing fast = flow (max +10)
    if metrics['typo_density'] > 3:
        score += 10
    elif metrics['typo_density'] > 1.5:
        score += 7
    elif metrics['typo_density'] > 0.5:
        score += 3

    # Less punctuation = flow (max +8)
    if metrics['punctuation_density'] < 2:
        score += 8
    elif metrics['punctuation_density'] < 3:
        score += 4

    # Lowercase starts = flow (max +7)
    score += metrics['lowercase_start_ratio'] * 7

    # Imperatives = flow (max +8)
    score += metrics['imperative_ratio'] * 8

    # Small talk = anti-flow (max -8)
    score -= metrics['small_talk_ratio'] * 8

    # Deliberation = anti-flow (max -8)
    score -= metrics['deliberation_ratio'] * 8

    # High message count = engagement (max +7)
    if metrics['message_velocity'] > 30:
        score += 7
    elif metrics['message_velocity'] > 15:
        score += 4
    elif metrics['message_velocity'] > 8:
        score += 2

    # Word dropping = flow (max +5)
    score += metrics['word_dropping'] * 5

    return max(0, min(100, round(score)))


# ── ANALYSIS ──────────────────────────────────────────────────────────────────

def analyze_session(jsonl_path):
    """Analyze a single session transcript. Returns metrics dict or None."""
    messages = extract_user_messages(jsonl_path)

    if len(messages) < 3:
        return None  # Too few messages to analyze

    session_id = get_session_id(jsonl_path)
    timestamp = get_session_timestamp(jsonl_path)

    metrics = {
        'session_id':           session_id,
        'file':                 Path(jsonl_path).stem,
        'timestamp':            timestamp,
        'message_count':        len(messages),
        'avg_msg_length':       avg_message_length(messages),
        'median_msg_length':    median_message_length(messages),
        'short_msg_ratio':      short_message_ratio(messages),
        'typo_density':         typo_density(messages),
        'punctuation_density':  punctuation_density(messages),
        'capitalization_ratio': capitalization_ratio(messages),
        'lowercase_start_ratio': lowercase_start_ratio(messages),
        'imperative_ratio':     imperative_ratio(messages),
        'small_talk_ratio':     small_talk_ratio(messages),
        'deliberation_ratio':   deliberation_ratio(messages),
        'message_velocity':     message_velocity(messages),
        'word_dropping':        word_dropping_score(messages),
    }

    metrics['flow_score'] = compute_flow_score(metrics)

    return metrics


# ── OUTPUT ────────────────────────────────────────────────────────────────────

def write_csv(records, path):
    if not records:
        return
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)


def print_report(records):
    if not records:
        print("No sessions with enough user messages to analyze.")
        return

    # Sort by flow score descending
    ranked = sorted(records, key=lambda r: r['flow_score'], reverse=True)

    print("=" * 72)
    print(f"  FLOWDETECT — {len(records)} SESSIONS ANALYZED")
    print(f"  Run: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 72)

    # Baseline stats
    scores = [r['flow_score'] for r in records]
    print(f"\n  Flow Score:  mean={statistics.mean(scores):.1f}  "
          f"median={statistics.median(scores):.0f}  "
          f"std={statistics.stdev(scores):.1f}  "
          f"range={min(scores)}-{max(scores)}")

    # Metric baselines
    metric_keys = [
        'message_count', 'avg_msg_length', 'median_msg_length',
        'short_msg_ratio', 'typo_density', 'punctuation_density',
        'lowercase_start_ratio', 'imperative_ratio', 'small_talk_ratio',
        'deliberation_ratio', 'word_dropping',
    ]

    print(f"\n{'METRIC':<26} {'MEAN':>8} {'STD':>8} {'MIN':>8} {'MAX':>8}")
    print("-" * 72)
    for m in metric_keys:
        vals = [r[m] for r in records]
        mean = statistics.mean(vals)
        std = statistics.stdev(vals) if len(vals) > 1 else 0
        print(f"  {m:<24} {mean:>8.2f} {std:>8.2f} {min(vals):>8.2f} {max(vals):>8.2f}")

    # Top 10 flow sessions
    print(f"\n{'TOP 10 FLOW SESSIONS':}")
    print("-" * 72)
    for r in ranked[:10]:
        print(f"  Score: {r['flow_score']:>3}  |  {r['timestamp']}  |  "
              f"msgs={r['message_count']:>3}  med_len={r['median_msg_length']:>5.1f}  "
              f"typos={r['typo_density']:.1f}  |  {r['file'][:30]}")

    # Bottom 5 (least flow)
    print(f"\n{'BOTTOM 5 (LEAST FLOW)':}")
    print("-" * 72)
    for r in ranked[-5:]:
        print(f"  Score: {r['flow_score']:>3}  |  {r['timestamp']}  |  "
              f"msgs={r['message_count']:>3}  med_len={r['median_msg_length']:>5.1f}  "
              f"typos={r['typo_density']:.1f}  |  {r['file'][:30]}")

    # Flow distribution
    print(f"\n{'FLOW DISTRIBUTION':}")
    print("-" * 72)
    brackets = [(80, 100, 'DEEP FLOW'), (60, 79, 'FLOW'), (40, 59, 'NEUTRAL'), (20, 39, 'DELIBERATE'), (0, 19, 'EXPLORATORY')]
    for lo, hi, label in brackets:
        count = sum(1 for r in records if lo <= r['flow_score'] <= hi)
        bar = '█' * count
        print(f"  {label:<14} ({lo:>2}-{hi:>3}): {count:>4}  {bar}")


def print_live_analysis(record, baseline_records):
    """Print live session analysis with flow state detection."""
    if not record:
        print("Not enough messages to analyze flow state yet.")
        return

    scores = [r['flow_score'] for r in baseline_records] if baseline_records else [50]
    mean_score = statistics.mean(scores)
    std_score = statistics.stdev(scores) if len(scores) > 1 else 10

    score = record['flow_score']
    z = round((score - mean_score) / std_score, 1) if std_score > 0 else 0

    # Determine state
    if score >= 80:
        state = "DEEP FLOW"
        emoji = "🔥"
        suggestion = "You're in deep flow. Consider starting a Garmin session to capture biometrics."
    elif score >= 65:
        state = "FLOW"
        emoji = "⚡"
        suggestion = "Flow state detected. Good session momentum."
    elif score >= 45:
        state = "ENGAGED"
        emoji = "🟢"
        suggestion = ""
    elif score >= 30:
        state = "DELIBERATE"
        emoji = "🟡"
        suggestion = ""
    else:
        state = "EXPLORATORY"
        emoji = "🔵"
        suggestion = ""

    print(f"\n{emoji} FLOW STATE: {state}  (score: {score}/100, z={z:+.1f} vs baseline)")
    print(f"  Messages: {record['message_count']}  |  Median length: {record['median_msg_length']} words")
    print(f"  Typo density: {record['typo_density']}  |  Lowercase starts: {record['lowercase_start_ratio']}")
    print(f"  Imperatives: {record['imperative_ratio']}  |  Small talk: {record['small_talk_ratio']}")
    if suggestion:
        print(f"\n  💡 {suggestion}")


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    # Build baseline from all transcripts across all project dirs
    transcript_files = []
    for d in TRANSCRIPT_DIRS:
        if d.exists():
            transcript_files.extend(sorted(d.glob("*.jsonl")))

    if "--live" in sys.argv or "--score" in sys.argv:
        # Live mode: analyze specific session against baseline
        mode = "--live" if "--live" in sys.argv else "--score"
        idx = sys.argv.index(mode)
        if idx + 1 >= len(sys.argv):
            print(f"Usage: flowdetect.py {mode} SESSION_FILE_STEM")
            sys.exit(1)

        target_stem = sys.argv[idx + 1]
        target_file = None
        for d in TRANSCRIPT_DIRS:
            candidate = d / f"{target_stem}.jsonl"
            if candidate.exists():
                target_file = candidate
                break

        if not target_file:
            # Try partial match
            matches = [f for f in transcript_files if target_stem in f.stem]
            if matches:
                target_file = matches[0]

        if not target_file:
            print(f"Session not found: {target_stem}")
            sys.exit(1)

        # Build baseline (sample for speed — every 10th file)
        baseline_records = []
        for i, f in enumerate(transcript_files):
            if f == target_file:
                continue
            if i % 10 != 0:
                continue
            rec = analyze_session(str(f))
            if rec:
                baseline_records.append(rec)

        # Analyze target
        target_record = analyze_session(str(target_file))

        if mode == "--score":
            if target_record:
                print(target_record['flow_score'])
            else:
                print("0")
            sys.exit(0)

        print_live_analysis(target_record, baseline_records)
        sys.exit(0)

    # Full analysis mode
    print(f"Scanning {len(transcript_files)} transcripts...", file=sys.stderr, flush=True)

    records = []
    skipped = 0
    for f in transcript_files:
        rec = analyze_session(str(f))
        if rec:
            records.append(rec)
        else:
            skipped += 1

    print(f"Analyzed: {len(records)} sessions ({skipped} skipped — too few messages)", file=sys.stderr)

    if not records:
        print("No sessions with enough user messages to analyze.")
        sys.exit(1)

    # Output
    if "--csv" in sys.argv:
        write_csv(records, OUTPUT_CSV)
        print(f"CSV written: {OUTPUT_CSV}")
        try:
            write_csv(records, WINDOWS_PATH)
        except Exception:
            pass
        sys.exit(0)

    print_report(records)
    write_csv(records, OUTPUT_CSV)
    try:
        write_csv(records, WINDOWS_PATH)
        print(f"\n  CSV: {WINDOWS_PATH.replace('/mnt/c','C:').replace('/',chr(92))}")
    except Exception:
        print(f"\n  CSV: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
