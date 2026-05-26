# RUE2 Reliability Fix Plan — Cursor Instructions

Use this document in Cursor Plan mode. Work through each phase in order. Each phase is self-contained. After completing a phase, test the app in the browser before moving to the next.

---

## Phase 0: Split the single file

Before making any other changes, split `index.html` into three files. This makes every subsequent phase easier and less error-prone.

1. Extract everything inside `<style>...</style>` into a new file called `style.css`. Replace the style block in `index.html` with `<link rel="stylesheet" href="style.css">`.

2. Extract everything inside `<script>...</script>` (the entire JS block at the bottom of the body) into a new file called `app.js`. Replace the script block in `index.html` with `<script src="app.js"></script>` just before `</body>`.

3. `index.html` should now contain only the HTML markup, the `<link>` to `style.css`, and the `<script>` tag loading `app.js`.

4. Test: open the app in a browser via a local server. Everything should work exactly as before.

5. Update `sw.js`: the fetch handler should also pass through requests for `style.css` and `app.js` (it already handles all same-origin GET requests with `cache: 'no-store'`, so this should work without changes, but verify).

---

## Phase 1: Fix broken data

### 1a. Fix curriculum_it_subject.json

This file has invalid JSON at line 86. The `options` object for one question uses backslash-escaped quotes (`\"To get up early is difficult.\"`) instead of regular JSON string values. Fix the escaping so the file parses as valid JSON. Verify by running `JSON.parse()` or `python3 -m json.tool curriculum_it_subject.json`.

### 1b. Audit all JSON files for parse errors

Run a script that loads every `.json` file in the project root and reports any that fail to parse. Fix any others found. There should be zero broken JSON files when this phase is complete.

---

## Phase 2: Improve answer matching

### 2a. Add contraction expansion to `answerMatches`

The current `answerMatches` function in `app.js` compares the user's normalised input against an array of accepted answers. It does not handle the case where the accepted answer is a contraction (e.g. `"can't"`) but the student types the expanded form (`"cannot"`), or vice versa.

Add a contraction expansion step. Here is the logic:

```
const CONTRACTIONS = {
  "can't": ["cannot", "can not"], "won't": ["will not"],
  "don't": ["do not"], "doesn't": ["does not"], "didn't": ["did not"],
  "mustn't": ["must not"], "shouldn't": ["should not"],
  "couldn't": ["could not"], "wouldn't": ["would not"],
  "haven't": ["have not"], "hasn't": ["has not"], "hadn't": ["had not"],
  "isn't": ["is not"], "aren't": ["are not"],
  "wasn't": ["was not"], "weren't": ["were not"],
  "i'm": ["i am"], "i've": ["i have"], "i'd": ["i would", "i had"],
  "i'll": ["i will"], "he's": ["he is", "he has"],
  "she's": ["she is", "she has"], "it's": ["it is", "it has"],
  "we're": ["we are"], "they're": ["they are"],
  "we've": ["we have"], "they've": ["they have"],
  "there's": ["there is", "there has"],
  "that's": ["that is", "that has"],
  "who's": ["who is", "who has"],
};

// Build reverse map too: "cannot" -> "can't", etc.
const EXPANDED = {};
for (const [contraction, expansions] of Object.entries(CONTRACTIONS)) {
  for (const exp of expansions) {
    if (!EXPANDED[exp]) EXPANDED[exp] = [];
    EXPANDED[exp].push(contraction);
  }
}
```

In `answerMatches`, after normalising both the user input and each accepted answer, also check whether the user's input is a known contraction/expansion variant of the accepted answer. The logic is:

- For each accepted answer `a`, build an expanded set that includes `a` itself plus any contraction/expansion equivalents of `a`.
- Check if the user input matches anything in that expanded set.

Important: this should only apply to the contraction/expansion itself, not to the surrounding words. For multi-word answers like `"have been waiting"`, don't try to expand partial contractions within the phrase — only expand when the *entire normalised answer* is a contraction or its expansion. For single-word answers this works naturally. For multi-word answers, also check if the user typed e.g. `"haven't been"` when the answer is `"have not been"` by doing a simple find-and-replace of all known contractions in the user string and the accepted string, then comparing the fully-expanded versions.

### 2b. Handle trailing/leading punctuation more aggressively

The current function strips trailing periods. Also strip:
- Trailing commas, semicolons, exclamation marks, question marks
- Leading/trailing quotation marks (both straight and curly: `'`, `'`, `"`, `"`, `"`)

### 2c. Handle "a"/"an" equivalence for article questions

For the articles topic specifically, if the accepted answer is `"a"` or `"an"`, also accept the other. A student who writes `"a"` when the answer is `"an"` is demonstrating they know an article is needed — the a/an distinction is a separate (and lesser) error. Only do this for questions in the articles topic.

---

## Phase 3: Back button and navigation

### 3a. Push history state on screen transitions

When the app shows a new screen (quiz, intro, exam cloze, results, etc.), push a history entry:

```javascript
history.pushState({ screen: 'quiz' }, '');
```

Do this in the functions that show each major screen: `showQuestion` (first call only, when starting a quiz), the exam cloze start, the intro screen, etc.

### 3b. Handle popstate

Add a `popstate` listener. When the user presses back:

- If a quiz is in progress (quizScreen, examClozeTestScreen, or examTransformTestScreen is visible), show a confirm dialog: "Leave this quiz? Your progress will be lost." If confirmed, return to the menu. If cancelled, push the state back.
- If on any other screen (intro, results, reference, etc.), return to the menu without confirmation.

```javascript
window.addEventListener('popstate', (e) => {
  // Determine which screen is active and handle accordingly
});
```

### 3c. Add exit confirmation to Back/Main Menu buttons during quizzes

Wrap the click handlers for `exitQuizBtn`, `quizMainMenuBtn`, `examClozeExitBtn`, `examClozeMainMenuBtn`, `examTransformExitBtn`, and `examTransformMainMenuBtn` with a confirmation check. Only show the confirmation if the student has answered at least one question (`currentIndex > 0`).

```javascript
if (currentIndex > 0 && !confirm('Leave this quiz? Your progress will be lost.')) return;
```

---

## Phase 4: Save and restore mid-quiz state

### 4a. Save state after each answer

After each call to `submitAnswer` (or after the user clicks Next), save the current quiz state to `sessionStorage`:

```javascript
function saveQuizState() {
  const state = {
    currentIndex,
    score,
    wrongIndices,
    currentTopic: currentTopic.id,
    quizMode,
    coursePart,
    coursePhase,
    currentSetId,
    currentSetTitle,
    timestamp: Date.now()
  };
  sessionStorage.setItem('rue2_quiz_state', JSON.stringify(state));
}
```

Call `saveQuizState()` in the `nextQuestion` function, right before showing the next question.

### 4b. Clear state when quiz finishes or user exits

In `finishQuiz()` and in all exit/back button handlers that return to the menu, clear the saved state:

```javascript
sessionStorage.removeItem('rue2_quiz_state');
```

### 4c. Check for saved state on app load

On app startup (in the init IIFE), after loading questions and rendering the menu, check if there's a saved quiz state:

```javascript
const saved = sessionStorage.getItem('rue2_quiz_state');
if (saved) {
  const state = JSON.parse(saved);
  // Only offer to resume if it's less than 2 hours old
  if (Date.now() - state.timestamp < 2 * 60 * 60 * 1000) {
    if (confirm('You have an unfinished quiz. Resume where you left off?')) {
      // Restore state and show the quiz screen
    } else {
      sessionStorage.removeItem('rue2_quiz_state');
    }
  } else {
    sessionStorage.removeItem('rue2_quiz_state');
  }
}
```

The restore logic needs to set all the relevant variables (`currentIndex`, `score`, `wrongIndices`, find the right topic and questions, etc.) and then call `showQuestion()`. This is the trickiest part — make sure you restore enough state that the quiz screen renders correctly, including the progress counter and the correct question.

Note: you do NOT need to save the full `currentQuestions` array (it could be large). Instead, save enough information to reconstruct it — the topic ID, set ID, quiz mode, and the random seed or question order if questions were shuffled. Alternatively, save the question hashes or indices into the original set. The simplest approach: save the full `currentQuestions` array. It's JSON-serialisable and sessionStorage can handle it.

---

## Phase 5: Content quality sweep

### 5a. Scan for single-answer open questions

Write a Node.js or Python script (a dev tool, not part of the app) that scans `questions.json` and all `curriculum_*.json` files and reports every open-type question that has only one accepted answer. Output a file listing them grouped by topic. This is a reference list for manual review — you don't need to fix all 1,439 at once, but having the list lets you prioritise.

### 5b. Prioritise multi-word answers

From the list above, flag questions where the single accepted answer is more than one word (e.g. `"have been waiting"`). These are the highest risk for false negatives because there are more ways to express the same thing. Review these first and add alternative accepted forms where appropriate.

### 5c. Check for questions with empty or very short explanations

Scan all questions (in `questions.json`, `curriculum_*.json`, and `exam_*.json`) and report any where the `explanation` field is empty, missing, or fewer than 10 characters. These give students no feedback when they get the answer wrong, which is frustrating. Prioritise adding explanations to these.

### 5d. Spelling correction questions — accept minor variants

For spelling questions (topic `spelling`), the student must type the entire corrected sentence. Currently there's only one accepted answer per question. These are very brittle because a student could correct the target spelling error perfectly but introduce a different minor typo elsewhere in the sentence, or change capitalisation, or omit the period. Consider either:
- Extracting just the corrected word and checking only that word (more tolerant), or
- Adding a "near match" check that highlights what the student typed differently from the expected answer, so they can see their correction was right even if the system marked it wrong.

The simpler approach: for spelling questions, compare the student's answer to the accepted answer and if the only differences are punctuation or capitalisation, accept it. You can do this with a normalisation step that strips all punctuation and lowercases before comparing, applied only to spelling-type questions.

---

## Phase 6: Quick-start and reduced menu friction

### 6a. Remember last activity

When a student starts a quiz (any mode), save their choice to `localStorage`:

```javascript
localStorage.setItem('rue2_last_activity', JSON.stringify({
  mode: quizMode, // 'normal', 'diagnostic', 'exam_cloze', etc.
  topicId: currentTopic.id,
  topicTitle: currentTopic.title
}));
```

### 6b. Show a "Continue" button on the main menu

On the main menu screen, if `rue2_last_activity` exists in localStorage, show a button at the top: "Continue: [Topic Title]" (or "Continue: Grammar Test" for diagnostic mode). Clicking it should take the student directly to that topic/mode, skipping the sub-menus. This reduces the most common flow from 4-6 clicks to 1.

Style it prominently — it should be the most visually obvious action on the menu.

---

## Phase 7: Service worker safety

### 7a. Remove the force-reload on activate

In `sw.js`, the activate handler includes this line:

```javascript
clients.forEach(function(c) { c.navigate(c.url); });
```

This force-reloads every open tab when a new service worker activates. Now that quiz state is saved to sessionStorage (Phase 4), this is less dangerous, but it's still disruptive — a student mid-quiz will see the page reload. Remove this line. The `skipWaiting` + `clients.claim` already ensures the new service worker takes over; the next fetch will use the new code via `cache: 'no-store'`.

---

## Testing checklist

After completing all phases, test the following on both a desktop browser and a phone (iOS Safari and/or Android Chrome):

- [ ] All topics load without errors (check browser console for JSON parse failures)
- [ ] "It as subject" topic works (was broken by invalid JSON)
- [ ] Typing "cannot" when the answer is "can't" is accepted (and vice versa)
- [ ] Typing "must not" when the answer is "mustn't" is accepted
- [ ] Trailing punctuation doesn't cause wrong answers
- [ ] Browser back button during a quiz shows a confirmation dialog
- [ ] Tapping Back or Main Menu during a quiz shows a confirmation dialog
- [ ] Closing and reopening the tab during a quiz offers to resume
- [ ] Switching apps on phone and returning preserves quiz state
- [ ] The "Continue" button appears on the main menu after completing a quiz
- [ ] Private/incognito browsing doesn't crash the app (no localStorage errors)
- [ ] The service worker doesn't force-reload the page
