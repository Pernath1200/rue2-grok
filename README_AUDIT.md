# Question audit script

The audit script checks question banks against reference data and produces a report for manual follow-up. It does **not** modify any files.

## How to run

From the project root:

```bash
node audit_questions.js
```

This writes:

- **audit_report.json** – machine-readable report (missing alternatives, MC list, short prompts).
- **audit_report.md** – human-readable summary.

## What the script checks

1. **Missing alternatives (dependent prepositions)**  
   For each open question in `questions.json` under the `prepositions` topic that contains a gap (e.g. `____`), the script finds the word before the gap and looks up allowed prepositions in `reference_dependent_prepositions.json`. If the reference lists multiple options (e.g. `research into / on / about`) and the question’s `answers` array is missing one or more, it is reported.  
   **Note:** Some findings may be context-dependent (e.g. “look at” vs “look for”); use the snippet to confirm before adding an alternative.

2. **Missing alternatives (fixed phrases)**  
   For questions in `questions.json` under `fixed_phrases` that match a reference phrase with alternatives (e.g. `in doing so / by doing so`), the script checks that all allowed first-word answers (e.g. “In”, “By”) appear in `answers`.

3. **MC list (manual check)**  
   Every multiple-choice question in the `curriculum_*.json` files is listed with its `correct_option` and options a–d. Manually verify that `correct_option` is the grammatically correct choice.

4. **Short or context-free open prompts (heuristic)**  
   Open questions in `questions.json` that are under 50 characters, contain a gap, and have no obvious tense/quantity hint (e.g. “past”, “yesterday”, “quantity”) are flagged for possible ambiguity.

## After running

- Fix **missing alternative** issues by adding the reported words to the question’s `answers` array in `questions.json` (or the relevant curriculum file) where they are truly valid in that context.
- Use the **MC list** to confirm each `correct_option`; fix any that are wrong.
- Review **short or context-free** items and add context or hints where needed.

Re-run the script after edits to confirm reference-based issues are resolved.
