# RUE2 Grok — Handoff Summary

**Date**: 2026-05-28  
**Project**: rue2-grok (vanilla JS SPA for B1/B2 Czech students of English grammar)  
**Workspace**: `Documents/projects/rue2-grok/` (do **not** touch the near-duplicate `rue2.cz/` folder)  
**User Goal**: Make the app dramatically less frustrating and more usable for students + teacher prescription workflows.

---

## Core Philosophy & Constraints

- **Primary goal**: Minimize cognitive load so brain energy stays on grammar, not on fighting the UI.
- **Key requirements**:
  - Reliable keyboard-first navigation (forwards/back/Esc/Enter everywhere, no dead ends).
  - Clean, minimalist dark "underground" aesthetic (cyan accent `#569cd6`, low contrast).
  - Truthful progress (no lying counters, no endless drills).
  - Teacher can eventually prescribe specific practice from existing docx feedback forms (via links that map errors → roots/topics).
- **Recent rule**: Only work in `rue2-grok/` this weekend.
- **User's explicit priority order**: **A first, then B + D/C** (in parallel where possible).

---

## Major Work Completed (A → BDC Push)

### A. Harmonious Navigation Bars (Highest Priority — Completed)

**Problem**: Global nav lived inside `#menuScreen` (hidden on quiz/intro/result screens). Quiz and content screens used inconsistent, chunkier button rows (`.quiz-nav-row`, `.intro-button-row`, etc.).

**Solution implemented**:
- Created a unified `.util-bar` CSS class with the same pleasant slim treatment as the original global nav (thin cyan-tinted borders, small ~0.78rem font, transparent buttons, subtle dark background, rounded).
- Applied the consistent bar treatment to:
  - Quiz screen (with live context: **Topic** · X/Y)
  - Intro screens
  - Result screen
  - Section complete
  - All reference screens (prepositions list, phrasal verbs, reference index)
  - Topic select back button
  - Practice setup
- Added light context labels on active practice screens.
- Hardened several exits to prefer `NAV.back()` / `NAV.navigate('menuMain')`.
- "Back" labels standardized with ← where appropriate.

**Result**: Every screen now has action bars of roughly the same visual weight and aesthetic. Much more cohesive and pleasant.

**Key files**:
- `index.html` (CSS + HTML structure for all bars)
- `js/app.js` (some wiring + `setContentContext` helper)
- `js/quiz.js` (live progress/context in `updateQuizProgress`)

---

### B. Tree Aesthetics & Polish (Completed + Deeper Polish)

**Previous state**: Tree was cramped, labels overlapped, used debug markers, progress calc was fragile.

**Work done**:
- Increased canvas to 920×620 viewBox with scaled root lengths and better breathing room.
- Removed all debug elements (`#treeDebugInfo` div, internal debug text, vXX markers).
- Significantly improved labels:
  - Stronger side-specific offsets and stagger.
  - `appendMultilineLabel` helper using `<tspan>` + `dy` for long names (e.g. "Relative Pronouns & Clauses").
- Nodes now visually respond to real user progress (dynamic radius, stroke, brightness).
- Added keyboard focus/blur highlighting on clickable family nodes.
- Strengthened real-progress calculation (better memory bank + `getProgressStats()` integration, per-family tracking, improved tap_root boost).
- Added minimal helpful hints (bottom legend + top-right "click any family").

**Current state**: The Tree is now clearly larger, readable, pleasant, and feels "alive" with the user's actual practice data. Clickable families still route through NAV.

**Key file**: `js/app.js` → `renderSimpleTreeOverview()` (and related helpers).

---

### C/D. Content Quality + Structure / Mapping (Significant Progress)

#### Content + Pedagogy (Prepositions Consolidation)

**Major win**: `curriculum_prepositions.json`
- Reduced from 13 fragmented micro intro sections → **7 high-quality cards**.
- Each card now follows good pedagogy:
  - Roots-first framing (explicitly references Tree Model root #6).
  - "**Why it matters**" section on every card.
  - Clear contrast examples (not undifferentiated bullet lists).
  - Direct links/funnels to the existing rich practice blocks (guided_mc, various gapfills, etc.).
  - `root_ids` + `cefr_level` added to every card.
- Preserved all important distinctions and tables (at/on/in time & place) while dramatically lowering cognitive load.

**Quick parallel win**: `curriculum_auxiliary_verbs.json`
- Consolidated 7 → 5 intro sections (merged the repeated "Common mistakes (1/2/3)" into one strong card).
- Added consistent `root_ids` (under `verb_phrase`) + `cefr_level` to all sections.

#### Structure + Root Tagging + Prescription Foundation

**Audit + Normalizations** (in `topics.json`):
- Fixed non-canonical names: `sentence_ops` → `sentence_syntax` (inversion + it_subject).
- Re-aligned `phrasal_verbs`: now correctly uses `prepositions_particles` as primary root + `verb_complementation` as secondary (per pilot work + Tree Model).
- Added `primary_root` + `pilot_family` fields to the 8 pilot topics + phrasal for better alignment with `pilot_families_mapping.json`.

**New Seed Files for Teacher Prescriptions** (big step toward long-term vision):

1. **`data/tree/root_content_index.json`** (the core deliverable)
   - Maps every root (including `sentence_syntax`, `outside_roots`) + all 8 pilot families.
   - For each: canonical title, short student description, topics, curriculum containers, practice entry points, example deep links.
   - Supports both coarse root links (`#practice/root/verb_phrase`) and granular root_id links.

2. **`data/tree/how_teacher_links_will_work.md`**
   - Excellent 1-page explanation of the prescription vision, current state, link resolution strategy, and non-blocking nature of the work.

**Example tagging added**:
- `curriculum_inversion.json` received sample `root_ids` + `cefr_level` using the now-canonical `sentence_syntax`.

---

## Key Files Changed / Created (Recent Session)

**New**:
- `data/tree/root_content_index.json`
- `data/tree/how_teacher_links_will_work.md`
- `RUE2_GROK_HANDOFF_SUMMARY.md` (this file)

**Heavily updated**:
- `index.html` (navigation unification + tree container)
- `js/app.js` (NAV improvements, tree rendering, context helpers)
- `js/quiz.js` (quiz bar context)
- `curriculum_prepositions.json` (7-card version)
- `curriculum_auxiliary_verbs.json` (consolidated + tagged)
- `topics.json` (multiple root normalizations)
- `curriculum_inversion.json` (example tagging)

**Important reference files** (read these):
- `_reference/Tree_Model_Of_Language_Proficiency.md`
- `CONTENT_AUTHORING_GUIDE.md`
- `data/tree/pilot_families_mapping.json` + the 8 `*_root_id_mapping.md` files
- `data/tree/tree.json`

---

## Current State & Recommendations for Next AI

### Strengths Right Now
- Navigation feels much more cohesive and reliable.
- The Grammar Tree is visually pleasant and interactive.
- Prepositions intro is now a **model** of good low-load design (study it).
- Solid foundation exists for teacher prescription links (`root_content_index.json`).

### Recommended Next Priorities (in rough order)
1. **Stabilize & test** the new navigation + tree thoroughly (hard refresh + full flows).
2. **Wire the prescription system** (use `root_content_index.json` to power deep links like `#practice/root/...`).
3. Continue content consolidation on other fragmented curricula (using the new prepositions version as the gold standard).
4. Batch-add `root_ids` to more curricula using the pilot mapping files + new index as guide.
5. Reduce duplication (topics list still lives in `js/app.js` + `index.html` in addition to `topics.json`).

### Working Style Notes
- User is time-poor but willing to invest heavily when progress feels real and broad.
- Strongly prefers **visible, broad progress** over tiny perfect things.
- Likes using subagents for parallel exploration/planning/implementation, but is now credit-conscious.
- Values the Tree Model deeply — all content and structure work should reference it.

---

## How to Continue Effectively

When you start in Claude (or any other tool):

1. Read this summary + `data/tree/how_teacher_links_will_work.md`
2. Read the Tree Model document
3. Hard refresh the app and explore the current state (especially Prepositions intro and the Tree)
4. Ask the user what their single highest priority is for the next session (they may want to stay narrow while credits are low)

---

**This handoff should let another AI pick up the thread with minimal ramp-up time.**

Good luck — the project has made real, visible progress in the last push. The foundation for both student experience and teacher prescription workflows is noticeably stronger than it was 48 hours ago.