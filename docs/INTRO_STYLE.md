# Intro house style — visual-first sections

How `curriculum_*.json` → `intro.sections` should be written. Goal: minimal
prose, minimal scrolling, content organised into bullets, tables and diagrams.
The renderer is `renderDiagram()` + `renderIntroContentHtml()` (js/curriculum.js,
js/ui.js); everything below is data-driven JSON — no HTML in content.

## The section template

One section = one idea, fitting a phone screen without scrolling:

1. **Lead** — first line of `content`, ≤ ~140 chars, says what this section teaches.
2. **Visual(s)** — `diagrams` array (or single `diagram`): the substance lives here.
3. **Micro-note** — optional last line(s) of `content`, ≤ ~200 chars.

Budget: **≤ 400–500 chars of prose per section.** If an idea needs more, split
it into two sections — one more Next-tap beats scrolling. Keep each section's
`root_ids` and `cefr_level` fields intact when splitting (copy to both halves).

## Content markup (inside `content` strings)

- `**bold**`, `*italic*`, `~~strikethrough~~` (wrong forms — same convention as
  worksheets and flipcharts; never mark a wrong form any other way).
- Lines starting `- ` render as real bullet lists. Prefer bullets to sentences.
- `[[topic:id|label]]`, `[[ref|label]]` etc. link into the app (unchanged).

## Diagram types (the `diagrams` array)

**table** — paradigms, contrasts with 3+ dimensions:
```json
{"type":"table","title":"Necessity contrast","headers":["Form","Meaning","Example"],
 "rows":[["**must**","internal obligation","I **must** finish today."]]}
```

**formula** — patterns: `{"type":"formula","items":[{"label":"Question","formula":"Can + subject + verb? → Can you help?"}]}`

**comparison** — two-way contrasts: `{"type":"comparison","left":{"title":"will","points":["decision now"]},"right":{"title":"going to","points":["plan made earlier"]}}`

**timeline** — tense semantics: `{"type":"timeline","events":[{"label":"past action","style":"past"},{"label":"NOW","style":"now"}]}`

**decision** — choice procedures as a yes/no flowchart. THE type for "which
form do I use?" (articles, conditional type, will/going-to, who/which/where):
```json
{"type":"decision","title":"Which article?","steps":[
 {"q":"Do both speakers know exactly which one?","yes":"the"},
 {"q":"Singular and countable?","yes":"a / an"},
 {"end":"no article"}]}
```
`yes` answers immediately; `no` falls to the next step (or give `"no":"answer"`); `{"end":…}` is the final answer.

**examples** — ✓/✗ sentence pairs; the wrong form is auto-struck-through:
```json
{"type":"examples","items":[{"good":"She can swim.","bad":"She cans swim.","why":"modals never take -s"}]}
```

**callout** — flagged note box; `style:"cz"` for Czech-contrast notes:
```json
{"type":"callout","style":"cz","text":"*musíš/musíme* conjugates — English **must** never changes."}
```

**chips** — closed word-sets as badges, so the set is scannable at a glance:
```json
{"type":"chips","title":"The nine modals","items":["can","could","may","might","must","shall","should","will","would"]}
```
Grouped form: `{"type":"chips","groups":[{"label":"past","items":["yesterday","ago"]},{"label":"perfect","items":["just","already","yet"]}]}`

## Conversion rules (restructuring, not re-authoring)

- Every fact in the prose survives; nothing new is invented.
- "Why it matters" preambles compress to the lead line or go.
- Rule lists with examples → `examples` or `table`; word lists → `chips`;
  "Czech note:" paragraphs → `callout` with `style:"cz"`; choice procedures →
  `decision`; everything else that can be a bullet becomes a bullet.
- Don't touch `check`, `practice`, `practice_order`, or section `root_ids`/`cefr_level`.
