# Modal Verbs – Root ID Level Mapping (Pilot)

**Family**: Modal Verbs  
**Primary Root**: ① Verb Phrase  
**Pilot Priority**: Very High

---

## Relevant root_ids from the Grammar Tree (B1–B2 focus)

From the Master Index:

**A2**
- `A2.modals.should` — advice
- `A2.modals.must_have_to_basic` — basic obligation (must vs have to)

**B1**
- `B1.modals.speculation_present` — must / might / could / can't be (present deduction)
- `B1.modals.past_forms` — had to, could, was/were able to, managed to

**B2**
- `B2.modals.speculation_past` — must have / might have / can't have / could have done (past deduction)

**Lower levels (for context)**
- `A1.can.ability`
- `A2.modals.should` and `must_have_to_basic` (already listed)

---

## Current Curriculum Content Analysis (`curriculum_modal_verbs.json`)

### What the current intro covers well:

| Meaning Area              | Covered? | Depth | Matches which root_id(s)                  | Notes |
|---------------------------|----------|-------|-------------------------------------------|-------|
| Ability                   | Yes      | Good  | A1.can.ability                            | Basic can/could |
| Permission                | Yes      | Medium| —                                         | can / may / could — not strongly tagged |
| Possibility / Speculation | Yes      | Medium| B1.modals.speculation_present             | may/might/could — decent but shallow |
| Obligation (strong)       | Yes      | Good  | A2.modals.must_have_to_basic              | must vs have to explained clearly |
| Advice / weak obligation  | Yes      | Good  | A2.modals.should                          | should / ought to |
| Past modals               | Weak     | Low   | B1.modals.past_forms + B2 past speculation| Very light coverage |
| Past speculation          | Almost none | None | B2.modals.speculation_past               | Major gap at B2 |

### Strengths in current content:
- Excellent distinction between **must** (speaker decision) vs **have to** (external).
- Good basic form rules (no -s, followed by base verb).
- Clear summary table by meaning.

### Weaknesses / Gaps vs Tree:
- Almost no dedicated treatment of **past deduction** (must have done, etc.) — this is a core B2 root_id.
- "Managed to" and "was able to" vs "could" are barely touched.
- No systematic progression from A2 → B1 → B2 within the modal system.
- Content is organized by "meaning" rather than by the Tree's level + root_id structure.

---

## Proposed Root ID Tagging for Existing Content

| Current Section / Question Area       | Suggested root_id(s)                  | Confidence | Action Needed |
|---------------------------------------|---------------------------------------|------------|---------------|
| Ability (can/could)                   | `A1.can.ability`                      | High       | Tag explicitly |
| Permission (can/may/could)            | Needs new or split                    | Medium     | May need light new root_id or note as pragmatic |
| Possibility (may/might/could)         | `B1.modals.speculation_present`       | High       | Strengthen + tag |
| Must vs Have to                       | `A2.modals.must_have_to_basic`        | High       | Already strong — just tag |
| Should / Advice                       | `A2.modals.should`                    | High       | Tag |
| Past forms (had to, could, managed to)| `B1.modals.past_forms`                | High       | Major expansion needed |
| Past deduction (must have done etc.)  | `B2.modals.speculation_past`          | High       | Currently almost missing — high priority to add |

---

## Recommendations for Pilot

1. **Add substantial new content** for `B2.modals.speculation_past` (this is one of the most testable B2 items in FCE-style exams).
2. Strengthen `B1.modals.past_forms` (managed to / was able to vs could).
3. Tag every section and key question in the curriculum file with the appropriate root_id(s).
4. Consider splitting the current single "Modal Verbs" topic into clearer sub-areas aligned with the Tree levels.

---

**Status**: Initial mapping complete. Ready for tagging work on the actual JSON files.