"""
Mechanical fix: add orphaned practice subsections to practice_order.

Per audit 2026-05-29. One file, one careful edit. Empty subsections skipped.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent

# Gold-standard insertion priority (lower = earlier in practice_order).
# Keys not listed get priority 999 (appended at end before mc).
PRIORITY = {
    "guided_mc": 10,
    "gap_fill_1": 20,
    "gapfill_simple": 20,
    "gapfill": 20,
    "gapfill_common": 25,
    "conjunctions_linkers": 25,
    "gapfill_advanced": 30,
    "advanced": 30,
    "gapfill_tricky": 40,
    "gapfill_top40": 50,
    "gapfill_top50": 50,
    "gapfill_next100": 55,
    "superlatives": 60,
    "countable_uncountable": 60,
    "commas_capitals": 60,
    "makesentence": 65,
    "makequestion": 66,
    "gapfill_dependent_verbs": 70,
    "gapfill_dependent_adjectives": 71,
    "gapfill_dependent_nouns": 72,
    "errorcorrection": 80,
    "mc_meaning": 85,
    "mc": 90,
}

# Per-file orphans to ADD (from the audit, with empty sets already excluded).
TO_ADD = {
    "curriculum_prepositions.json": [
        "gapfill_advanced", "gapfill_tricky", "gapfill_top40",
        "gapfill_dependent_verbs", "gapfill_dependent_adjectives",
        "gapfill_dependent_nouns", "mc",
    ],
    "curriculum_comparatives.json": ["advanced", "errorcorrection", "gapfill", "superlatives"],
    "curriculum.json": ["errorcorrection", "gapfill", "makequestion", "makesentence"],
    "curriculum_past_simple_present_perfect.json": ["errorcorrection", "gapfill", "makequestion", "makesentence"],
    "curriculum_conditionals.json": ["errorcorrection"],
    "curriculum_past_perfect.json": ["errorcorrection", "gapfill"],
    "curriculum_past_simple_continuous.json": ["errorcorrection", "gapfill"],
    "curriculum_phrasal_verbs.json": ["errorcorrection", "gapfill_next100", "gapfill_top50"],
    "curriculum_relative_pronouns.json": ["errorcorrection"],
    "curriculum_reported_speech.json": ["errorcorrection"],
    "curriculum_will_going_to.json": ["errorcorrection", "gapfill"],
    "curriculum_articles.json": ["errorcorrection", "gapfill"],
    "curriculum_countable_uncountable.json": ["countable_uncountable"],
    "curriculum_infinitive_ing.json": ["errorcorrection", "gapfill"],
    "curriculum_modal_verbs.json": ["gapfill"],
    "curriculum_word_order.json": ["errorcorrection", "gapfill"],
    "curriculum_punctuation.json": ["commas_capitals"],
    "curriculum_quantifiers.json": ["errorcorrection"],
}


def build_new_order(existing, additions, practice_counts):
    """
    Preserve existing entries' relative order. Insert each addition at the
    position dictated by PRIORITY among the existing list. Skip empty sets.
    """
    additions = [k for k in additions if practice_counts.get(k, 0) > 0]

    # Decorate existing with their priorities (for sort-position lookups only;
    # we won't actually re-sort the existing entries).
    new_order = list(existing)

    for key in additions:
        if key in new_order:
            continue  # already present somehow
        prio = PRIORITY.get(key, 999)
        # Find insertion index: first existing entry with priority > prio
        insert_at = len(new_order)
        for i, ex_key in enumerate(new_order):
            ex_prio = PRIORITY.get(ex_key, 999)
            if ex_prio > prio:
                insert_at = i
                break
        new_order.insert(insert_at, key)

    return new_order


def main():
    summary = []
    total_qs_surfaced_new = 0
    for fname, additions in TO_ADD.items():
        path = ROOT / fname
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)

        existing = list(data.get("practice_order", []))
        practice = data.get("practice", {})
        counts = {k: len(v.get("questions", []) if isinstance(v, dict) else []) for k, v in practice.items()}

        new_order = build_new_order(existing, additions, counts)

        if new_order == existing:
            summary.append((fname, existing, new_order, 0, "NO-CHANGE"))
            continue

        added_keys = [k for k in new_order if k not in existing]
        qs_added = sum(counts.get(k, 0) for k in added_keys)
        total_qs_surfaced_new += qs_added

        data["practice_order"] = new_order
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

        # Validate it parses back
        with open(path, "r", encoding="utf-8") as fh:
            json.load(fh)

        summary.append((fname, existing, new_order, qs_added, "OK"))

    print("=" * 70)
    print("FIX SUMMARY")
    print("=" * 70)
    for fname, before, after, qs, status in summary:
        print(f"\n{fname}  [{status}]")
        print(f"  before: {before}")
        print(f"  after:  {after}")
        print(f"  qs surfaced (added): {qs}")
    print()
    print(f"TOTAL files edited: {sum(1 for s in summary if s[4] == 'OK')}")
    print(f"TOTAL question sets newly surfaced: {sum(1 for s in summary for k in s[2] if k not in s[1])}")
    print(f"TOTAL questions newly surfaced: {total_qs_surfaced_new}")


if __name__ == "__main__":
    main()
