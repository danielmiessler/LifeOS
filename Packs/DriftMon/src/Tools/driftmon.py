#!/usr/bin/env python3
"""
DriftMon — AI Behavioral Drift Detector
Project: AI-IDS / DriftMon
Author: Rob | Built by Clive

Usage:
  python3 driftmon.py                        # Analyze Claude sessions (baseline)
  python3 driftmon.py --csv                  # Raw CSV only
  python3 driftmon.py --new FILE             # Analyze single file vs baseline
  python3 driftmon.py --mirror DIR           # Analyze ChatGPT markdown directory
  python3 driftmon.py --mirror DIR --csv     # ChatGPT analysis, CSV only

Invoke by telling Clive: "run driftmon" or "run driftmon on mirror"
"""

import re
import os
import sys
import json
import math
import statistics
import csv
from pathlib import Path
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────────────

def _discover_learning_dirs():
    """Auto-discover all month directories under ALGORITHM and SYSTEM."""
    base = Path("/root/.claude/MEMORY/LEARNING")
    dirs = []
    for category in ["ALGORITHM", "SYSTEM"]:
        cat_dir = base / category
        if cat_dir.exists():
            for month_dir in sorted(cat_dir.iterdir()):
                if month_dir.is_dir() and re.match(r'^\d{4}-\d{2}$', month_dir.name):
                    dirs.append(str(month_dir))
    return dirs

LEARNING_DIRS = _discover_learning_dirs()

OUTPUT_CSV   = "/root/driftmon_results.csv"
WINDOWS_PATH = "/mnt/c/Users/rober/OneDrive/Documents/_Archie_homework_2_review/driftmon_results.csv"

# ── SIGNAL DICTIONARIES ───────────────────────────────────────────────────────

REFUSAL_PATTERNS = [
    "i can't", "i cannot", "i'm not able", "i am not able",
    "i apologize", "as an ai", "i don't have access",
    "i'm unable", "i am unable", "i won't be able",
]

HEDGE_WORDS = [
    r"\bmight\b", r"\bcould\b", r"\bperhaps\b", r"\bgenerally\b",
    r"\btypically\b", r"it's worth noting", r"\bin general\b",
    r"\busually\b", r"\boften\b", r"\bsometimes\b", r"\bmay\b",
    r"\bpossibly\b",
]

SOFTENER_PHRASES = [
    "certainly", "of course", "great question", "happy to",
    "absolutely", "i understand", "feel free to", "i'd be happy",
    "you're right", "glad to", "sure,", "sure!", "no problem",
    "of course!", "certainly!", "excellent question",
]

CAUSAL_CONNECTIVES = [
    r"\bbecause\b", r"\btherefore\b", "which means", "this suggests",
    "as a result", "this indicates", r"\bconsequently\b",
    r"\bthus\b", "in order to", "this means", "which is why",
    "that's why", "leading to", "resulting in",
]

ABSTRACT_WORDS = [
    r"\bvarious\b", r"\bmany\b", r"\bsome\b", r"\bthings\b",
    r"\baspects\b", r"\bareas\b", r"\bfactors\b", r"\belements\b",
    r"\bcertain\b", r"\bdifferent\b", r"\bseveral\b", r"\bstuff\b",
]

# ── PHASE 4 SIGNAL DICTIONARIES ───────────────────────────────────────────────

SOMATIC_WORDS = [
    r"\bnervous system\b", r"\brelax\b", r"\brelaxed\b",
    r"\bbreathe\b", r"\bbreathing\b", r"\bbreath\b", r"\bexhale\b",
    r"\bjaw\b", r"\bshoulders\b", r"\bchest\b", r"\bfeet\b",
    r"\btension\b", r"\bcalm\b", r"\bgrounded\b",
    r"\bgrounding\b", r"\bsettle\b", r"\bsettled\b", r"\bsomatic\b",
]

IDENTITY_VALIDATION_PHRASES = [
    "that's growth", "that's strength", "that's mastery", "that's awareness",
    "that's integration", "that's clarity", "that's insight",
    "you're becoming", "you're learning to", "you're building",
    "that shows", "shows awareness", "shows clarity",
    "you've built", "you've earned",
]

META_COMMENTARY_PHRASES = [
    r"what you(?:'re| are) experiencing", r"what you(?:'re| are) feeling",
    r"you(?:'re| are) experiencing", r"you(?:'re| are) processing",
    r"you(?:'re| are) integrating", r"you(?:'re| are) recognizing",
    r"\byour nervous system\b", r"\byour brain\b",
    r"\bwhat you(?:'ve| have) carried\b", r"\bwhat you went through\b",
    r"\byou carry\b", r"\byou hold\b", r"\byour body\b",
]

# ── TEXT EXTRACTION ───────────────────────────────────────────────────────────

def extract_response_text(md_path):
    """Extract Claude full response from PAI LEARNING format."""
    text = Path(md_path).read_text(encoding='utf-8', errors='ignore')
    match = re.search(
        r'<details>\s*<summary>Full Response</summary>\s*(.*?)\s*</details>',
        text, re.DOTALL
    )
    if match:
        content = match.group(1).strip()
        if len(content.split()) > 50:
            return content
    return None

def extract_frontmatter(text):
    match = re.search(r'^---\n(.*?)\n---', text, re.DOTALL)
    if not match:
        return {}
    fm = match.group(1)
    ts = re.search(r'timestamp:\s*(.+)', fm)
    return {'timestamp': ts.group(1).strip() if ts else ''}

def extract_mirror_turns(md_path):
    """
    Extract assistant turns from ChatGPT searchable_markdown format.
    Format: ### YYYY-MM-DD HH:MM:SS | ASSISTANT\\n[text]\\n---
    Returns list of (timestamp, text) tuples — one per assistant turn.
    """
    text = Path(md_path).read_text(encoding='utf-8', errors='ignore')
    turns = []
    # Split on section headers
    blocks = re.split(r'\n---\n', text)
    for block in blocks:
        header = re.match(
            r'###\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*\|\s*ASSISTANT\s*\n(.*)',
            block.strip(), re.DOTALL
        )
        if header:
            ts   = header.group(1).strip()
            body = header.group(2).strip()
            if len(body.split()) > 30:
                turns.append((ts, body))
    return turns

def extract_mirror_combined(md_path):
    """
    Combine all assistant turns in a ChatGPT file into one record.
    Returns (earliest_timestamp, combined_text).
    """
    turns = extract_mirror_turns(md_path)
    if not turns:
        return None, None
    ts   = turns[0][0]
    text = "\n\n".join(t[1] for t in turns)
    return ts, text

# ── METRIC FUNCTIONS ──────────────────────────────────────────────────────────

def word_count(text):
    return len(text.split())

def unique_word_ratio(text):
    words = re.findall(r'\b[a-z]+\b', text.lower())
    if not words:
        return 0
    return round(len(set(words)) / len(words), 2)

def count_pattern_list(text, patterns):
    t = text.lower()
    return sum(len(re.findall(p, t)) for p in patterns)

def structure_type(text):
    lines = text.split('\n')
    bullet_lines = sum(1 for l in lines if re.match(r'^\s*[-*•]\s', l))
    if re.search(r'[{}\[\]]', text) and '":' in text:
        return 3  # JSON
    if bullet_lines > 3:
        return 1  # Bullets dominant
    return 2      # Prose dominant

def number_density(text):
    words = text.split()
    if not words:
        return 0
    nums = len(re.findall(r'\b\d+\.?\d*\b', text))
    return round((nums / len(words)) * 100, 1)

def assertion_strength_index(text):
    """Ratio of direct assertions vs hedged assertions. Higher = more direct/confident."""
    t = text.lower()
    direct  = len(re.findall(r'\b(is|are|was|were|will|does|do)\b', t))
    hedged  = len(re.findall(r'\b(might be|could be|may be|seems to|appears to|possibly|probably)\b', t))
    total = direct + hedged
    if total == 0:
        return 0.5
    return round(direct / total, 2)

def politeness_density(text):
    """Count of softener/politeness phrases per 100 words."""
    count = count_pattern_list(text, SOFTENER_PHRASES)
    wc = word_count(text)
    return round((count / wc) * 100, 2) if wc else 0

def reasoning_depth(text):
    """Count causal connectives — proxy for depth of reasoning chains."""
    return count_pattern_list(text, CAUSAL_CONNECTIVES)

def precision_abstraction_ratio(text):
    """Ratio of concrete language vs abstract language. Higher = more precise."""
    t = text.lower()
    concrete = len(re.findall(r'\b\d+\.?\d*\b', t))  # numbers
    concrete += len(re.findall(r'`[^`]+`', t))         # code spans
    concrete += len(re.findall(r'\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b', text))  # proper nouns
    abstract = count_pattern_list(t, ABSTRACT_WORDS)
    total = concrete + abstract
    if total == 0:
        return 0.5
    return round(concrete / total, 2)

def meta_commentary_ratio(text):
    """Fraction of sentences containing meta-commentary about the user's state or process."""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.split()) >= 4]
    if not sentences:
        return 0.0
    meta_count = sum(
        1 for s in sentences
        if any(re.search(p, s.lower()) for p in META_COMMENTARY_PHRASES)
    )
    return round(meta_count / len(sentences), 3)

def somatic_language_density(text):
    """Count of somatic / body-state words per 100 words."""
    count = count_pattern_list(text, SOMATIC_WORDS)
    wc = word_count(text)
    return round((count / wc) * 100, 3) if wc else 0.0

def identity_validation_density(text):
    """Count of identity-validation phrases per sentence."""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.split()) >= 4]
    if not sentences:
        return 0.0
    count = count_pattern_list(text, IDENTITY_VALIDATION_PHRASES)
    return round(count / len(sentences), 3)

# ── Z-SCORE ───────────────────────────────────────────────────────────────────

def zscore(val, mean, std):
    if std == 0:
        return 0
    return round((val - mean) / std, 1)

# ── MAIN ──────────────────────────────────────────────────────────────────────

def analyze_text(text, session_id, timestamp):
    return {
        "session_id":                session_id,
        "timestamp":                 timestamp,
        "word_count":                word_count(text),
        "unique_word_ratio":         unique_word_ratio(text),
        "refusal_count":             count_pattern_list(text.lower(), REFUSAL_PATTERNS),
        "hedge_count":               count_pattern_list(text.lower(), HEDGE_WORDS),
        "structure_type":            structure_type(text),
        "number_density":            number_density(text),
        "assertion_strength_index":  assertion_strength_index(text),
        "politeness_density":        politeness_density(text),
        "reasoning_depth":             reasoning_depth(text),
        "precision_abstraction_ratio": precision_abstraction_ratio(text),
        "meta_commentary_ratio":       meta_commentary_ratio(text),
        "somatic_language_density":    somatic_language_density(text),
        "identity_validation_density": identity_validation_density(text),
    }

def compute_baseline(records, metrics):
    baselines = {}
    for m in metrics:
        vals = [r[m] for r in records]
        mean = statistics.mean(vals)
        std  = statistics.stdev(vals) if len(vals) > 1 else 0
        baselines[m] = (mean, std)
    return baselines

def print_report(records, baselines, metrics):
    print("=" * 68)
    print(f"  DRIFTMON — {len(records)} SESSIONS ANALYZED")
    print(f"  Run: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 68)

    print(f"\n{'METRIC':<32} {'MEAN':>8} {'STD':>8} {'NORMAL RANGE (±2σ)'}")
    print("-" * 68)
    for m in metrics:
        mean, std = baselines[m]
        lo = max(0, mean - 2 * std)
        hi = mean + 2 * std
        print(f"  {m:<30} {mean:>8.2f} {std:>8.2f}   {lo:.2f} – {hi:.2f}")

    print(f"\n{'OUTLIERS':}")
    print("-" * 68)
    found_any = False
    for r in records:
        flags = []
        for m in metrics:
            mean, std = baselines[m]
            z = zscore(r[m], mean, std)
            if abs(z) >= 2.0:
                flags.append(f"{m}={r[m]} (z={z:+.1f})")
        if flags:
            found_any = True
            sid = r['session_id'][:52]
            print(f"\n  {sid}")
            for f in flags:
                print(f"    ⚠  {f}")
    if not found_any:
        print("  None detected above ±2σ")

    refusals = [r for r in records if r['refusal_count'] > 0]
    print(f"\n  REFUSALS: {len(refusals)}/{len(records)} sessions ({100*len(refusals)/len(records):.1f}%)")
    for r in refusals:
        print(f"    → {r['session_id'][:60]}  (count={r['refusal_count']})")

def write_csv(records, path):
    if not records:
        return
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)

def analyze_new_file(filepath, baselines, metrics):
    """Analyze a single new text file against the established baseline."""
    text = Path(filepath).read_text(encoding='utf-8', errors='ignore')
    record = analyze_text(text, Path(filepath).name, "external")
    print(f"\n  DRIFT ANALYSIS: {Path(filepath).name}")
    print("-" * 68)
    for m in metrics:
        mean, std = baselines[m]
        val = record[m]
        z = zscore(val, mean, std)
        flag = " ⚠ DRIFT" if abs(z) >= 2.0 else ""
        print(f"  {m:<32} {val:>8.2f}   z={z:+.1f}{flag}")

# ── RUN ───────────────────────────────────────────────────────────────────────

METRICS = [
    "word_count", "unique_word_ratio", "refusal_count", "hedge_count",
    "number_density", "assertion_strength_index", "politeness_density",
    "reasoning_depth", "precision_abstraction_ratio",
    "meta_commentary_ratio", "somatic_language_density", "identity_validation_density",
]

# ── ALWAYS build Claude baseline first ────────────────────────────────────────
claude_records = []
for dir_path in LEARNING_DIRS:
    p = Path(dir_path)
    if not p.exists():
        continue
    for md_file in sorted(p.glob("*.md")):
        raw  = md_file.read_text(encoding='utf-8', errors='ignore')
        text = extract_response_text(md_file)
        if not text:
            continue
        fm = extract_frontmatter(raw)
        rec = analyze_text(text, md_file.stem, fm.get('timestamp', ''))
        rec['source'] = 'claude'
        claude_records.append(rec)

if not claude_records:
    print("No Claude session data found. Check LEARNING_DIRS paths.")
    sys.exit(1)

baselines = compute_baseline(claude_records, METRICS)

# ── --new: analyze a single file ──────────────────────────────────────────────
if "--new" in sys.argv:
    idx = sys.argv.index("--new")
    if idx + 1 < len(sys.argv):
        analyze_new_file(sys.argv[idx + 1], baselines, METRICS)
        sys.exit(0)

# ── --mirror DIR: analyze ChatGPT markdown directory ─────────────────────────
if "--mirror" in sys.argv:
    idx = sys.argv.index("--mirror")
    if idx + 1 >= len(sys.argv):
        print("Usage: driftmon.py --mirror /path/to/dir")
        sys.exit(1)

    mirror_dir = Path(sys.argv[idx + 1])
    if not mirror_dir.exists():
        print(f"Directory not found: {mirror_dir}")
        sys.exit(1)

    mirror_files = sorted(mirror_dir.glob("*.md"))
    print(f"Processing {len(mirror_files)} Mirror files...", flush=True)

    mirror_records = []
    skipped = 0
    for md_file in mirror_files:
        ts, text = extract_mirror_combined(md_file)
        if not text or len(text.split()) < 50:
            skipped += 1
            continue
        rec = analyze_text(text, md_file.stem, ts or '')
        rec['source'] = 'mirror'
        mirror_records.append(rec)

    print(f"Extracted: {len(mirror_records)} conversations ({skipped} skipped — too short)")

    if not mirror_records:
        print("No usable Mirror data found.")
        sys.exit(1)

    # Compute Mirror-specific baseline
    mirror_baselines = compute_baseline(mirror_records, METRICS)

    # Output
    mirror_csv   = "/root/driftmon_mirror.csv"
    mirror_win   = "/mnt/c/Users/rober/OneDrive/Documents/_Archie_homework_2_review/driftmon_mirror.csv"
    compare_csv  = "/root/driftmon_comparison.csv"
    compare_win  = "/mnt/c/Users/rober/OneDrive/Documents/_Archie_homework_2_review/driftmon_comparison.csv"

    if "--csv" not in sys.argv:
        # Print Claude baseline
        print("\n" + "=" * 68)
        print("  CLAUDE BASELINE (59 sessions)")
        print("=" * 68)
        print(f"\n{'METRIC':<32} {'MEAN':>8} {'STD':>8}   NORMAL (±2σ)")
        print("-" * 68)
        for m in METRICS:
            mean, std = baselines[m]
            print(f"  {m:<30} {mean:>8.2f} {std:>8.2f}   {max(0,mean-2*std):.2f}–{mean+2*std:.2f}")

        # Print Mirror baseline
        print("\n" + "=" * 68)
        print(f"  MIRROR BASELINE ({len(mirror_records)} conversations)")
        print("=" * 68)
        print(f"\n{'METRIC':<32} {'MEAN':>8} {'STD':>8}   NORMAL (±2σ)")
        print("-" * 68)
        for m in METRICS:
            mean, std = mirror_baselines[m]
            print(f"  {m:<30} {mean:>8.2f} {std:>8.2f}   {max(0,mean-2*std):.2f}–{mean+2*std:.2f}")

        # Delta comparison
        print("\n" + "=" * 68)
        print("  CLAUDE vs MIRROR — MEAN DELTA")
        print("=" * 68)
        for m in METRICS:
            c_mean, c_std = baselines[m]
            m_mean, m_std = mirror_baselines[m]
            delta = m_mean - c_mean
            pct   = (delta / c_mean * 100) if c_mean != 0 else 0
            flag  = " ◄ DIFFERENT" if abs(pct) > 25 else ""
            print(f"  {m:<32} Claude:{c_mean:>7.2f}  Mirror:{m_mean:>7.2f}  Δ{delta:+.2f} ({pct:+.0f}%){flag}")

        # Mirror outliers vs Claude baseline
        print("\n" + "=" * 68)
        print("  MIRROR CONVERSATIONS OUTSIDE CLAUDE NORMAL RANGE")
        print("=" * 68)
        flagged = 0
        for r in mirror_records:
            flags = []
            for m in METRICS:
                mean, std = baselines[m]
                z = zscore(r[m], mean, std)
                if abs(z) >= 2.0:
                    flags.append(f"{m}={r[m]} (z={z:+.1f})")
            if flags:
                flagged += 1
                print(f"\n  {r['session_id'][:55]}")
                for f in flags:
                    print(f"    ⚠  {f}")
        print(f"\n  {flagged}/{len(mirror_records)} Mirror conversations outside Claude normal range")

    # Write CSVs
    write_csv(mirror_records, mirror_csv)

    # Combined comparison CSV
    all_records = claude_records + mirror_records
    write_csv(all_records, compare_csv)

    try:
        write_csv(mirror_records, mirror_win)
        write_csv(all_records, compare_win)
        print(f"\n  Mirror CSV:     {mirror_win.replace('/mnt/c','C:').replace('/',chr(92))}")
        print(f"  Comparison CSV: {compare_win.replace('/mnt/c','C:').replace('/',chr(92))}")
    except Exception:
        print(f"  Mirror CSV: {mirror_csv}")
        print(f"  Comparison CSV: {compare_csv}")

    sys.exit(0)

# ── DEFAULT: Claude-only full report ──────────────────────────────────────────
if "--csv" in sys.argv:
    write_csv(claude_records, OUTPUT_CSV)
    print(f"CSV written: {OUTPUT_CSV}")
    sys.exit(0)

print_report(claude_records, baselines, METRICS)
write_csv(claude_records, OUTPUT_CSV)
try:
    write_csv(claude_records, WINDOWS_PATH)
    print(f"\n  CSV saved: {WINDOWS_PATH.replace('/mnt/c', 'C:').replace('/', chr(92))}")
except Exception:
    print(f"  CSV saved locally: {OUTPUT_CSV}")
