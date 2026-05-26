# RUE2 Development Roadmap

Living development plan for **rue2.cz** — an English grammar practice and exam-style quiz app for Czech learners (B1–B2).

Last updated: 2026-03-28

---

## Current state

| Aspect | Status |
|--------|--------|
| App entry | Single `index.html` (~4,330 lines: inline CSS + HTML + JS) |
| Topics | 29 grammar topics registered in `manifest.json` |
| Question bank | `questions.json` (keyed by topic), 29+ `curriculum_*.json` files |
| Exam tasks | Open cloze, word formation, sentence transformation (tiered difficulty) |
| Reference | Phrasal verb dictionary, prepositions list, 9 `reference_*.json` sheets |
| Storage | `localStorage` for scores, progress, memory bank, flagged questions |
| Navigation | Hash routing (`#topic/<id>`), screen visibility toggles |
| PWA | `pwa-manifest.json` and `sw.js` exist, but SW is unregistered on boot |
| Themes | Two dark themes (Tokyo Night default, `theme-cursor` black/minimal) |
| Build tools | None — no bundler, no `package.json`, no `node_modules` |
| Tests | None |
| CI/CD | None |
| Servers | `python -m http.server` (port 8080) or `node server.js` (port 5555) |

### Key files

| File | Role |
|------|------|
| `index.html` | Monolithic app: all CSS, HTML, and JS inline |
| `manifest.json` | Topic registry (id, title, curriculum file, questions key) |
| `questions.json` | Central question bank — one top-level key per topic |
| `curriculum_*.json` (×29+) | Per-topic guided lessons: intro, check, practice |
| `exam_open_cloze.json`, `exam_open_cloze_free.json` | Open cloze exam pools |
| `exam_word_formation.json` | Word formation exam pool |
| `exam_sentence_transformation.json` | Key-word transformation exam pool |
| `mixed_cloze.json` | Cross-topic diagnostic / practice pool |
| `reference_*.json` (×9) | Reference sheets (modals, prepositions, word formation, etc.) |
| `phrasal_verbs_dictionary.json` | Phrasal verb dictionary data |
| `prepositions_list.json` | Prepositions reference list |
| `writing_tips.json` | Writing tips content and quiz |
| `sw.js` | Service worker (currently pass-through, no caching) |
| `pwa-manifest.json` | Web app manifest |
| `server.js` | Minimal Node static file server |
| `audit_questions.js` | Question audit script (Node) |
| `.cursor/rules/question-quality.mdc` | Cursor rule for question authoring |
| `.cursor/rules/spelling-questions.mdc` | Cursor rule for spelling questions |

---

## Design Principles & Intro Card Schema

Product and content guidance for **guided intro** flows and overall UX. This complements `.cursor/rules/question-quality.mdc` and `.cursor/rules/spelling-questions.mdc`, which focus on **Further Practice** items in `questions.json`; the schema below applies to **intro steps** inside `curriculum_*.json` (and the same spirit applies elsewhere in the app).

### Design Principles

**Core philosophy:** Minimalist, clean, noise-free. Every screen promotes focus and clarity with minimal mental disturbance.

- **No scrolling on any single screen** — if content doesn't fit, split into multiple pages/cards.
- **One idea per screen** — one rule, one example, one contrast.
- **Calm transitions** — swipe or tap to advance, no jarring layout shifts.
- **Generous whitespace** — content should breathe.
- **Page indicators on multi-card sequences** (e.g. `2 / 5`).
- **Minimal UI chrome** — hide anything not immediately relevant.
- **Clear progression path:** Intro cards → Check questions → Guided MC practice → Further Practice (type-in).
- Prefer bullet points over prose where content is a list of rules, patterns, or examples.
- Use tables/diagrams for any "compare A vs B vs C" or "three types of X" pattern — tables are always clearer than prose for parallel structures.
- One "see Reference" pointer card at the end of each intro sequence — do not repeat reference links on individual cards.
- No "Quick summary" prose cards — if a summary table/diagram exists, that is the summary.
- Typical errors cards should use a consistent wrong/right format with the wrong version in italics and the correct version in bold.

### Intro Card Schema

Each intro step in `curriculum_*.json` should have these fields:

| Field | Description |
|--------|-------------|
| `type` | One of `rule`, `contrast`, `czech_warning`, `tip`, `summary`. |
| `title` | Short heading (max ~6 words). |
| `body` | Main content (max ~60 words — must fit on screen without scrolling). |
| `example` | *(optional)* One example sentence with the target structure highlighted. |
| `incorrect` | *(optional, for `contrast` and `czech_warning` types)* The common wrong version. |

Implementation note: today many curriculum files use a simpler `intro.sections[]` shape (`title`, `content`, optional `diagram`). Evolving toward this schema is a **target** for new or refactored topics; do not bulk-rewrite existing curriculum unless a dedicated migration is planned.

---

## Phase 1 — Code quality and maintainability

Goal: make the codebase navigable, testable, and easier to work with.

### 1.1 Split `index.html` into separate files

The monolithic file should become:

| New file | Contents |
|----------|----------|
| `index.html` | HTML structure only (~400 lines), `<link>` to CSS, `<script type="module">` to JS |
| `styles.css` | All CSS from the current `<style>` block (~300 lines) |
| `js/app.js` | Entry point: imports modules, runs `init()`, wires global event listeners |
| `js/storage.js` | `STORAGE_KEY`, `MEMORY_KEY`, `migrateStorageKeys()`, score/memory helpers, `getProgressStats()` |
| `js/quiz.js` | `showQuestion()`, `submitAnswer()`, `answerMatches()`, `finishQuiz()`, retry logic |
| `js/exam.js` | Open cloze, word formation, and sentence transformation flows |
| `js/reference.js` | Reference loaders, prepositions list, phrasal verbs dictionary, print |
| `js/ui.js` | `showMenuPanel()`, `renderMenu()`, screen transitions, `escapeAndBold()`, `toTitleCase()` |
| `js/curriculum.js` | `startPart1()`, `startPart2()`, intro rendering, section navigation |

After the split, update `server.js` MIME map to serve `.css` (already present) and ensure cache headers work for development.

### 1.2 Consolidate duplicate logic

Patterns to unify:

- **Screen transitions**: replace all manual `getElementById(...).classList.add/remove('hidden')` with a single `showScreen(screenId)` function that hides all top-level screens and shows the target. `showMenuPanel()` already handles menu sub-panels; extend the pattern to the 9 top-level screens (`menuScreen`, `quizScreen`, `examClozeTestScreen`, `examTransformTestScreen`, `introScreen`, `sectionCompleteScreen`, `resultScreen`, `prepositionsListScreen`, `phrasalVerbsDictionaryScreen`, `referenceScreen`).
- **Curriculum loading**: `startPart1()` and `startPart2()` both fetch and parse the curriculum JSON with near-identical error handling. Extract a shared `loadCurriculum(topic)` that returns the parsed object and caches it.
- **Fetch wrapper**: create `fetchJSON(url)` that handles cache-busting, `no-store`, JSON parse, and the "HTML response" error detection in one place.

### 1.3 Rename `manifest.json` to `topics.json`

The current `manifest.json` is the topic registry, not the PWA manifest (`pwa-manifest.json`). Rename it to avoid confusion:

- Rename the file on disk
- Update `init()` fetch URL: `manifest.json?v=9` → `topics.json?v=9`
- Update the fallback error message that references `manifest`
- Update `README.md` and `CONTENT_AUTHORING_GUIDE.md` references

### 1.4 Remove dead CSS

`#progressScreen` styles exist in the CSS (~line 205 area) but there is no `#progressScreen` element in the HTML. Remove these rules after confirming no element uses the ID.

### 1.5 Reduce inline styles

Many buttons and containers use `style="..."` for margins, flex layout, and hr styling. Convert the most repeated patterns to CSS classes:

- `style="border: none; border-top: 1px solid rgba(86, 95, 137, 0.5);"` on `<hr>` elements → `.divider` class
- `style="margin-top: 0.5rem;"` / `style="margin-top: 0.25rem;"` on back/menu buttons → `.mt-sm`, `.mt-xs` utilities or button-group spacing via parent
- `style="margin-bottom: 0.4rem;"` on step buttons → handle via `.menu-panel button + button` gap
- `style="display: flex; gap: 0.5rem; flex-wrap: wrap;"` on button rows → `.btn-row` class
- `style="color: var(--muted); font-size: 0.9rem;"` on description paragraphs → `.menu-desc` class

---

## Phase 2 — Accessibility

Goal: make the app usable with keyboard and screen readers.

### 2.1 Semantic structure

- Add a proper heading hierarchy: `<h1>` for the app title (once), `<h2>` for screen titles (Quiz, Results, Intro, Reference), `<h3>` for subsections.
- Wrap the main menu in a `<nav>` landmark.
- Use `<main>` for the primary content area.

### 2.2 Overlays as dialogs

The flag-reason overlay (`flagReasonOverlay`) and reported-questions overlay (`reportedQuestionsOverlay`) should be `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to their heading. Implement focus trapping: on open, focus the first interactive element; on close, return focus to the trigger button.

### 2.3 Quiz options

MC options are currently `<div>` elements with click handlers. Two approaches (pick one):

- **Option A (native)**: Replace with `<fieldset>` + `<legend>` + `<label><input type="radio"> Option text</label>`. Style the label to look like the current option cards.
- **Option B (ARIA)**: Keep divs but add `role="radiogroup"` on the container and `role="radio"` + `aria-checked` + `tabindex` on each option. Implement arrow-key navigation (roving tabindex).

Option A is preferred for simplicity and native form semantics.

### 2.4 Focus management

- After each screen transition (`showScreen()`), move focus to the screen's heading or first interactive element.
- After submitting an answer, focus the feedback area or the "Next" button.
- On quiz start, focus the first question's input or first MC option.

### 2.5 Focus indicators

Add a visible `:focus-visible` outline to all interactive elements. The current CSS does not define custom focus styles, so browser defaults apply — which may be invisible on the dark background.

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

---

## Phase 3 — PWA and offline

Goal: decide and implement a coherent PWA strategy.

### Current situation

- `pwa-manifest.json` is linked in `<head>` (standalone display, icon, theme color).
- `sw.js` exists and uses a pass-through strategy (fetch with `no-store`, clear all caches on activate).
- `init()` unconditionally unregisters all service workers on every page load.
- Net result: the app is not installable and has no offline support.

### Decision required

**Option A — Enable PWA properly:**
1. Remove the SW unregister block from `init()`.
2. Register `sw.js` in `init()` instead.
3. Implement a cache strategy in `sw.js`:
   - **Precache** on install: `index.html`, `styles.css`, `js/*.js`, `icon.svg`, `pwa-manifest.json`.
   - **Runtime cache** (network-first, falling back to cache): all `.json` data files.
   - **Cache versioning**: bump a version constant in `sw.js` to trigger re-cache on deploy.
4. Add an install prompt banner in the UI.

**Option B — Remove PWA assets:**
1. Delete `pwa-manifest.json`, `sw.js`, `icon.svg`.
2. Remove `<link rel="manifest">` and `<meta name="theme-color">` from `<head>`.
3. Remove the SW unregister block from `init()`.

Recommendation: **Option A** — the app is already content-heavy and self-contained. Offline access would be genuinely useful for users studying on the go.

---

## Phase 4 — UI/UX enhancements

Goal: polish the user experience.

### 4.1 Screen transitions

Add CSS transitions when switching screens. Simple approach:

```css
.screen { opacity: 0; transition: opacity 0.15s ease; }
.screen.visible { opacity: 1; }
```

Replace the `.hidden` class toggle with a `.visible` class and a short delay for the outgoing screen.

### 4.2 Mobile improvements

- Increase touch target size for MC options to at least 44×44px (current min-height may be smaller on dense text).
- Add `touch-action: manipulation` to prevent double-tap zoom on buttons.
- Consider a sticky "Next" button at the bottom of the viewport during quiz so users don't have to scroll after reading feedback.

### 4.3 Light theme

Add a third theme option via a toggle in the menu:

```css
body.theme-light {
  --bg: #f8f9fa;
  --surface: #ffffff;
  --text: #1a1b26;
  --muted: #6b7280;
  --correct: #16a34a;
  --wrong: #dc2626;
  --accent: #2563eb;
}
```

Store the preference in `localStorage` and apply it on load.

### 4.4 Keyboard shortcuts

Currently only Enter submits an answer and Enter advances past feedback. Add:

| Key | Action | Context |
|-----|--------|---------|
| `1`–`4` or `a`–`d` | Select MC option | Quiz screen, MC question |
| `Escape` | Go back / return to menu | Any screen |
| `Tab` | Navigate between MC options | Quiz screen, MC question |

### 4.5 Progress visualization

The main menu already shows quiz count, average, streak, and weak-spot count. Enhancements:

- Add a per-topic completion indicator (checkmark or progress bar) next to each topic in the dropdown or in a dedicated progress screen.
- Show a simple bar chart of recent quiz scores (last 10) on the results screen.
- Color-code the memory bank entries by strength (green = strong, yellow = medium, red = weak).

---

## Phase 5 — Data integrity and tooling

Goal: prevent content errors and ensure cross-file consistency.

### 5.1 Fix known `topic_id` mismatches

`exam_sentence_transformation.json` contains items with `"topic_id": "gerunds_infinitives"`, but the manifest uses `"infinitive_ing"`. These should be updated to match.

Run a cross-file check: every `topic_id` value in `exam_*.json` and `mixed_cloze.json` must exist as an `id` in `manifest.json`.

### 5.2 JSON Schema validation

Create lightweight JSON schemas for the core data files:

| Schema | Validates |
|--------|-----------|
| `schemas/topic.schema.json` | `manifest.json` (now `topics.json`) |
| `schemas/questions.schema.json` | `questions.json` — each topic key contains sets with question arrays |
| `schemas/curriculum.schema.json` | `curriculum_*.json` — intro, check, practice structure |
| `schemas/exam.schema.json` | `exam_*.json` — tiers, items, required fields per type |

Validate with `ajv` (CLI) or a simple Node script that runs on all data files.

### 5.3 Extend the audit script

`audit_questions.js` currently checks:
- Missing preposition alternatives
- Missing fixed-phrase alternatives
- MC correct_option listing
- Short/ambiguous open prompts

Add checks for:
- **Orphaned topics**: `questions_key` in manifest with no matching key in `questions.json`
- **Missing curriculum files**: manifest references a curriculum file that doesn't exist on disk
- **Empty question sets**: sets with 0 questions
- **Duplicate questions**: same `question` text appearing in multiple sets of the same topic
- **`topic_id` consistency**: all `topic_id` values in exam/mixed files match a manifest `id`

### 5.4 Cache-busting strategy

The current approach uses manual `?v=N` query params scattered across `fetch()` calls. Replace with a single version constant:

```js
const DATA_VERSION = 10;
function dataUrl(file) { return file + '?v=' + DATA_VERSION; }
```

Increment `DATA_VERSION` on each content deploy. Longer-term, a build step could generate content hashes.

---

## Phase 6 — Testing

Goal: catch regressions before they reach users.

### 6.1 Data validation tests (Node, no browser needed)

A `test/validate-data.js` script that:
- Parses every `.json` data file and asserts valid JSON
- Checks every `questions_key` in `topics.json` exists in `questions.json`
- Checks every `curriculum` filename in `topics.json` exists on disk
- Checks every `correct_option` in MC questions matches one of the option keys
- Checks every `topic_id` in exam files matches a manifest ID
- Reports failures with file and line context

Run with: `node test/validate-data.js`

### 6.2 Smoke tests (Playwright)

After the Phase 1 split, add basic E2E tests:

| Test | Validates |
|------|-----------|
| App loads | `index.html` renders without console errors |
| Topic select | Choosing a topic updates the UI |
| Start Part 1 | Intro screen appears with content |
| Start Part 3 | Quiz screen appears, a question is shown |
| Submit answer | Feedback appears, score updates |
| Finish quiz | Results screen shows score |
| Exam open cloze | Easy test loads and presents gaps |

Setup: `npm init -y && npm install -D @playwright/test`, create `playwright.config.js` pointing at the local dev server.

---

## Phase 7 — Deployment and distribution

Goal: make the app publicly accessible.

### 7.1 Static hosting

The app is fully static (no server-side logic). Host on **GitHub Pages**:

1. The repo is already on GitHub (`Pernath1200/tenses-quiz`).
2. Enable Pages in repo settings → source: root of `main` branch (or a `docs/` folder).
3. Optionally configure a custom domain (`rue2.cz`).

### 7.2 Build step (optional)

If Phase 1 splits the code into modules, a minimal build step could:
- Concatenate/minify JS modules into a single `app.min.js`
- Minify CSS
- Copy HTML + JSON + assets to `dist/`

Tools: `esbuild` (fast, zero-config for bundling ES modules) or a simple shell script.

Not required for GitHub Pages (which can serve the source directly), but useful for performance.

### 7.3 GitHub Actions CI

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node test/validate-data.js
      - run: node audit_questions.js
```

Add a deploy job that copies files to the Pages branch after merge to `main`.

---

## Priority order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | 5.1 Fix `topic_id` mismatches | Small | Prevents wrong topic links in exam feedback |
| 2 | 1.5 Reduce inline styles | Small | Cleaner HTML, easier theming |
| 3 | 1.4 Remove dead CSS | Small | Less clutter |
| 4 | 1.2 Consolidate duplicate logic | Medium | Fewer bugs from copy-paste drift |
| 5 | 1.1 Split `index.html` | Large | Unlocks testability and collaboration |
| 6 | 2.5 Focus indicators | Small | Immediate a11y win |
| 7 | 2.1 Semantic structure | Medium | Better screen reader experience |
| 8 | 5.4 Cache-busting strategy | Small | Eliminates stale-data bugs |
| 9 | 1.3 Rename `manifest.json` | Small | Removes a recurring source of confusion |
| 10 | 5.3 Extend audit script | Medium | Catches content errors automatically |
| 11 | 6.1 Data validation tests | Medium | Safety net for content changes |
| 12 | 4.4 Keyboard shortcuts | Small | Power-user productivity |
| 13 | 2.2 Overlays as dialogs | Medium | Modal a11y |
| 14 | 2.3 Quiz options (radio buttons) | Medium | Core a11y for the main interaction |
| 15 | 4.3 Light theme | Small | User preference |
| 16 | 4.2 Mobile improvements | Small | Touch UX |
| 17 | 4.1 Screen transitions | Small | Visual polish |
| 18 | 3 PWA decision and implementation | Medium–Large | Offline access |
| 19 | 4.5 Progress visualization | Medium | Motivation and retention |
| 20 | 6.2 Smoke tests (Playwright) | Medium | Regression safety |
| 21 | 7.1 Static hosting | Small | Public access |
| 22 | 5.2 JSON Schema validation | Medium | Structural safety net |
| 23 | 7.3 GitHub Actions CI | Small | Automated checks |
| 24 | 7.2 Build step | Medium | Performance (optional) |

---

## Notes

- This plan assumes the app stays vanilla JS (no framework migration). A framework would be a separate, larger decision.
- Phase 1 (code split) is the highest-effort item but unblocks many others. It can be done incrementally: extract CSS first, then one JS module at a time.
- Content authoring continues in parallel — see `CONTENT_AUTHORING_GUIDE.md` and the `.cursor/rules/` files for quality standards.
- The Python CLI quiz (`present_perfect_quiz.py`) is out of scope for this plan; it is a separate tool.
