# Content authoring guide

Use this guide when adding new questions to the Grammar Test pool, topic practice, or curriculum. Following these rules minimizes faulty questions (ambiguity, wrong marking, missing alternatives).

---

## 1. Context rules

Every gap must be **disambiguated** by the sentence (and hint if needed). The learner must be able to infer the intended answer from context alone.

### Quantifiers
- Add countable/uncountable or amount clues.
- **Bad:** "_____ of the cake was left." (could be all, some, none)
- **Good:** "_____ of the cake was left – we'd eaten almost all of it." (only "some" or "a little" makes sense)
- **Good:** "How _____ money do you have? (uncountable – one word)" (much)
- **Good:** "How _____ books did you read? (quantity – one word)" (many)

### Tenses
- Add time clues in the sentence or hint.
- **Bad:** "We ____ (look) for a new flat. Put the verb in the correct tense." (past? present perfect? no way to tell)
- **Good:** "We ____ (look) for a new flat for months. Put the verb in the correct tense." (duration → present perfect continuous)
- **Good:** "She ____ (leave) yesterday. (past – one word)" (past simple)
- Include tense in the hint when needed: "(past simple)", "(present perfect)", "(one word; present simple)"

### Prepositions and dependent prepositions
- The sentence must narrow the meaning so only the intended preposition(s) fit.
- If the reference lists alternatives (e.g. "popular with / among"), both are acceptable; include both in `answers` unless the sentence clearly excludes one.

### Conditionals and verb forms
- Make the conditional type clear: "Zero:", "First:", "Second:", "Third:" in the stem or hint.
- For "If you _____ early, call me" – use a hint like "(one word; present simple, e.g. finish or leave)" that gives a different example from the answer, or make the sentence itself narrow the verb.

---

## 2. Alternative rules

List **all** valid answers in the `answers` array. The app marks an answer correct if it matches any entry.

### Contractions and full forms
- Accept both: `["have been waiting", "I've been waiting"]`, `["it's", "it is"]`, `["haven't", "have not"]`
- Check for curly vs straight apostrophe: `"haven't"` and `"haven't"` (both forms)

### Punctuation
- Trailing full stop is optional for correct answers (implemented in the app).
- Include both forms if your item type requires it: `["He had left.", "He had left"]`

### Prepositions with alternatives
- Use [reference_dependent_prepositions.json](reference_dependent_prepositions.json) as the source of truth.
- If the reference says "research into / on / about", include all three: `["into", "on", "about"]`
- Same for "popular with / among", "connected with / to", "sorry about / for", etc.

### Fixed phrases with alternatives
- Use [reference_fixed_phrases.json](reference_fixed_phrases.json).
- If the reference says "in doing so / by doing so", include both: `["By", "In"]`

### Which/that, fill in/out
- For defining relative clauses: accept both "which" and "that" where valid.
- For "fill _____ the form": accept both "in" and "out" where both are idiomatic.

---

## 3. No answer in the question

Do not put the correct answer in the hint or question text.

- **Bad:** "If you _____ early, call me. (one word; e.g. finish or arrive)" when the answer is "arrive"
- **Good:** "If you _____ early, call me. (one word; present simple, e.g. finish or leave)"
- Avoid hints like "(a lot)" when the answer is "a lot"

---

## 4. Full sentences for "Correct the sentence"

For error-correction items, both the wrong and right versions must be **full sentences**.

- **Bad:** "Wrong: 'have been reading.' Correct the sentence." (fragment, no context)
- **Good:** "Wrong: 'I have been reading that book.' (You mean you finished it; the result matters.) Correct the sentence." with answers `["I have read that book.", "I have read that book"]`

- **Bad:** "Wrong: 'Economic developement.' Correct the sentence." (phrase, not a sentence)
- **Good:** "Wrong: 'The economic developement of the region has been slow.' Correct the sentence." with answers including "development"

---

## 5. Multiple choice (MC) verification

Before adding an MC item, confirm that `correct_option` (a, b, c, or d) matches the **grammatically correct** choice.

- Read the question and all options.
- Decide which option is correct.
- Set `correct_option` to that letter.
- Re-run the audit script; the MC list report helps you spot any wrong `correct_option` values during manual review.

---

## 6. Templates for risky question types

### Quantifier gap
```json
{
  "type": "open",
  "question": "_____ of the cake was left – we'd eaten almost all of it. (Fill in the blank.)",
  "answers": ["some", "a little"],
  "explanation": "Almost all gone → some / a little left."
}
```

### Dependent preposition (from reference)
1. Look up the phrase in reference_dependent_prepositions.json (e.g. "research into / on / about").
2. Build the stem: "They're doing research ____ climate change."
3. Set answers from the reference: `["into", "on", "about"]`

### Tense gap
```json
{
  "type": "open",
  "question": "She ____ (leave) yesterday. (past – one word)",
  "answers": ["left"],
  "explanation": "Past simple for a completed action at a specific past time."
}
```
For present perfect: include time clue ("for months", "since 2020", "so far") or hint "(present perfect)".

### Correct the sentence
```json
{
  "type": "open",
  "question": "Wrong: 'I had went to London in 2019.' (Past perfect of 'go' – use past participle.) Correct the sentence.",
  "answers": ["I had gone to London in 2019.", "I had gone to London in 2019", "I went to London in 2019.", "I went to London in 2019"],
  "explanation": "Past perfect needs past participle: go → gone. Or use past simple for a single past event."
}
```

### Fixed phrase (from reference)
1. Look up the phrase in reference_fixed_phrases.json (e.g. "in doing so / by doing so").
2. Build the stem: "_____ doing so, they saved time."
3. Set answers: `["By", "In"]`

---

## 7. 30-second checklist (before adding each item)

- [ ] Is the intended answer clear from the sentence (and hint)?
- [ ] Are all reasonable alternatives in `answers` (contractions, punctuation, reference alternatives)?
- [ ] If MC: does `correct_option` match the correct option?
- [ ] If "Correct the sentence": full sentence, not a fragment?
- [ ] Is the answer hidden from the hint (no answer in the question)?

---

## 8. Where to add content

| Target | File | Structure |
|--------|------|-----------|
| Grammar Test (all topics) | [questions.json](questions.json) | Top-level key = `questions_key` from manifest (e.g. `prepositions`, `conditionals`). Each topic has `set1`, `set2`, etc. with `title`, `summary`, `questions` array. |
| Topic practice (curriculum) | [curriculum_*.json](curriculum_comparatives.json) | Nested under `check.questions`, `practice.gapfill.questions`, `practice.mc.questions`, etc. |
| Reference data | [reference_dependent_prepositions.json](reference_dependent_prepositions.json), [reference_fixed_phrases.json](reference_fixed_phrases.json) | Add or update entries here first when authoring prepositions/fixed phrases. |

Match the structure of existing questions in the same topic (e.g. `type`, `question`, `answers`, `explanation`, and `topic_id` where used).

---

## 9. After adding a batch

1. Run `node audit_questions.js`
2. Fix all reported "missing alternative" issues
3. Manually verify MC items from the report
4. Fix "short or context-free" items by adding context
5. Re-run the audit
6. Spot-check 5–10 random new items in the app

See [README_AUDIT.md](README_AUDIT.md) for details on the audit script.
