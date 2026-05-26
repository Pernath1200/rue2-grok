# Conditionals – Root ID Level Mapping (Pilot)

**Family**: Conditionals  
**Primary Root**: ④ Clause Linking  
**Secondary Root**: ① Verb Phrase (tense choice)  
**Pilot Priority**: High (excellent example of cross-root family)

---

## Relevant root_ids

**A2**
- `A2.conditionals.zero_first` (secondary ①)

**B1**
- `B1.conditionals.second` (secondary ①)
- `B1.conditionals.wishes_present` (secondary ①)

**B2**
- `B2.conditionals.third` (secondary ①)
- `B2.conditionals.mixed` (secondary ①)
- `B2.conditionals.variants` (provided that, unless, as long as, in case, otherwise)

---

## Current Curriculum Analysis (`curriculum_conditionals.json`)

**Strengths**:
- Very clear explanations of all four main types.
- Good "at a glance" table.
- Strong error correction examples (especially first and third conditional if-clause mistakes).

**Gaps vs Tree**:
- Does not yet separate the B1 and B2 root_ids clearly (e.g. second conditional + wishes vs third + mixed + variants).
- Wishes (`wish` + past / past perfect) are mentioned lightly but not given proper weight as B1/B2 root_ids.
- The cross-root nature (clause linking + verb phrase tense selection) is not explicitly taught.

---

## Proposed Root ID Tagging

| Content Area                        | Suggested root_id(s)                     | Primary | Secondary |
|-------------------------------------|------------------------------------------|---------|-----------|
| Zero + First conditional            | `A2.conditionals.zero_first`            | ④       | ①         |
| Second conditional                  | `B1.conditionals.second`                | ④       | ①         |
| wish + past simple                  | `B1.conditionals.wishes_present`        | ④       | ①         |
| Third conditional                   | `B2.conditionals.third`                 | ④       | ①         |
| Mixed conditionals                  | `B2.conditionals.mixed`                 | ④       | ①         |
| Variants (unless, provided that...) | `B2.conditionals.variants`              | ④       | ①         |

---

## Recommendations

This family is one of the best candidates to demonstrate **dual tagging** in the new system. The existing content is already quite strong, so the main work is re-structuring and explicit root_id tagging rather than writing large amounts of new material.

**Status**: Initial mapping complete. Good candidate for early implementation.