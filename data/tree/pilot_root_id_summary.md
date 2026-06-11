# Pilot Families – Consolidated Root ID Tagging Summary

**Date:** 2026-05-26  
**Phase:** 1.3  
**Scope:** 8 Pilot Families (B1–B2 focus)

This document provides a single overview of tagging recommendations across all pilot families. It is the master reference for implementation.

> **Canonical vocabulary:** Every valid `root_id` is enumerated in [`root_ids_canonical.json`](root_ids_canonical.json). That registry is the single source of truth — `test/validate-data.js` (section 8) fails if any `curriculum_*.json` uses a `root_id` not listed there. To introduce a new id, add it to the registry under its family **first**, then tag content with it. This table is guidance; the registry is law.

## Summary Table

| # | Family                        | Current Topics                              | Current Root(s)              | Primary Root (Tree)     | Secondary Root | Key root_ids (B1/B2 focus)                                      | Tagging Priority | Recommended Action |
|---|-------------------------------|---------------------------------------------|------------------------------|-------------------------|----------------|------------------------------------------------------------------|------------------|--------------------|
| 1 | Present Perfect              | `present_perfect`, `past_simple_present_perfect` | `verb_phrase`               | verb_phrase            | —              | `B1.present_perfect.since_for`, `B1.present_perfect.continuous` | Very High       | Add root_ids to sections + strengthen since/for and continuous content |
| 2 | Conditionals                 | `conditionals`                              | `clause_linking` + `verb_phrase` | clause_linking        | verb_phrase    | `B1.conditionals.second`, `B1.conditionals.wishes_present`, `B2.conditionals.third`, `B2.conditionals.mixed`, `B2.conditionals.variants` | High            | Explicit dual tagging + better separation of B1 vs B2 root_ids |
| 3 | Relative Pronouns / Clauses  | `relative_pronouns`                         | `clause_linking`            | clause_linking         | —              | `B1.relative_clauses.defining_non_defining`, `B2.relative_clauses.advanced` | Medium          | Add root_ids; expand B2 advanced features |
| 4 | Reported Speech              | `reported_speech`                           | `clause_linking` + `verb_phrase` | clause_linking        | verb_phrase    | `B1.reported_speech.statements`, `B2.reported_speech.extended`   | Medium          | Dual tagging + expand B2 reporting verbs & questions |
| 5 | Modal Verbs                  | `modal_verbs`                               | `verb_phrase`               | verb_phrase            | —              | `B1.modals.speculation_present`, `B1.modals.past_forms`, `B2.modals.speculation_past` | Very High       | Major expansion needed for B2 past speculation + tagging |
| 6 | Phrasal Verbs                | `phrasal_verbs`                             | `verb_complementation`      | prepositions_particles | verb_complementation | `B1.phrasal_verbs.basic`, `B2.phrasal_verbs.extended`           | High            | **Correct root assignment** + add B2 extended content |
| 7 | Articles / Determiners       | `articles`, `articles_advanced`             | `noun_phrase`               | noun_phrase            | —              | `B1.articles.extended`, `B2.articles.advanced`                   | Medium          | Tag existing split; fill remaining B2 gaps |
| 8 | Prepositions                 | `prepositions`, `prepositions_dependent`    | `prepositions_particles`    | prepositions_particles | —              | `B1.prepositions.cause_concession`, `B2.prepositions.complex`, `B2.collocations.dependent_prepositions` | Medium          | Distinguish rule-based vs collocational items |

---

## Tagging Mechanism (Proposed)

For Phase 1, we will use this lightweight approach:

### In `curriculum_*.json` files
Add to relevant sections and questions:

```json
{
  "root_ids": ["B1.present_perfect.since_for"],
  "cefr_level": "B1"
}
```

- `root_ids` can be an array (to support dual tagging).
- `cefr_level` is the primary level for that piece of content.

### In `topics.json`
Enhance each pilot entry with:

```json
{
  "primary_root": "verb_phrase",
  "secondary_roots": [],
  "pilot_family": true
}
```

### In `questions.json`
Add to individual questions when possible:

```json
{
  "root_ids": ["B2.modals.speculation_past"],
  "cefr_level": "B2"
}
```

---

## Implementation Notes

- **Highest priority for tagging right now**: Modal Verbs and Phrasal Verbs (biggest gaps + high student impact).
- **Quick structural win**: Fix Phrasal Verbs root assignment in `topics.json`.
- **Documentation**: All detailed per-family analysis lives in the individual `*_root_id_mapping.md` files in this folder.

---

*This is a living document. It will be updated as tagging progresses.*