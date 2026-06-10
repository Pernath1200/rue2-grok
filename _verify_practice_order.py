"""
Verification: load every modified file, parse JSON, print practice_order +
the number of question sets and questions surfaced.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent

FILES = [
    "curriculum_prepositions.json",
    "curriculum_comparatives.json",
    "curriculum.json",
    "curriculum_past_simple_present_perfect.json",
    "curriculum_conditionals.json",
    "curriculum_past_perfect.json",
    "curriculum_past_simple_continuous.json",
    "curriculum_phrasal_verbs.json",
    "curriculum_relative_pronouns.json",
    "curriculum_reported_speech.json",
    "curriculum_will_going_to.json",
    "curriculum_articles.json",
    "curriculum_conjunctions_linkers.json",
    "curriculum_countable_uncountable.json",
    "curriculum_infinitive_ing.json",
    "curriculum_modal_verbs.json",
    "curriculum_word_order.json",
    "curriculum_punctuation.json",
    "curriculum_quantifiers.json",
]


def main():
    grand_total = 0
    for fname in FILES:
        path = ROOT / fname
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)  # also validates JSON
        po = data.get("practice_order", [])
        practice = data.get("practice", {})
        sets_surfaced = 0
        qs_surfaced = 0
        for key in po:
            sub = practice.get(key)
            if not isinstance(sub, dict):
                continue
            qs = sub.get("questions", [])
            if qs:
                sets_surfaced += 1
                qs_surfaced += len(qs)
        grand_total += qs_surfaced
        print(f"{fname}")
        print(f"  practice_order: {po}")
        print(f"  surfaced: {sets_surfaced} sets, {qs_surfaced} questions")
        print()

    print(f"GRAND TOTAL surfaced across all 19 files: {grand_total} questions")


if __name__ == "__main__":
    main()
