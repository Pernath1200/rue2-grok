# Pilot Families Mapping – RUE2-Grok Phase 1

**Date**: 2026-05-26  
**Status**: Initial analysis  
**Goal**: Map the 8 chosen pilot families from the current system into the new Grammar Tree model.

## Pilot Families (Confirmed)

1. Present Perfect (Simple vs Continuous + since/for)
2. Conditionals (Zero → Third + variants)
3. Relative Pronouns / Clauses
4. Reported Speech
5. Modal Verbs (especially speculation present/past)
6. Phrasal Verbs
7. Articles / Determiners (basic + advanced)
8. Prepositions (general + dependent)

---

## Current vs Proposed Mapping

### 1. Present Perfect

**Current Topics**:
- `present_perfect` — "Tenses: Present Perfect Simple vs Continuous"
- `past_simple_present_perfect` — "Tenses: Past Simple vs Present Perfect"

**Current root assignment**:
- Both: `verb_phrase`

**Tree Model Placement**:
- Primary Root: **verb_phrase**
- Key root_ids involved:
  - `A2.present_perfect.basic`
  - `B1.present_perfect.since_for`
  - `B1.present_perfect.continuous`
  - Related: `A2.past_simple.full_system`, etc. (for comparison topics)

**Notes / Gaps**:
- The current split between two topics is reasonable.
- The Tree model makes a clear distinction between "basic" present perfect and the more nuanced `since_for` and `continuous` uses.
- Current curriculum content is quite good but not yet tagged at this granularity.

**Recommended Action**:
- Keep two topics for now (or merge into one "Present Perfect" family with clear sub-sections).
- Tag content with the specific root_ids above.

---

### 2. Conditionals

**Current Topic**:
- `conditionals` — "Tenses: Conditionals (Zero, First, Second, Third)"

**Current root assignment**:
- Primary: `clause_linking`
- Secondary: `verb_phrase`

**Tree Model Placement**:
- Primary Root: **clause_linking**
- Strong secondary involvement in **verb_phrase** (tense choice is critical)
- Key root_ids:
  - `A2.conditionals.zero_first`
  - `B1.conditionals.second`
  - `B1.conditionals.wishes_present`
  - `B2.conditionals.third`
  - `B2.conditionals.mixed`
  - `B2.conditionals.variants`

**Notes / Gaps**:
- This is one of the best examples of a family that legitimately spans two roots.
- Current content is solid but treats conditionals mostly as a "tense" topic rather than a clause-linking + verb phrase phenomenon.

**Recommended Action**:
- Strong candidate for dual tagging in the new model.
- Good pilot for demonstrating cross-root relationships.

---

### 3. Relative Pronouns / Clauses

**Current Topic**:
- `relative_pronouns`

**Current root assignment**:
- `clause_linking`

**Tree Model Placement**:
- Primary Root: **clause_linking**
- Key root_ids:
  - `A2.relative_clauses.basic`
  - `B1.relative_clauses.defining_non_defining`

**Notes**:
- Relatively clean mapping.
- Content is already quite focused.

---

### 4. Reported Speech

**Current Topic**:
- `reported_speech`

**Current root assignment**:
- Primary: `clause_linking`
- Secondary: `verb_phrase`

**Tree Model Placement**:
- Primary Root: **clause_linking**
- Secondary: **verb_phrase** (tense backshift)
- Key root_ids:
  - `B1.reported_speech.statements`
  - `B2.reported_speech.extended`

**Notes**:
- Another good example of cross-root family.
- Current secondary tagging already aligns reasonably well with the Tree.

---

### 5. Modal Verbs

**Current Topic**:
- `modal_verbs`

**Current root assignment**:
- `verb_phrase`

**Tree Model Placement**:
- Primary Root: **verb_phrase**
- Key root_ids:
  - `A1.can.ability`
  - `A2.modals.should`
  - `A2.modals.must_have_to_basic`
  - `B1.modals.speculation_present`
  - `B1.modals.past_forms`
  - `B2.modals.speculation_past`

**Notes**:
- Very large and important family.
- Current content mixes ability, advice, obligation, and speculation.
- The Tree model wants clearer separation by function and level.

**Recommended Action**:
- High value for splitting/tagging more granularly in Phase 1.

---

### 6. Phrasal Verbs

**Current Topic**:
- `phrasal_verbs`

**Current root assignment**:
- `verb_complementation`

**Tree Model Placement**:
- Primary Root: **prepositions_particles**
- Secondary: **verb_complementation** (in some cases)

**Notes**:
- Current root assignment is slightly off according to the Tree model.
- The Tree places core phrasal verb work primarily under Prepositions & Particles.

**Gap**: This is a good example where the current coarse `root` field doesn't match the more considered Tree model.

---

### 7. Articles / Determiners

**Current Topics**:
- `articles`
- `articles_advanced`

**Current root assignment**:
- Both: `noun_phrase`

**Tree Model Placement**:
- Primary Root: **noun_phrase**
- Key root_ids:
  - `A1.articles.basic`
  - `B1.articles.extended`
  - `B2.articles.advanced`

**Notes**:
- Clean mapping.
- Splitting into basic + advanced is already good practice.

---

### 8. Prepositions

**Current Topics**:
- `prepositions`
- `prepositions_dependent`

**Current root assignment**:
- `prepositions_particles`

**Tree Model Placement**:
- Primary Root: **prepositions_particles**
- Key root_ids:
  - `A1.prepositions.time_basic` / `place_basic`
  - `A2.prepositions.time_basic` / `movement`
  - `B1.prepositions.cause_concession`
  - `B2.prepositions.complex`

**Notes**:
- Strong alignment.
- Dependent prepositions are well handled.

---

## Summary of Initial Findings

| Family                    | Current Root Alignment | Needs Work? | Priority for Tagging |
|---------------------------|------------------------|-------------|----------------------|
| Present Perfect           | Good                   | Medium      | High                 |
| Conditionals              | Good (already dual)    | Low         | High                 |
| Relative Pronouns         | Good                   | Low         | Medium               |
| Reported Speech           | Good (already dual)    | Low         | Medium               |
| Modal Verbs               | Good                   | High        | Very High            |
| Phrasal Verbs             | Slightly off           | High        | High                 |
| Articles / Determiners    | Good                   | Low         | Medium               |
| Prepositions              | Good                   | Low         | Medium               |

**Biggest immediate opportunities**:
- Fix Phrasal Verbs root assignment
- Add much more granular root_id tagging, especially for Modals and Present Perfect
- Use Conditionals and Reported Speech as models for how to handle cross-root families

---

**Next Actions**:
- Review this mapping
- Decide on exact root_id targets for each family (we can pull from the Master Index)
- Begin creating tagged versions or mapping files for the pilot content

---

*This document will be updated iteratively as we tag content.*