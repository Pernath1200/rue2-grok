# Prepositions – Root ID Level Mapping (Pilot)

**Family**: Prepositions  
**Primary Root**: ⑥ Prepositions & Particles  
**Pilot Priority**: Medium

---

## Relevant root_ids

**A1**
- `A1.prepositions.place_basic`

**A2**
- `A2.prepositions.time_basic`
- `A2.prepositions.movement`

**B1**
- `B1.prepositions.cause_concession`

**B2**
- `B2.prepositions.complex` — compound prepositions
- `B2.collocations.dependent_prepositions` (noted in the model as substantially trunk/collocational material)

---

## Current Curriculum Analysis

Current topics:
- `prepositions`
- `prepositions_dependent`

The project already has a good split between general prepositions and dependent prepositions.

**Strengths**:
- Solid coverage of basic time/place/movement.
- Dedicated treatment of dependent prepositions (important for exams).

**Gaps vs Tree**:
- `B1.prepositions.cause_concession` (because of, due to, owing to, despite, in spite of) is not strongly isolated.
- B2 complex prepositions are light.
- The model notes that many "dependent preposition" items are actually collocational (trunk) rather than pure rule-based (root). This nuance is not currently reflected.

---

## Proposed Root ID Tagging

| root_id                                   | Level | Current Topic            | Notes |
|-------------------------------------------|-------|--------------------------|-------|
| `A1.prepositions.place_basic`             | A1    | `prepositions`           | Good |
| `A2.prepositions.time_basic` + movement   | A2    | `prepositions`           | Good |
| `B1.prepositions.cause_concession`        | B1    | `prepositions` / dependent | Needs more focus |
| `B2.prepositions.complex`                 | B2    | `prepositions_dependent` | Expand |
| Dependent prepositions (many)             | B2    | —                        | Consider dual tagging as trunk collocations |

**Status**: Initial mapping complete. One of the families where the Tree model introduces useful nuance (rule vs collocation) that the current system doesn't yet capture.