# How Teacher Links Will Work (Prescriptions from Marking / Feedback)

**Date**: 2026-05-28  
**Scope**: rue2-grok only (Tree as single source of truth for "teacher prescribes exact practice from marking form")  
**Status**: Deep links LIVE (2026-06-10). `#practice/root/<root>`, `#practice/root_id/<family-or-granular-id>` and `#practice/topic/<topic>` are wired in `js/app.js` (`routeHash`), powered by `root_content_index.json`, with a `menuRootPractice` landing panel and fail-soft fallback to the main menu. Verified end-to-end by `test/verify-deeplinks.js` (run `npm start`, then `node test/verify-deeplinks.js`).

## Vision (Long-term, Non-blocking)
- Marking form / Feedback docx (see Desktop/Marking_Template.md) tags errors to RUE2 topics or roots (e.g. "Verb Phrase", "Present Perfect", or granular "B1.present_perfect.since_for").
- Teacher (or automated) generates deep link from that tag.
- Student clicks link → loads **exact** relevant practice in the app (specific topic or filtered by root/root_id).
- No waiting for full C/D track or full tagging rollout.

## Current Implementation (Minimal Reversible Seed)
- **data/tree/tree.json**: Canonical 7 roots + 8 pilot families + concrete root_ids (source of truth for names/granular).
- **topics.json** (now normalized): 
  - All 31 topics tagged with `root` (canonical), some `secondary_root`, plus (for 8 pilots + phrasal) `primary_root`, `pilot_family`, `secondary_root`.
  - Fixes applied (examples of 5-10+ normalizations):
    - `sentence_ops` → `sentence_syntax` (inversion + it_subject; aligns tree.json).
    - `phrasal_verbs`: `root` changed to `prepositions_particles` + `secondary_root: "verb_complementation"` (per pilot_families_mapping + tree).
    - Added `primary_root` + `pilot_family` to 7+ pilot topics (modal_verbs, articles, prepositions, conditionals, reported_speech, relative_pronouns, present_perfect, phrasal) for consistency with pilot data.
- **data/tree/pilot_families_mapping.json + 8 *_root_id_mapping.md + pilot_root_id_summary.md**: Existing pilot work (8 families, key_root_ids, current vs tree placement). Referenced but not duplicated.
- **New: data/tree/root_content_index.json** (the delivered seed):
  - Maps every root (incl. sentence_syntax, outside_roots) + all 8 pilot_families.
  - For each: canonical_title, short_student_description, list of topics, curriculum_containers, practice_entry_points, deep_link example, granular_root_ids (for pilots).
  - Enables resolution of `#practice/root/verb_phrase`, `#practice/root/sentence_syntax`, `#practice/root_id/B1.present_perfect.since_for`, or topic-based.
- **Curriculum examples**: Partial root_id tagging live in ~10 files (prepositions*, articles*, modals, conditionals, relative, reported, phrasal, past_simple_present_perfect). Inversion.json received example `root_ids` + cefr for sentence_syntax (as normalization demo).
- **Single source**: Resolve all prescriptions via root_content_index + topics.json + tree.json. (Note: js/app.js + index.html still carry legacy duplicates/hardcodes — future build step to source from topics/index.)

## Link Resolution (How it Works Today / Tomorrow)
1. Marking notes topic/root/root_id (human or semi-auto from template).
2. Feedback generator (future) or manual: construct link using root_content_index lookup.
3. App router (future wiring): 
   - /#practice/root/verb_phrase → show all practice_entry_points for that root (or filter questions by root_ids in tagged currics).
   - /#practice/root_id/B1.modals.speculation_past → jump to specific sections/questions tagged with it (in modal_verbs etc.).
   - Fallback to topic id for immediate compatibility.
4. Student sees targeted cards/practice only. Progress diagnostics can use root coverage.

## Why This Doesn't Block Core UX
- All changes are additive / name normalizations (reversible with git revert or field deletion).
- Existing practice, quizzes, and UI continue to work (topics still have `root` field).
- Pilot tagging already present in key curricula; index provides the map without requiring 100% coverage.
- Outside pilots / sentence_syntax / outside_roots handled gracefully.
- Teacher can prescribe using either coarse root (quick) or fine root_id (precise) immediately via the index.

## Next (Non-urgent, After Core Stability)
- Wire root_content_index into js/curriculum.js + routing for deep links.
- Update schemas to require/validate root/primary/pilot fields.
- Batch-add root_ids to remaining curricula (using index + pilot mappings as guide).
- Teacher UI: "Prescribe this root" button on feedback review.
- Deprecate hard-coded lists in app.js/index.html in favor of loading from topics.json + this index (build step).
- Expand tree.json families beyond 8 pilots.

## References (Inside rue2-grok/)
- data/tree/tree.json, pilot_families_mapping.json, pilot_root_id_summary.md + all 8 *_mapping.md
- topics.json (post-normalization)
- root_content_index.json (the seed)
- Marking_Template.md (Desktop, read-only context)
- Existing tagged currics (e.g. curriculum_modal_verbs.json, curriculum_prepositions*.json)

This seed makes the Tree (topics + tree data) the unambiguous source for future prescriptions while keeping all current functionality intact.

---

*Keep changes small. Revert any field addition by deleting the key. The index is the contract for links.*