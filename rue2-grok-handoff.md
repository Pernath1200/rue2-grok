# rue2-grok session handoff — 2026-06-12

## What was done this session

### Engine work (merged to master)

| Area | What shipped |
|---|---|
| Spaced repetition | `saveMemoryBankEntry` / `getDueReviews` with Leitner intervals (1→3→7→14→30 days); `startReviewQuiz`; review button on home menu |
| Lesson flow | `advanceCourseToNext` / `advancePart2ToNext`; `startLessonAfterIntro`; `lessonOrder` array; Continue button restores last position |
| Progress portability | `exportProgress` / `importProgress` (JSON download/upload); Import button on menu |
| Audit gate | `gateAgainstBaseline` in `audit_questions.js` + `audit_baseline.json` (135 triaged flags); prevents regressions in question data |
| 4 new diagram types | `decision` (yes/no flowchart), `examples` (✓/✗ pairs with auto-strikethrough), `chips` (word-set badges), `callout` (flagged note box) |
| Bullet lists in content | `renderIntroContentHtml` now parses `- ` lines into real `<ul>` elements |
| House style | `docs/INTRO_STYLE.md` — spec for visual-first intro sections |
| Tooling | `scratch/intro-preview.js` (standalone HTML preview harness); `scratch/apply_question_fixes.js` |
| Tests | `test/review.spec.js` (spaced repetition e2e); `test/portability.spec.js` (export/import e2e); smoke.spec.js updates |
| SW / footer | Cache v63; footer badge v63 |

### Intro conversion (on branch, CI green, NOT yet on master)

Branch `claude/confident-noether-9316ur` — 6 commits ahead of master.

All 33 `curriculum_*.json` intros converted to visual-first style:
- ~409 visuals added (tables, decision flowcharts, formulas, timelines, comparisons, examples cards, chips, callouts)
- Prose roughly halved per section; ≤ 400-500 chars budget enforced
- Czech-contrast notes (`callout style:"cz"`) kept/extracted throughout
- 3 showcase intros (modal verbs, articles, conditionals) were done earlier and are already on master; the remaining 30 are on this branch

## What is in progress / next steps

### Step 1 — Merge branch to master (immediate)

The intro conversion branch is ready: CI green, spot-check previews looked good.
No conflicts expected (different JSON files from the master showcase set).

```bash
git checkout master
git merge --no-ff claude/confident-noether-9316ur
git push origin master
```

### Step 2 — Grammar Tree visual correction (planned, not started)

Plan file: `/root/.claude/plans/okay-so-here-is-precious-clock.md`

Two agreed problems with the tree SVG (`renderSimpleTreeOverview` in `js/app.js:971–1248`):

1. **Junction is "umbrella on stick"**: trunk (152 px wide) pinches to ~30 px tap root at ground; no root collar.
2. **Wrong palette**: cream/brown mockup colors instead of the app's dark/cyan theme (`#0d0d0d` / `#569cd6`).

Work is fully scoped in the plan file. Key constraints:
- Keep `[data-tap-progress]`, `data-deeplink`, `data-root-id`, `data-family`, `<title>` wording verbatim (test suite assertions)
- Keep knot radius math `kr = 7.5 + 4.5*fProg` unchanged

Two commits: (1) `limbChain` + junction geometry; (2) reskin.
Verification: Playwright screenshot harness (`scratch/tree-shot.js`, deleted before commit) + `npm run test` + `npm run test:e2e`.

## State at handoff

| Item | Status |
|---|---|
| Branch `claude/confident-noether-9316ur` | CI green, 6 commits ahead of master, ready to merge |
| Master | Has engine + 3 showcase intros only |
| Grammar Tree plan | Fully scoped in plan file, not yet implemented |
| All tests | Green on branch |

## Key files to know

- `js/app.js:971–1248` — `renderSimpleTreeOverview` (tree SVG)
- `js/curriculum.js` — `renderDiagram`, `limbChain`, lesson flow
- `js/storage.js` — Leitner spaced repetition, export/import, audit gate
- `js/quiz.js` — `startReviewQuiz`, `finishQuiz`
- `docs/INTRO_STYLE.md` — intro authoring spec
- `scratch/intro-preview.js` — run `node scratch/intro-preview.js curriculum_X.json` to preview any intro as standalone HTML
