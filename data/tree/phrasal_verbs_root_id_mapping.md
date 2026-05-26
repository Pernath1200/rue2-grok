# Phrasal Verbs – Root ID Level Mapping (Pilot)

**Family**: Phrasal Verbs  
**Primary Root (per Tree model)**: ⑥ Prepositions & Particles  
**Secondary**: ⑤ Verb Complementation (in some cases)  
**Pilot Priority**: High (because current root assignment is slightly misaligned)

---

## Relevant root_ids from the Grammar Tree

**B1**
- `B1.phrasal_verbs.basic` — separable / inseparable basics (Primary: ⑥)

**B2**
- `B2.phrasal_verbs.extended` — three-part phrasal verbs, register-marked (Primary: ⑥)

**Notes from Tree docs**:
- The model places the core of phrasal verb learning under **Prepositions & Particles** rather than Verb Complementation.
- Current `topics.json` has it under `verb_complementation`. This is one of the clearest misalignments we found.

---

## Current Curriculum Content Analysis (`curriculum_phrasal_verbs.json`)

### What it covers:

- Definition of phrasal verbs (verb + particle with new meaning)
- Separable vs Inseparable (including pronoun rules) — **very good**
- Common particles and their general meanings (up, down, out, off, on, over)
- Typical student errors (word order + wrong particle)
- Good comparison diagram

### Strengths:
- Excellent practical focus on separability and pronoun position (one of the most common error areas for learners).
- Good examples.

### Weaknesses vs Tree model:
- No clear distinction between **B1 basic** and **B2 extended** (three-part, more idiomatic/register-sensitive).
- Very little on register or more advanced/collocational phrasal verbs.
- Current root assignment in `topics.json` puts it under Verb Complementation, while the Tree model puts primary responsibility under Prepositions & Particles.

---

## Proposed Root ID Tagging

| Current Content Area                    | Suggested root_id(s)             | Primary Root | Notes / Gaps |
|-----------------------------------------|----------------------------------|--------------|--------------|
| Basic separable/ inseparable + pronoun rules | `B1.phrasal_verbs.basic`        | ⑥           | Strong existing content — easy to tag |
| Common particles (up/down/out etc.)     | `B1.phrasal_verbs.basic`         | ⑥           | Mostly B1 level |
| Three-part phrasal verbs                | `B2.phrasal_verbs.extended`      | ⑥           | Currently very weak / missing |
| Register / stylistic phrasal verbs      | `B2.phrasal_verbs.extended`      | ⑥           | Major gap at B2 |
| Meaning differences (look up vs look after etc.) | Mix of B1 + B2              | ⑥ + ⑤      | Good examples exist — needs tagging + possible expansion |

---

## Key Finding

**Root assignment correction needed**:
- Current: `root: "verb_complementation"`
- Recommended: `primary_root: "prepositions_particles"`, with optional secondary in verb complementation for certain patterns.

This is one of the quickest high-value corrections we can make in the data model.

---

## Recommendations for Pilot

1. **Correct the root assignment** in `topics.json` for `phrasal_verbs`.
2. Add or significantly expand content for `B2.phrasal_verbs.extended` (three-part verbs and register).
3. Tag existing strong content (separability rules, common particles) with `B1.phrasal_verbs.basic`.
4. Consider whether some meaning distinctions belong partly under Verb Complementation as secondary.

**Status**: Initial mapping complete. This family is a good candidate for early tagging work because the content quality is high but the structural alignment is off.