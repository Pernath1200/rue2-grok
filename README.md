# English Grammar Check

Upper-intermediate grammar practice for Czech learners (B1–B2): tenses, prepositions, relative pronouns, will vs going to, infinitive vs -ing.

> ⚠ **Pending integration (2026-05-18).** [`intake/from-rue2-a/`](intake/from-rue2-a/) holds 21 files lifted from the deleted `rue2-a` repo (15 A1 curriculum files, 4 FCE exam banks, A1/A2 vocab, workflow notes). Awaiting CEFR-tagging integration into the main curriculum. See [`intake/from-rue2-a/INTAKE.md`](intake/from-rue2-a/INTAKE.md) for the plan.

**Requirements:** Python 3 (for the console quiz and for running the web server). No extra packages needed.

---

## If you received this project

1. **Unzip** the folder (if you got a zip file) and open a terminal in that folder.
2. **Console quiz:** Run `python present_perfect_quiz.py` (or `py present_perfect_quiz.py` on Windows).
3. **Web quiz:** Run `python -m http.server 8000`, then open **http://localhost:8000/index.html** in your browser.
4. See the sections below for more detail.

---

## Getting the latest from GitHub

**On this laptop (after you make changes):**  
In the project folder:
```bash
git add .
git commit -m "Describe your changes"
git push
```

**On your other laptop (first time):**
```bash
git clone https://github.com/Pernath1200/tenses-quiz.git
cd tenses-quiz
```

**On your other laptop (to get your latest updates):**
```bash
cd tenses-quiz
git pull
```

---

## Contents

- **present_perfect_quiz.py** – Console quiz (run in terminal). Choose topic, then Part 1 (intro & test), Part 2 (practice), or Part 3 (free practice sets).
- **curriculum.json**, **curriculum_*.json** – Guided courses: intro, rules, check questions, practice. One file per topic.
- **questions.json** – Question sets for Part 3 and for practice sections. Keys: `sets`, `past_simple_present_perfect`, `prepositions`, `relative_pronouns`, `will_going_to`, `infinitive_ing`.
- **topics.json** – Lists all topics. Add entries to add new topics.
- **index.html** – Web quiz (open via a local server). Choose topic, then Part 1 / Part 2 / Part 3. Progress and scores in the browser.
- **scores.json** – Saved scores (created by the Python quiz; not in Git so each machine keeps its own).
- **review_wrong_answers.txt** – Exported wrong answers (created when you choose “Save wrong answers”; not in Git).

**Topics:** Present Perfect Simple vs Continuous, Past Simple vs Present Perfect, Prepositions, Relative pronouns, Will and going to, Infinitive and -ing form.

---

## Console quiz (Python)

1. Open a terminal in this folder.
2. Run:
   ```bash
   python present_perfect_quiz.py
   ```
3. Choose a **topic**, then **1) Part 1** (intro, rules & test), **2) Part 2** (practice), or **3) Part 3** (free practice – choose a set). Scores are saved automatically. After each section you can retry wrong answers; after a quiz you can export wrong answers to `review_wrong_answers.txt`.

## Web quiz

Use a local server (browsers don’t load local JSON when opening `index.html` directly):

1. Open a terminal in this folder.
2. Run:
   ```bash
   python -m http.server 8000
   ```
3. In your browser go to **http://localhost:8000** and open **index.html**.

Choose a **topic**, then **Part 1**, **Part 2**, or **Part 3**. Scores and progress are stored in the browser (localStorage).

---

## Sharing this project

- **GitHub:** Repo: **https://github.com/Pernath1200/tenses-quiz**. Clone or download; use `git pull` to get updates on another machine.
- **Zip:** Zip the folder and share; you can delete `scores.json` before zipping if you want a clean start elsewhere.
