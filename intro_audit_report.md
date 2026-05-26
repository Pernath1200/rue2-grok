# Curriculum intro sections audit

Generated: 2026-04-06

## Methodology

- **Scope:** All `curriculum*.json` files in the repo root (excluding `schemas/`).
- **Overflow:** Character count of the `content` string only (diagrams not counted). Threshold: **> 250** characters.
- **Empty content:** Exact `content` value `""`; `diagram` presence recorded.
- **Numbered titles:** Regex `Title (n)` at end of `title`; groups with two or more distinct numbers listed.
- **JSON errors:** Files that fail `JSON.parse` are listed in the summary only; other sections skip them.

## Summary

| Topic file | Sections | Flags |
|------------|----------|-------|
| curriculum.json | 7 | — |
| curriculum_articles.json | — | **PARSE ERROR**: Expected ',' or '}' after property value in JSON at position 2348 (line 31 column 213) |
| curriculum_auxiliary_verbs.json | 8 | — |
| curriculum_comparatives.json | 12 | — |
| curriculum_conditionals.json | 9 | — |
| curriculum_conjunctions_linkers.json | 18 | >15 sections (18) |
| curriculum_countable_uncountable.json | 9 | — |
| curriculum_fixed_phrases.json | 8 | — |
| curriculum_infinitive_ing.json | 24 | >15 sections (24) |
| curriculum_inversion.json | 4 | — |
| curriculum_irregular_verbs.json | 5 | — |
| curriculum_it_subject.json | — | **PARSE ERROR**: Unexpected token '\', ..."     "a": \"To get u"... is not valid JSON |
| curriculum_modal_verbs.json | 11 | — |
| curriculum_open_cloze.json | 7 | — |
| curriculum_passives.json | 15 | — |
| curriculum_past_perfect.json | 17 | >15 sections (17) |
| curriculum_past_simple_continuous.json | 15 | — |
| curriculum_past_simple_present_perfect.json | 9 | — |
| curriculum_phrasal_verbs.json | 9 | — |
| curriculum_prepositions.json | 38 | >15 sections (38) |
| curriculum_prepositions_dependent.json | 9 | — |
| curriculum_punctuation.json | 11 | — |
| curriculum_quantifiers.json | 9 | — |
| curriculum_relative_pronouns.json | 12 | — |
| curriculum_reported_speech.json | 11 | — |
| curriculum_sentence_transformation.json | 6 | — |
| curriculum_spelling.json | 2 | <3 sections (2) |
| curriculum_tenses_general.json | 14 | — |
| curriculum_verb_subject_agreement.json | 7 | — |
| curriculum_will_going_to.json | 10 | — |
| curriculum_word_formation.json | 7 | — |
| curriculum_word_order.json | 22 | >15 sections (22) |

## 1. Overflow risk (>250 characters in `content`)

Rough threshold: long prose may require scrolling on a ~600px-wide intro card.

| File | Section title | Characters |
|------|-----------------|------------:|
| curriculum_inversion.json | Patterns to learn | 753 |
| curriculum_punctuation.json | Colons and semicolons | 627 |
| curriculum_inversion.json | What this section covers | 526 |
| curriculum_punctuation.json | Quick summary | 513 |
| curriculum_comparatives.json | How to form comparatives | 437 |
| curriculum_comparatives.json | Superlatives – the best, the most, the least | 425 |
| curriculum_prepositions.json | Types of prepositions: Place and position (1) | 400 |
| curriculum_tenses_general.json | Simple aspect (2) | 399 |
| curriculum_inversion.json | Quick summary | 396 |
| curriculum_reported_speech.json | Tense backshift (1) | 396 |
| curriculum_relative_pronouns.json | Quick summary | 395 |
| curriculum_modal_verbs.json | Semi-modals (e.g. ought to) (1) | 394 |
| curriculum_modal_verbs.json | Summary – when to use which (1) | 394 |
| curriculum_open_cloze.json | What is often in the gaps? | 394 |
| curriculum_verb_subject_agreement.json | Quick summary | 394 |
| curriculum_past_simple_continuous.json | Interrupted actions: when and while (2) | 393 |
| curriculum_spelling.json | What this section covers | 392 |
| curriculum_passives.json | Causative have and get (2) | 391 |
| curriculum_reported_speech.json | Typical learner errors | 391 |
| curriculum_phrasal_verbs.json | Separable vs inseparable | 389 |
| curriculum_prepositions.json | Dependent prepositions with adjectives (1) | 389 |
| curriculum_tenses_general.json | Perfect aspect (1) | 386 |
| curriculum_passives.json | When do we use the passive? | 384 |
| curriculum_punctuation.json | Commas – when to use them (1) | 384 |
| curriculum_will_going_to.json | What are we comparing? | 384 |
| curriculum_word_order.json | Embedded questions: when to use statement order (1) | 384 |
| curriculum_relative_pronouns.json | Don't use 'what' as relative pronoun | 383 |
| curriculum_verb_subject_agreement.json | What is verb–subject agreement? | 383 |
| curriculum_conditionals.json | Third conditional | 382 |
| curriculum_conjunctions_linkers.json | Contrast, cause, and time (2) | 382 |
| curriculum_past_simple_present_perfect.json | What are we comparing? | 381 |
| curriculum_tenses_general.json | Perfect aspect (2) | 381 |
| curriculum_will_going_to.json | When to use GOING TO | 381 |
| curriculum_quantifiers.json | Typical errors | 380 |
| curriculum_countable_uncountable.json | Common mistakes (uncountable in English) (1) | 379 |
| curriculum_countable_uncountable.json | Plural-only nouns (1) | 379 |
| curriculum_tenses_general.json | Perfect continuous aspect (1) | 379 |
| curriculum_will_going_to.json | When to use WILL (1) | 377 |
| curriculum.json | Common mistakes (1) | 377 |
| curriculum_reported_speech.json | What is reported speech? | 376 |
| curriculum_conjunctions_linkers.json | Subordinating conjunctions (2) | 375 |
| curriculum_word_order.json | Additive particles: "also" (1) | 375 |
| curriculum.json | When to use SIMPLE | 375 |
| curriculum_auxiliary_verbs.json | Do, does, did | 374 |
| curriculum_infinitive_ing.json | What are we comparing? | 372 |
| curriculum_tenses_general.json | Continuous aspect (2) | 364 |
| curriculum_conditionals.json | What are conditionals? | 363 |
| curriculum_past_simple_continuous.json | Quick summary (1) | 363 |
| curriculum_conditionals.json | Typical learner errors | 361 |
| curriculum_past_simple_continuous.json | Typical learner errors (1) | 361 |
| curriculum_quantifiers.json | What are quantifiers? | 360 |
| curriculum_verb_subject_agreement.json | Don't be fooled by words in between | 359 |
| curriculum_will_going_to.json | Typical errors (1) | 358 |
| curriculum_word_formation.json | What is Word Formation? | 358 |
| curriculum_past_simple_present_perfect.json | When we use Past Simple | 357 |
| curriculum_phrasal_verbs.json | Common particles (1) | 357 |
| curriculum_comparatives.json | More patterns | 356 |
| curriculum_prepositions.json | Dependent prepositions – what they are (2) | 356 |
| curriculum_infinitive_ing.json | Bare Infinitive – When NO "to" is correct | 355 |
| curriculum_modal_verbs.json | What is modality? (1) | 355 |
| curriculum_past_perfect.json | Typical errors (1) | 355 |
| curriculum_punctuation.json | Capitalisation (1) | 353 |
| curriculum_verb_subject_agreement.json | Compound subjects | 353 |
| curriculum_prepositions.json | Types of prepositions: Time (1) | 352 |
| curriculum_prepositions.json | Types of prepositions: Place and position (2) | 352 |
| curriculum_relative_pronouns.json | Which relative pronoun to use (1) | 352 |
| curriculum_prepositions.json | Prepositions in phrasal verbs (2) | 351 |
| curriculum_countable_uncountable.json | Quick summary | 350 |
| curriculum_sentence_transformation.json | In the exam | 350 |
| curriculum_auxiliary_verbs.json | Be and have | 348 |
| curriculum_reported_speech.json | Say vs tell | 348 |
| curriculum_inversion.json | What is inversion? | 347 |
| curriculum_modal_verbs.json | Modal verbs – form and meaning (1) | 347 |
| curriculum_prepositions.json | Dependent prepositions with nouns (1) | 345 |
| curriculum_punctuation.json | Capitalisation (English) | 343 |
| curriculum_quantifiers.json | Few, a few, little, a little | 342 |
| curriculum_passives.json | Form: be + past participle (2) | 341 |
| curriculum_countable_uncountable.json | Common mistakes (uncountable in English) (2) | 340 |
| curriculum_past_simple_present_perfect.json | When we use Present Perfect (1) | 340 |
| curriculum_past_perfect.json | Link to Present Perfect (2) | 339 |
| curriculum_prepositions_dependent.json | How this topic is organised (1) | 339 |
| curriculum_passives.json | By-agent and other prepositions | 338 |
| curriculum_past_simple_continuous.json | When we use Past Continuous (1) | 337 |
| curriculum_conjunctions_linkers.json | Linkers (discourse markers) (2) | 336 |
| curriculum_fixed_phrases.json | How fixed phrases are used (1) | 336 |
| curriculum_past_simple_present_perfect.json | Quick summary | 336 |
| curriculum_past_perfect.json | Form (1) | 335 |
| curriculum_word_order.json | Frequency adverbs: where they go (1) | 335 |
| curriculum_prepositions.json | Dependent prepositions with verbs (1) | 334 |
| curriculum_prepositions.json | Dependent prepositions with verbs (2) | 334 |
| curriculum_relative_pronouns.json | That vs which (1) | 332 |
| curriculum_prepositions.json | Types of prepositions: Other uses (1) | 329 |
| curriculum_quantifiers.json | Quick summary | 329 |
| curriculum_phrasal_verbs.json | Typical errors (1) | 326 |
| curriculum_prepositions_dependent.json | What are dependent prepositions? (1) | 326 |
| curriculum_will_going_to.json | The difference (1) | 326 |
| curriculum_will_going_to.json | Quick summary | 326 |
| curriculum_quantifiers.json | Some and any | 324 |
| curriculum_infinitive_ing.json | Verbs + -ing form (1) | 323 |
| curriculum_conditionals.json | Second conditional | 321 |
| curriculum_modal_verbs.json | What is modality? (2) | 321 |
| curriculum_prepositions.json | Types of prepositions: Movement and direction (2) | 321 |
| curriculum_verb_subject_agreement.json | Third person singular: the -s (1) | 321 |
| curriculum_word_order.json | Three main problem areas (2) | 321 |
| curriculum_countable_uncountable.json | Countable vs uncountable (2) | 320 |
| curriculum_auxiliary_verbs.json | Common mistakes 1 (2) | 319 |
| curriculum_prepositions.json | Types of prepositions: Movement and direction (2) | 319 |
| curriculum_past_perfect.json | What is the past perfect continuous? (2) | 318 |
| curriculum_quantifiers.json | All, most, no, none | 317 |
| curriculum_quantifiers.json | Much and many | 315 |
| curriculum_word_order.json | "Also" vs "too" and "as well" (2) | 315 |
| curriculum_past_simple_continuous.json | What are we comparing? (1) | 312 |
| curriculum_past_simple_present_perfect.json | Typical errors (1) | 312 |
| curriculum_passives.json | Quick summary (1) | 310 |
| curriculum_prepositions_dependent.json | What are dependent prepositions? (2) | 307 |
| curriculum_comparatives.json | What are comparatives? (1) | 305 |
| curriculum_conjunctions_linkers.json | What are conjunctions and linkers? (2) | 304 |
| curriculum_sentence_transformation.json | What to do | 304 |
| curriculum_infinitive_ing.json | Verbs + both (different meaning) (1) | 299 |
| curriculum_prepositions.json | Prepositions in compound nouns (2) | 298 |
| curriculum_reported_speech.json | Pronouns and time/place words | 297 |
| curriculum_auxiliary_verbs.json | Common mistakes 2 (2) | 295 |
| curriculum_open_cloze.json | What is Open Cloze? | 292 |
| curriculum_relative_pronouns.json | What are relative pronouns? (2) | 292 |
| curriculum_fixed_phrases.json | What are fixed phrases? (1) | 291 |
| curriculum_conditionals.json | First conditional | 290 |
| curriculum_prepositions.json | Dependent prepositions with nouns (2) | 290 |
| curriculum_sentence_transformation.json | What is it? (1) | 289 |
| curriculum.json | When to use CONTINUOUS (1) | 289 |
| curriculum_passives.json | Typical learner errors (1) | 288 |
| curriculum_word_formation.json | In the exam | 288 |
| curriculum_word_formation.json | What to do | 288 |
| curriculum_modal_verbs.json | Semi-modals (e.g. ought to) (2) | 287 |
| curriculum_infinitive_ing.json | Typical errors (1) | 286 |
| curriculum_irregular_verbs.json | Regular vs irregular (1) | 286 |
| curriculum_word_formation.json | Reference: Prefixes and suffixes | 286 |
| curriculum_comparatives.json | Using comparatives | 285 |
| curriculum_infinitive_ing.json | Exceptions: bare infinitive | 285 |
| curriculum_quantifiers.json | A lot of, lots of, enough | 283 |
| curriculum_tenses_general.json | Continuous aspect (1) | 283 |
| curriculum_infinitive_ing.json | Verbs + to-infinitive (1) | 282 |
| curriculum_prepositions_dependent.json | Verbs, nouns, and adjectives with prepositions (1) | 282 |
| curriculum_sentence_transformation.json | Examples | 281 |
| curriculum_modal_verbs.json | Modal verbs – form and meaning (1) | 279 |
| curriculum_past_simple_continuous.json | When we use Past Continuous (2) | 278 |
| curriculum_tenses_general.json | Simple aspect (1) | 278 |
| curriculum_infinitive_ing.json | Quick summary (1) | 276 |
| curriculum_word_order.json | Embedded questions: no inversion (2) | 276 |
| curriculum_past_perfect.json | When do we use simple vs continuous? (2) | 275 |
| curriculum_reported_speech.json | Quick summary (1) | 274 |
| curriculum_fixed_phrases.json | Why they matter in exams (2) | 273 |
| curriculum_prepositions.json | Prepositions in phrasal verbs (2) | 273 |
| curriculum_fixed_phrases.json | Why they matter in exams (1) | 272 |
| curriculum_prepositions_dependent.json | Why they matter (2) | 272 |
| curriculum_prepositions.json | Types of prepositions: Time (2) | 272 |
| curriculum_prepositions.json | Dependent prepositions with adjectives (2) | 272 |
| curriculum_countable_uncountable.json | What this section covers | 271 |
| curriculum_prepositions.json | Reference list | 271 |
| curriculum_passives.json | Causative have and get (2) | 270 |
| curriculum_past_simple_continuous.json | Typical learner errors (2) | 270 |
| curriculum_tenses_general.json | Perfect continuous aspect (2) | 270 |
| curriculum_punctuation.json | Commas (English) (2) | 268 |
| curriculum_word_formation.json | Common patterns (1) | 268 |
| curriculum.json | What are we comparing? | 268 |
| curriculum_conjunctions_linkers.json | Coordinating conjunctions (1) | 267 |
| curriculum_fixed_phrases.json | How fixed phrases are used (2) | 267 |
| curriculum_passives.json | What is the passive? (2) | 267 |
| curriculum_relative_pronouns.json | Typical mistakes (1) | 266 |
| curriculum_conditionals.json | Quick summary (1) | 265 |
| curriculum_tenses_general.json | Introduction (3) | 265 |
| curriculum_word_order.json | Frequency adverbs: common mistakes (2) | 265 |
| curriculum_auxiliary_verbs.json | What are auxiliary verbs? (2) | 264 |
| curriculum_conditionals.json | Zero conditional | 264 |
| curriculum_word_order.json | Frequency adverbs: where they go (2) | 264 |
| curriculum_conditionals.json | Quick summary (2) | 263 |
| curriculum_phrasal_verbs.json | Quick summary | 263 |
| curriculum_open_cloze.json | In the exam | 261 |
| curriculum_modal_verbs.json | Modal verbs – form and meaning (2) | 260 |
| curriculum_conjunctions_linkers.json | Linkers in essays and writing tasks (1) | 259 |
| curriculum_open_cloze.json | What to do | 257 |
| curriculum_conjunctions_linkers.json | Linkers in essays and writing tasks (2) | 256 |
| curriculum_irregular_verbs.json | When you need irregular forms | 256 |
| curriculum_past_simple_continuous.json | When we use Past Simple (1) | 255 |
| curriculum_tenses_general.json | Introduction (2) | 254 |
| curriculum_open_cloze.json | Quick summary (2) | 253 |
| curriculum_past_perfect.json | Quick summary (1) | 251 |

## 2. Duplicate tables (prose vs table-like diagram — heuristic)

Heuristic: pairs within **3 intro cards** of each other where one section has substantial prose (no diagram) and another has a `diagram` of type `table`, `comparison`, or `formula`, and titles (or diagram title) show strong overlap, or weak overlap on **adjacent** cards. One shared “summary” table can still pair with several neighbours — interpret as *possible* duplicate formation teaching, not automatic error. Manual review recommended.

| File | Prose section | Diagram/table section | Diagram type | Note |
|------|---------------|-------------------------|--------------|------|
| curriculum_comparatives.json | How to form comparatives | Forming comparatives | table | similar/normalized titles |
| curriculum_comparatives.json | Superlatives – irregular and use (1) | Forming superlatives | table | similar/normalized titles |
| curriculum_comparatives.json | Superlatives – irregular and use (2) | Forming superlatives | table | similar/normalized titles |
| curriculum_comparatives.json | Superlatives – the best, the most, the least | Forming superlatives | table | similar/normalized titles |
| curriculum_comparatives.json | Using comparatives | Forming comparatives | table | similar/normalized titles |
| curriculum_comparatives.json | What are comparatives? (1) | Forming comparatives | table | similar/normalized titles |
| curriculum_comparatives.json | What are comparatives? (2) | Forming comparatives | table | similar/normalized titles |
| curriculum_past_simple_present_perfect.json | When we use Present Perfect (1) | Past simple vs present perfect | comparison | title word overlap (2) |
| curriculum_past_simple_present_perfect.json | When we use Present Perfect (2) | Past simple vs present perfect | comparison | title word overlap (2) |
| curriculum_prepositions.json | Types of prepositions: Place and position (2) | at / on / in for place | table | overlap titles+diagram title (adjacent) |
| curriculum_prepositions.json | Types of prepositions: Time (2) | at / on / in for time | table | overlap titles+diagram title (adjacent) |
| curriculum_reported_speech.json | Tense backshift (1) | Tense backshift in reported speech | table | title word overlap (2) |
| curriculum_reported_speech.json | Tense backshift (2) | Tense backshift in reported speech | table | title word overlap (2) |
| curriculum_reported_speech.json | What is reported speech? | Tense backshift in reported speech | table | title word overlap (2) |
| curriculum_word_order.json | Embedded questions: when to use statement order (1) | Direct vs embedded word order | formula | title word overlap (2) |
| curriculum_word_order.json | Embedded questions: when to use statement order (2) | Direct vs embedded word order | formula | title word overlap (2) |
| curriculum_word_order.json | Frequency adverbs: common mistakes (2) | Frequency adverb position | formula | overlap titles+diagram title (adjacent) |

## 3. Empty `content` (`""`)

Table-only cards should define a `diagram` (or non-empty visual).

| File | Section title | Has `diagram`? | `diagram.type` |
|------|---------------|----------------|------------------|
| curriculum_comparatives.json | Forming comparatives | yes | table |
| curriculum_comparatives.json | Forming superlatives | yes | table |
| curriculum_conditionals.json | Conditional types at a glance | yes | table |
| curriculum_conjunctions_linkers.json | Conjunctions and linkers by type | yes | table |
| curriculum_countable_uncountable.json | Countable vs uncountable nouns | yes | comparison |
| curriculum_infinitive_ing.json | Verb patterns: to-infinitive vs -ing | yes | table |
| curriculum_modal_verbs.json | Modal verbs by meaning | yes | table |
| curriculum_passives.json | Passive forms by tense | yes | table |
| curriculum_passives.json | Active → Passive transformation | yes | formula |
| curriculum_past_perfect.json | Past perfect: two events in the past | yes | timeline |
| curriculum_past_simple_continuous.json | Past simple vs past continuous | yes | comparison |
| curriculum_past_simple_present_perfect.json | Past simple vs present perfect | yes | comparison |
| curriculum_phrasal_verbs.json | Separable vs inseparable phrasal verbs | yes | comparison |
| curriculum_prepositions.json | at / on / in for time | yes | table |
| curriculum_prepositions.json | at / on / in for place | yes | table |
| curriculum_punctuation.json | Key punctuation and capitalisation rules | yes | table |
| curriculum_quantifiers.json | Quantifiers: countable vs uncountable | yes | table |
| curriculum_relative_pronouns.json | Relative pronouns at a glance | yes | table |
| curriculum_reported_speech.json | Tense backshift in reported speech | yes | table |
| curriculum_spelling.json | Common spelling traps | yes | table |
| curriculum_tenses_general.json | The 12 English tenses (3 times × 4 aspects) | yes | table |
| curriculum_verb_subject_agreement.json | Agreement rules | yes | table |
| curriculum_will_going_to.json | Will vs going to | yes | comparison |
| curriculum_word_order.json | Direct vs embedded word order | yes | formula |
| curriculum_word_order.json | Frequency adverb position | yes | formula |

## 4. Numbered title pairs `(1)` / `(2)` / …

Same base title with different numbers — possible arbitrary splits; consider merging by idea.

| File | Base (stripped) | Titles |
|------|-----------------|--------|
| curriculum_auxiliary_verbs.json | What are auxiliary verbs? | What are auxiliary verbs? (1); What are auxiliary verbs? (2) |
| curriculum_auxiliary_verbs.json | Common mistakes 1 | Common mistakes 1 (1); Common mistakes 1 (2) |
| curriculum_auxiliary_verbs.json | Common mistakes 2 | Common mistakes 2 (1); Common mistakes 2 (2) |
| curriculum_comparatives.json | What are comparatives? | What are comparatives? (1); What are comparatives? (2) |
| curriculum_comparatives.json | Superlatives – irregular and use | Superlatives – irregular and use (1); Superlatives – irregular and use (2) |
| curriculum_comparatives.json | Typical errors | Typical errors (1); Typical errors (2) |
| curriculum_conditionals.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_conjunctions_linkers.json | What are conjunctions and linkers? | What are conjunctions and linkers? (1); What are conjunctions and linkers? (2) |
| curriculum_conjunctions_linkers.json | Coordinating conjunctions | Coordinating conjunctions (1); Coordinating conjunctions (2) |
| curriculum_conjunctions_linkers.json | Subordinating conjunctions | Subordinating conjunctions (1); Subordinating conjunctions (2); Subordinating conjunctions (2) |
| curriculum_conjunctions_linkers.json | Linkers (discourse markers) | Linkers (discourse markers) (1); Linkers (discourse markers) (2); Linkers (discourse markers) (2) |
| curriculum_conjunctions_linkers.json | Linkers in essays and writing tasks | Linkers in essays and writing tasks (1); Linkers in essays and writing tasks (2); Linkers in essays and writing tasks (2) |
| curriculum_conjunctions_linkers.json | Contrast, cause, and time | Contrast, cause, and time (1); Contrast, cause, and time (2) |
| curriculum_conjunctions_linkers.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_countable_uncountable.json | Countable vs uncountable | Countable vs uncountable (1); Countable vs uncountable (2) |
| curriculum_countable_uncountable.json | Common mistakes (uncountable in English) | Common mistakes (uncountable in English) (1); Common mistakes (uncountable in English) (2) |
| curriculum_countable_uncountable.json | Plural-only nouns | Plural-only nouns (1); Plural-only nouns (2) |
| curriculum_fixed_phrases.json | What are fixed phrases? | What are fixed phrases? (1); What are fixed phrases? (2); What are fixed phrases? (2) |
| curriculum_fixed_phrases.json | How fixed phrases are used | How fixed phrases are used (1); How fixed phrases are used (2) |
| curriculum_fixed_phrases.json | Why they matter in exams | Why they matter in exams (1); Why they matter in exams (2) |
| curriculum_infinitive_ing.json | Verbs + to-infinitive | Verbs + to-infinitive (1); Verbs + to-infinitive (2); Verbs + to-infinitive (2) |
| curriculum_infinitive_ing.json | Verbs + -ing form | Verbs + -ing form (1); Verbs + -ing form (2) |
| curriculum_infinitive_ing.json | Verbs + both (same or similar meaning) | Verbs + both (same or similar meaning) (1); Verbs + both (same or similar meaning) (2) |
| curriculum_infinitive_ing.json | Verbs + both (different meaning) | Verbs + both (different meaning) (1); Verbs + both (different meaning) (2); Verbs + both (different meaning) (2) |
| curriculum_infinitive_ing.json | Other rules: prepositions and too/enough | Other rules: prepositions and too/enough (1); Other rules: prepositions and too/enough (2) |
| curriculum_infinitive_ing.json | Quick summary | Quick summary (1); Quick summary (2); Quick summary (2) |
| curriculum_infinitive_ing.json | Typical errors | Typical errors (1); Typical errors (2); Typical errors (2) |
| curriculum_irregular_verbs.json | Regular vs irregular | Regular vs irregular (1); Regular vs irregular (2) |
| curriculum_modal_verbs.json | What is modality? | What is modality? (1); What is modality? (2) |
| curriculum_modal_verbs.json | Modal verbs – form and meaning | Modal verbs – form and meaning (1); Modal verbs – form and meaning (1); Modal verbs – form and meaning (2) |
| curriculum_modal_verbs.json | Semi-modals (e.g. ought to) | Semi-modals (e.g. ought to) (1); Semi-modals (e.g. ought to) (1); Semi-modals (e.g. ought to) (2) |
| curriculum_modal_verbs.json | Summary – when to use which | Summary – when to use which (1); Summary – when to use which (2) |
| curriculum_open_cloze.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_passives.json | What is the passive? | What is the passive? (1); What is the passive? (2) |
| curriculum_passives.json | Form: be + past participle | Form: be + past participle (1); Form: be + past participle (2) |
| curriculum_passives.json | Causative have and get | Causative have and get (1); Causative have and get (2); Causative have and get (2) |
| curriculum_passives.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_passives.json | Typical learner errors | Typical learner errors (1); Typical learner errors (2) |
| curriculum_past_perfect.json | Link to Present Perfect | Link to Present Perfect (1); Link to Present Perfect (2) |
| curriculum_past_perfect.json | What is the past perfect simple? | What is the past perfect simple? (1); What is the past perfect simple? (2) |
| curriculum_past_perfect.json | What is the past perfect continuous? | What is the past perfect continuous? (1); What is the past perfect continuous? (2) |
| curriculum_past_perfect.json | Past perfect vs past simple | Past perfect vs past simple (1); Past perfect vs past simple (2) |
| curriculum_past_perfect.json | When do we use simple vs continuous? | When do we use simple vs continuous? (1); When do we use simple vs continuous? (2) |
| curriculum_past_perfect.json | Form | Form (1); Form (2) |
| curriculum_past_perfect.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_past_perfect.json | Typical errors | Typical errors (1); Typical errors (2) |
| curriculum_past_simple_continuous.json | What are we comparing? | What are we comparing? (1); What are we comparing? (2) |
| curriculum_past_simple_continuous.json | When we use Past Simple | When we use Past Simple (1); When we use Past Simple (2); When we use Past Simple (2) |
| curriculum_past_simple_continuous.json | When we use Past Continuous | When we use Past Continuous (1); When we use Past Continuous (2) |
| curriculum_past_simple_continuous.json | Interrupted actions: when and while | Interrupted actions: when and while (1); Interrupted actions: when and while (2) |
| curriculum_past_simple_continuous.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_past_simple_continuous.json | Typical learner errors | Typical learner errors (1); Typical learner errors (2); Typical learner errors (2) |
| curriculum_past_simple_present_perfect.json | When we use Present Perfect | When we use Present Perfect (1); When we use Present Perfect (2) |
| curriculum_past_simple_present_perfect.json | Typical errors | Typical errors (1); Typical errors (2); Typical errors (2) |
| curriculum_phrasal_verbs.json | What are phrasal verbs? | What are phrasal verbs? (1); What are phrasal verbs? (2) |
| curriculum_phrasal_verbs.json | Common particles | Common particles (1); Common particles (2) |
| curriculum_phrasal_verbs.json | Typical errors | Typical errors (1); Typical errors (2) |
| curriculum_prepositions_dependent.json | What are dependent prepositions? | What are dependent prepositions? (1); What are dependent prepositions? (2) |
| curriculum_prepositions_dependent.json | Why they matter | Why they matter (1); Why they matter (2) |
| curriculum_prepositions_dependent.json | Verbs, nouns, and adjectives with prepositions | Verbs, nouns, and adjectives with prepositions (1); Verbs, nouns, and adjectives with prepositions (2); Verbs, nouns, and adjectives with prepositions (2) |
| curriculum_prepositions_dependent.json | How this topic is organised | How this topic is organised (1); How this topic is organised (2) |
| curriculum_prepositions.json | What are prepositions? | What are prepositions? (1); What are prepositions? (2); What are prepositions? (2) |
| curriculum_prepositions.json | Types of prepositions: Time | Types of prepositions: Time (1); Types of prepositions: Time (2) |
| curriculum_prepositions.json | Types of prepositions: Place and position | Types of prepositions: Place and position (1); Types of prepositions: Place and position (2) |
| curriculum_prepositions.json | Types of prepositions: Movement and direction | Types of prepositions: Movement and direction (1); Types of prepositions: Movement and direction (2); Types of prepositions: Movement and direction (2) |
| curriculum_prepositions.json | Types of prepositions: Other uses | Types of prepositions: Other uses (1); Types of prepositions: Other uses (1); Types of prepositions: Other uses (2) |
| curriculum_prepositions.json | Dependent prepositions – what they are | Dependent prepositions – what they are (1); Dependent prepositions – what they are (2) |
| curriculum_prepositions.json | Dependent prepositions with verbs | Dependent prepositions with verbs (1); Dependent prepositions with verbs (1); Dependent prepositions with verbs (2); Dependent prepositions with verbs (2) |
| curriculum_prepositions.json | Dependent prepositions with nouns | Dependent prepositions with nouns (1); Dependent prepositions with nouns (1); Dependent prepositions with nouns (2); Dependent prepositions with nouns (2) |
| curriculum_prepositions.json | Dependent prepositions with adjectives | Dependent prepositions with adjectives (1); Dependent prepositions with adjectives (1); Dependent prepositions with adjectives (1); Dependent prepositions with adjectives (2); Dependent prepositions with adjectives (2); Dependent prepositions with adjectives (2) |
| curriculum_prepositions.json | Prepositions in phrasal verbs | Prepositions in phrasal verbs (1); Prepositions in phrasal verbs (2); Prepositions in phrasal verbs (2) |
| curriculum_prepositions.json | Prepositions in compound nouns | Prepositions in compound nouns (1); Prepositions in compound nouns (2); Prepositions in compound nouns (2) |
| curriculum_punctuation.json | Commas – when to use them | Commas – when to use them (1); Commas – when to use them (2) |
| curriculum_punctuation.json | Commas (English) | Commas (English) (1); Commas (English) (2) |
| curriculum_punctuation.json | Capitalisation | Capitalisation (1); Capitalisation (2) |
| curriculum_relative_pronouns.json | What are relative pronouns? | What are relative pronouns? (1); What are relative pronouns? (2) |
| curriculum_relative_pronouns.json | Which relative pronoun to use | Which relative pronoun to use (1); Which relative pronoun to use (2) |
| curriculum_relative_pronouns.json | That vs which | That vs which (1); That vs which (2) |
| curriculum_relative_pronouns.json | Typical mistakes | Typical mistakes (1); Typical mistakes (2); Typical mistakes (2) |
| curriculum_reported_speech.json | Tense backshift | Tense backshift (1); Tense backshift (2) |
| curriculum_reported_speech.json | Reported questions and commands | Reported questions and commands (1); Reported questions and commands (2) |
| curriculum_reported_speech.json | Quick summary | Quick summary (1); Quick summary (2) |
| curriculum_sentence_transformation.json | What is it? | What is it? (1); What is it? (2) |
| curriculum_tenses_general.json | Introduction | Introduction (1); Introduction (2); Introduction (2); Introduction (3) |
| curriculum_tenses_general.json | Simple aspect | Simple aspect (1); Simple aspect (2) |
| curriculum_tenses_general.json | Continuous aspect | Continuous aspect (1); Continuous aspect (2) |
| curriculum_tenses_general.json | Perfect aspect | Perfect aspect (1); Perfect aspect (2) |
| curriculum_tenses_general.json | Perfect continuous aspect | Perfect continuous aspect (1); Perfect continuous aspect (1); Perfect continuous aspect (2) |
| curriculum_verb_subject_agreement.json | Third person singular: the -s | Third person singular: the -s (1); Third person singular: the -s (2) |
| curriculum_will_going_to.json | When to use WILL | When to use WILL (1); When to use WILL (2) |
| curriculum_will_going_to.json | The difference | The difference (1); The difference (2) |
| curriculum_will_going_to.json | Typical errors | Typical errors (1); Typical errors (2) |
| curriculum_word_formation.json | Common patterns | Common patterns (1); Common patterns (2) |
| curriculum_word_order.json | Three main problem areas | Three main problem areas (1); Three main problem areas (2); Three main problem areas (2) |
| curriculum_word_order.json | Embedded questions: no inversion | Embedded questions: no inversion (1); Embedded questions: no inversion (2) |
| curriculum_word_order.json | Embedded questions: when to use statement order | Embedded questions: when to use statement order (1); Embedded questions: when to use statement order (2) |
| curriculum_word_order.json | Frequency adverbs: where they go | Frequency adverbs: where they go (1); Frequency adverbs: where they go (1); Frequency adverbs: where they go (2) |
| curriculum_word_order.json | Frequency adverbs: common mistakes | Frequency adverbs: common mistakes (1); Frequency adverbs: common mistakes (2) |
| curriculum_word_order.json | Additive particles: "also" | Additive particles: "also" (1); Additive particles: "also" (1); Additive particles: "also" (2) |
| curriculum_word_order.json | "Also" vs "too" and "as well" | "Also" vs "too" and "as well" (1); "Also" vs "too" and "as well" (2) |
| curriculum_word_order.json | Summary | Summary (1); Summary (1); Summary (2) |
| curriculum.json | When to use CONTINUOUS | When to use CONTINUOUS (1); When to use CONTINUOUS (2) |
| curriculum.json | Common mistakes | Common mistakes (1); Common mistakes (2) |

## 5. Section count flags

- **More than 15** intro sections: likely too fragmented.
- **Fewer than 3** intro sections: likely too thin for a full topic lesson.

### Topics with >15 sections
- **curriculum_conjunctions_linkers.json** — 18 sections
- **curriculum_infinitive_ing.json** — 24 sections
- **curriculum_past_perfect.json** — 17 sections
- **curriculum_prepositions.json** — 38 sections
- **curriculum_word_order.json** — 22 sections

### Topics with <3 sections
- **curriculum_spelling.json** — 2 section(s)

---

*Automated audit; no curriculum files were modified.*