"""
Audit script for RUE2 curriculum_*.json files.

Read-only. Scans every curriculum_*.json in the rue2-grok root (NOT intake/)
and reports structural issues that would break student-facing practice.

Issues flagged:
  [empty]      empty questions arrays under practice.*.questions or check.questions
  [orphan]     practice.* subsection exists but isn't listed in practice_order
  [phantom]    practice_order entry has no corresponding practice.* subsection
  [no-order]   file has practice sets but no practice_order array
  [thin-intro] intro has fewer than 3 sections or is missing entirely
  [parse-fail] file failed to parse (noted, not counted as structural issue)
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(r"C:\Users\ADMIN\Documents\projects\rue2-grok")
OUTPUT = ROOT / "_audit_practice_arrays.md"


def audit_file(path: Path) -> dict:
    """Return a dict of issues for a single curriculum file."""
    result = {
        "name": path.name,
        "parse_error": None,
        "issues": [],            # list of (tag, message)
        "missing_root_id": False,
        "nonstandard_keys": [],  # any unusual top-level keys
        "practice_keys": [],     # all practice subsection keys present
    }

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        result["parse_error"] = str(exc)
        return result

    if not isinstance(data, dict):
        result["parse_error"] = f"top-level is {type(data).__name__}, not dict"
        return result

    # --- intro ---
    intro = data.get("intro")
    if not isinstance(intro, dict):
        result["issues"].append(("thin-intro", "intro missing or not an object"))
    else:
        sections = intro.get("sections")
        if not isinstance(sections, list):
            result["issues"].append(("thin-intro", "intro.sections missing or not a list"))
        elif len(sections) < 3:
            result["issues"].append(("thin-intro", f"only {len(sections)} section(s)"))

    # --- check ---
    check = data.get("check")
    if isinstance(check, dict):
        qs = check.get("questions")
        if not isinstance(qs, list) or len(qs) == 0:
            result["issues"].append(("empty", "check.questions is empty or missing"))

    # --- practice ---
    practice = data.get("practice")
    practice_order = data.get("practice_order")

    if isinstance(practice, dict):
        practice_keys = list(practice.keys())
        result["practice_keys"] = practice_keys

        # Check each subsection's questions array
        for key, sub in practice.items():
            if not isinstance(sub, dict):
                result["issues"].append(("empty", f"practice.{key} is not an object"))
                continue
            qs = sub.get("questions")
            if not isinstance(qs, list):
                result["issues"].append(("empty", f"practice.{key}.questions missing or not a list"))
            elif len(qs) == 0:
                result["issues"].append(("empty", f"practice.{key}.questions is []"))

        if isinstance(practice_order, list):
            order_set = set(practice_order)
            practice_set = set(practice_keys)

            # Orphans: in practice, not in order
            orphans = practice_set - order_set
            for o in sorted(orphans):
                # Report orphan with question count for clarity
                sub = practice.get(o, {})
                qs = sub.get("questions") if isinstance(sub, dict) else None
                qcount = len(qs) if isinstance(qs, list) else 0
                result["issues"].append((
                    "orphan",
                    f"{o} exists in practice ({qcount} qs) but not in practice_order",
                ))

            # Phantoms: in order, not in practice
            phantoms = order_set - practice_set
            for p in sorted(phantoms):
                result["issues"].append((
                    "phantom",
                    f"practice_order lists '{p}' but no practice.{p} subsection",
                ))
        else:
            # No practice_order but practice exists with content
            if practice_keys:
                result["issues"].append((
                    "no-order",
                    f"practice has {len(practice_keys)} subsection(s) but no practice_order",
                ))

    elif practice is None:
        # No practice at all — could be intentional, but unusual
        if isinstance(practice_order, list) and practice_order:
            result["issues"].append((
                "phantom",
                f"practice_order has {len(practice_order)} entries but no practice object",
            ))

    # --- root_id / id presence (for prescription wiring) ---
    if not any(k in data for k in ("root_id", "id", "root_ids")):
        result["missing_root_id"] = True

    # --- noteworthy non-standard top-level keys ---
    standard = {"intro", "check", "practice", "practice_order",
                "title", "id", "root_id", "root_ids", "meta",
                "level", "version", "tags", "summary"}
    for k in data.keys():
        if k not in standard:
            result["nonstandard_keys"].append(k)

    return result


def main() -> None:
    files = sorted(p for p in ROOT.glob("curriculum*.json"))
    # Exclude intake subfolder explicitly (glob is non-recursive, but be explicit)
    files = [p for p in files if p.parent == ROOT]

    reports = [audit_file(p) for p in files]

    # Counters
    n_files = len(reports)
    n_parse_fail = sum(1 for r in reports if r["parse_error"])
    n_empty = sum(1 for r in reports if any(t == "empty" for t, _ in r["issues"]))
    n_orphan = sum(1 for r in reports if any(t == "orphan" for t, _ in r["issues"]))
    n_phantom = sum(1 for r in reports if any(t == "phantom" for t, _ in r["issues"]))
    n_no_order = sum(1 for r in reports if any(t == "no-order" for t, _ in r["issues"]))
    n_thin = sum(1 for r in reports if any(t == "thin-intro" for t, _ in r["issues"]))
    n_missing_root = sum(1 for r in reports if r["missing_root_id"] and not r["parse_error"])

    # Issue-tag frequency (count of individual issue instances, not files)
    tag_counts: dict[str, int] = {}
    for r in reports:
        for t, _ in r["issues"]:
            tag_counts[t] = tag_counts.get(t, 0) + 1

    # All practice keys seen, for non-standard detection
    all_practice_keys: dict[str, int] = {}
    for r in reports:
        for k in r["practice_keys"]:
            all_practice_keys[k] = all_practice_keys.get(k, 0) + 1

    # Build markdown
    today = date.today().isoformat()
    lines: list[str] = []
    lines.append(f"# Practice-array audit — {today}")
    lines.append("")
    lines.append("Generated by audit agent. Covers all curriculum_*.json files in rue2-grok/ "
                 "(top level only; intake/ subfolder excluded).")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- {n_files} files scanned")
    if n_parse_fail:
        lines.append(f"- {n_parse_fail} files failed to parse")
    lines.append(f"- {n_empty} files with empty practice/check question arrays")
    lines.append(f"- {n_orphan} files with orphaned practice subsections")
    lines.append(f"- {n_phantom} files with phantom practice_order entries")
    lines.append(f"- {n_no_order} files with practice but no practice_order")
    lines.append(f"- {n_thin} files with thin or missing intro")
    lines.append(f"- {n_missing_root} files missing any id/root_id field (prescription-wiring concern)")
    lines.append("")
    lines.append("### Issue-instance counts by tag")
    lines.append("")
    for tag in ("empty", "orphan", "phantom", "no-order", "thin-intro"):
        lines.append(f"- `[{tag}]` {tag_counts.get(tag, 0)}")
    lines.append("")
    lines.append("### Practice subsection keys observed (key: file count)")
    lines.append("")
    for k in sorted(all_practice_keys, key=lambda x: (-all_practice_keys[x], x)):
        lines.append(f"- `{k}` — {all_practice_keys[k]}")
    lines.append("")

    # Files with issues
    issue_reports = [r for r in reports if r["issues"] or r["parse_error"]]
    clean_reports = [r for r in reports if not r["issues"] and not r["parse_error"]]

    # Sort issue reports by issue count, descending (most urgent first)
    issue_reports.sort(key=lambda r: (-len(r["issues"]), r["name"]))

    lines.append("## Files with issues")
    lines.append("")
    if not issue_reports:
        lines.append("_None — all files clean._")
        lines.append("")
    for r in issue_reports:
        lines.append(f"### {r['name']}")
        if r["parse_error"]:
            lines.append(f"- `[parse-fail]` {r['parse_error']}")
        for tag, msg in r["issues"]:
            lines.append(f"- `[{tag}]` {msg}")
        if r["missing_root_id"] and not r["parse_error"]:
            lines.append(f"- `[no-id]` no id/root_id/root_ids field present")
        if r["nonstandard_keys"]:
            lines.append(f"- `[nonstd-keys]` top-level keys outside the standard set: "
                         f"{', '.join(r['nonstandard_keys'])}")
        lines.append("")

    lines.append("## Clean files (no issues found)")
    lines.append("")
    if clean_reports:
        lines.append(", ".join(r["name"] for r in clean_reports))
    else:
        lines.append("_None._")
    lines.append("")

    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    print(f"Scanned {n_files} files; "
          f"{len(issue_reports)} with issues, {len(clean_reports)} clean.")


if __name__ == "__main__":
    main()
