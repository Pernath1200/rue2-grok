# Present Perfect – Root ID Level Mapping (Pilot)

**Family**: Present Perfect  
**Primary Root**: ① Verb Phrase  
**Pilot Priority**: High

---

## Relevant root_ids from the Grammar Tree (B1–B2 focus)

**A2**
- `A2.present_perfect.basic` — ever/never, just/already/yet

**B1**
- `B1.present_perfect.since_for` — Present perfect with since/for
- `B1.present_perfect.continuous` — Present perfect continuous

**Related (for comparison topics)**
- `A2.past_simple.full_system`

---

## Current Topics

- `present_perfect` — "Tenses: Present Perfect Simple vs Continuous"
- `past_simple_present_perfect` — "Tenses: Past Simple vs Present Perfect"

**Current root assignment**:
- Both: `verb_phrase`

---

## Current Curriculum Content Analysis

### `curriculum.json` (main Present Perfect topic)
Covers:
- Result vs duration distinction
- Stative verbs
- since/for (but not deeply)
- Present perfect continuous for ongoing/recent activity with visible results

### `curriculum_past_simple_present_perfect.json`
Covers comparison between past simple and present perfect, with good focus on "finished time" vs "unfinished time / life experience".

### Strengths:
- Solid conceptual explanations for the core distinction (result vs activity/duration).
- Good error examples.

### Weaknesses vs Tree:
- The critical B1 distinctions (`since_for` and `continuous`) are not separated clearly enough into their own root_ids.
- Limited dedicated content for `B1.present_perfect.since_for` (rules + common errors).
- Present perfect continuous is present but not strongly differentiated from simple in a structured way.

---

## Proposed Root ID Tagging

| Current Content Area                          | Suggested root_id(s)                        | Notes |
|-----------------------------------------------|---------------------------------------------|-------|
| Basic present perfect (ever/never, just/already/yet) | `A2.present_perfect.basic`                 | Good foundation |
| since / for distinction                       | `B1.present_perfect.since_for`             | Needs strengthening |
| Present perfect continuous (duration, recent activity, visible results) | `B1.present_perfect.continuous`     | Needs more dedicated practice |
| Past Simple vs Present Perfect comparison     | Mix of `A2.past_simple.full_system` + `A2.present_perfect.basic` + `B1.present_perfect.since_for` | Currently the strongest part |

---

## Recommendations for Pilot

- Split or clearly section the current content around the three main B1/A2 root_ids.
- Add more targeted exercises for `since/for` vs other time expressions.
- Significantly expand practice distinguishing simple vs continuous at B1 level.
- This family is one of the highest value for students and has decent existing content that can be restructured with relatively low effort.

**Status**: Initial mapping complete. Ready for detailed tagging.