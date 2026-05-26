"""
English Grammar Check – Upper-intermediate grammar for Czech learners
Loads questions from questions.json. Supports multiple topics, sets, shuffle,
retry wrong, save scores, and export wrong answers for review.
"""
import json
import random
import textwrap
from datetime import datetime
from pathlib import Path

# Paths (same folder as this script)
BASE_DIR = Path(__file__).resolve().parent
QUESTIONS_FILE = BASE_DIR / "questions.json"
MANIFEST_FILE = BASE_DIR / "topics.json"
CURRICULUM_FILE = BASE_DIR / "curriculum.json"
SCORES_FILE = BASE_DIR / "scores.json"
REVIEW_FILE = BASE_DIR / "review_wrong_answers.txt"

# Current topic (set after user chooses); used by run_part1, run_part2
current_topic = {"curriculum": "curriculum.json", "questions_key": "sets", "title": "Present Perfect Simple vs Continuous"}


def load_manifest():
    """Load topic list from manifest.json. Returns list of topics or None if no manifest."""
    if not MANIFEST_FILE.exists():
        return None
    with open(MANIFEST_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("topics", [])


def load_curriculum(path=None):
    """Load guided course from a curriculum file. path = Path or filename; default current_topic curriculum."""
    p = path or BASE_DIR / current_topic["curriculum"]
    if isinstance(p, str):
        p = BASE_DIR / p
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load_questions(questions_key=None):
    """Load question sets from JSON. If questions_key given, return that topic's sets; else all data."""
    with open(QUESTIONS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    if questions_key is not None:
        return data.get(questions_key, {})
    return data


def load_scores():
    """Load score history. Returns list of {set_id, set_title, score, total, date}."""
    if not SCORES_FILE.exists():
        return []
    try:
        with open(SCORES_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("history", [])
    except (json.JSONDecodeError, IOError):
        return []


def save_score(set_id, set_title, score, total):
    """Append one score to history and save."""
    history = load_scores()
    history.append({
        "set_id": set_id,
        "set_title": set_title,
        "score": score,
        "total": total,
        "date": datetime.now().isoformat(),
    })
    with open(SCORES_FILE, "w", encoding="utf-8") as f:
        json.dump({"history": history}, f, indent=2)


def get_last_and_best(sets_data):
    """
    For each set (and 'all'), return last score and best score.
    Returns dict: set_id -> {"last": (score, total), "best": (score, total)}
    """
    history = load_scores()
    result = {}
    for sid in list(sets_data.keys()) + ["all"]:
        result[sid] = {"last": None, "best": None}
    for entry in history:
        sid = entry["set_id"]
        if sid not in result:
            result[sid] = {"last": None, "best": None}
        s, t = entry["score"], entry["total"]
        result[sid]["last"] = (s, t)
        if result[sid]["best"] is None or (s / t) > (result[sid]["best"][0] / result[sid]["best"][1]):
            result[sid]["best"] = (s, t)
    return result


def show_scores_summary(sets_data, set_ids, chosen_key):
    """Print last and best score for the chosen set if available."""
    stats = get_last_and_best(sets_data)
    if chosen_key not in stats:
        return
    last = stats[chosen_key]["last"]
    best = stats[chosen_key]["best"]
    if last is not None:
        print(f"  Last score for this set: {last[0]}/{last[1]}")
    if best is not None and (last is None or best != last):
        print(f"  Best score for this set:  {best[0]}/{best[1]}")


def normalize_answer(s):
    """Strip, lower, and collapse spaces for comparison."""
    return " ".join(s.strip().lower().split())


def answer_matches(user_answer, accepted_answers):
    """Check if user answer matches any accepted answer (normalized)."""
    user = normalize_answer(user_answer)
    for accepted in accepted_answers:
        if user == normalize_answer(accepted):
            return True
    return False


def ask_open_question(q, question_num, total):
    """Ask a fill-in / open / make-sentence / make-question. Uses 'prompt' or 'question'."""
    print(f"\n--- Question {question_num} of {total} ---")
    text = q.get("prompt") or q.get("question", "")
    print(text)
    user_answer = input("Your answer: ").strip()
    is_correct = answer_matches(user_answer, q["answers"])
    if is_correct:
        print("✅ Correct!")
    else:
        print("❌ Incorrect.")
        print("Correct answer(s):", " / ".join(q["answers"]))
    print("Explanation:", q["explanation"])
    return is_correct


def ask_mc_question(q, question_num, total):
    """Ask a multiple-choice question. Returns (correct: bool, user_choice)."""
    print(f"\n--- Question {question_num} of {total} ---")
    print(q["question"])
    for label, option in q["options"].items():
        print(f"  {label}) {option}")
    while True:
        user_answer = input("Your choice (a/b/c/d): ").strip().lower()
        if user_answer in q["options"]:
            break
        print("Please type a, b, c, or d.")
    is_correct = user_answer == q["correct_option"]
    if is_correct:
        print("✅ Correct!")
    else:
        correct_text = q["options"][q["correct_option"]]
        print(f"❌ Incorrect. Correct answer: {q['correct_option']}) {correct_text}")
    print("Explanation:", q["explanation"])
    return is_correct


def run_set(questions, title, shuffle=False, max_questions=None):
    """
    Run one set of questions. Returns (score, total, wrong_indices, questions_used).
    """
    qs = list(questions)
    if shuffle:
        random.shuffle(qs)
    if max_questions is not None and max_questions < len(qs):
        qs = qs[:max_questions]
    total = len(qs)
    score = 0
    wrong_indices = []

    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)

    for i, q in enumerate(qs):
        num = i + 1
        if q["type"] == "mc":
            correct = ask_mc_question(q, num, total)
        else:
            correct = ask_open_question(q, num, total)  # open, makesentence, makequestion
        if correct:
            score += 1
        else:
            wrong_indices.append(i)

    return score, total, wrong_indices, qs


def retry_wrong(questions_list, wrong_indices, title):
    """Retry only the questions the user got wrong."""
    if not wrong_indices:
        return
    to_retry = [questions_list[i] for i in wrong_indices]
    print("\n" + "-" * 60)
    print("Retry: questions you got wrong")
    print("-" * 60)
    for i, q in enumerate(to_retry):
        num = i + 1
        total = len(to_retry)
        if q["type"] == "mc":
            ask_mc_question(q, num, total)
        else:
            ask_open_question(q, num, total)
    print(f"\nRetry complete. {len(to_retry)} questions reviewed.")


def get_correct_answer_text(q):
    """Return a short string for the correct answer (for review file)."""
    if q["type"] == "mc":
        return q["options"].get(q["correct_option"], "")
    return " / ".join(q.get("answers", []))


def export_wrong_answers(questions_list, wrong_indices, set_title):
    """Write wrong questions to REVIEW_FILE for later review."""
    lines = [
        "=" * 60,
        f"Review: Wrong answers – {set_title}",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "=" * 60,
        "",
    ]
    for i in wrong_indices:
        q = questions_list[i]
        lines.append("-" * 40)
        lines.append("Question:" if "question" in q else "Prompt:")
        lines.append((q.get("question") or q.get("prompt", "")).strip())
        lines.append("")
        lines.append("Correct answer: " + get_correct_answer_text(q))
        lines.append("")
        lines.append("Explanation: " + q["explanation"])
        lines.append("")
    with open(REVIEW_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Saved to: {REVIEW_FILE}")


def show_intro(curriculum):
    """Display intro and rules sections. User presses Enter between sections."""
    intro = curriculum.get("intro", {})
    title = intro.get("title", "Introduction")
    sections = intro.get("sections", [])
    print("\n" + "=" * 60)
    print("  " + title)
    print("=" * 60)
    for i, sec in enumerate(sections, 1):
        print(f"\n--- {sec.get('title', f'Part {i}')} ---\n")
        print(textwrap.fill(sec.get("content", ""), width=70))
        input("\nPress Enter to continue...")
    print("\n" + "-" * 60)


def run_check(curriculum):
    """Run the 'test your knowledge' check questions. Returns (score, total)."""
    check_data = curriculum.get("check", {})
    questions = check_data.get("questions", []) if isinstance(check_data, dict) else check_data
    if not questions:
        return 0, 0
    title = check_data.get("title", "Test your understanding") if isinstance(check_data, dict) else "Test your understanding"
    print("\n" + "=" * 60)
    print("  " + title)
    print("=" * 60)
    score = 0
    for i, q in enumerate(questions, 1):
        total = len(questions)
        if q.get("type") == "mc":
            if ask_mc_question(q, i, total):
                score += 1
        else:
            if ask_open_question(q, i, total):
                score += 1
    return score, len(questions)


def run_practice_section(section_title, questions):
    """Run one practice section (gapfill, errorcorrection, makesentence, makequestion). Returns (score, total, wrong_indices, list)."""
    qs = list(questions)
    total = len(qs)
    score = 0
    wrong_indices = []
    print("\n" + "=" * 60)
    print("  " + section_title)
    print("=" * 60)
    for i, q in enumerate(qs):
        num = i + 1
        if q.get("type") == "mc":
            correct = ask_mc_question(q, num, total)
        else:
            correct = ask_open_question(q, num, total)
        if correct:
            score += 1
        else:
            wrong_indices.append(i)
    return score, total, wrong_indices, qs


def run_part1():
    """Part 1: Intro, rules & test (no practice)."""
    try:
        curriculum = load_curriculum()
    except FileNotFoundError:
        print("curriculum.json not found.")
        return
    except json.JSONDecodeError as e:
        print("Invalid curriculum.json:", e)
        return

    print("\n--- Part 1: Intro, rules & test ---")
    show_intro(curriculum)

    check_data = curriculum.get("check", {})
    questions = check_data.get("questions", []) if isinstance(check_data, dict) else check_data
    if questions:
        check_score, check_total = run_check(curriculum)
        save_score("part1_check", "Part 1 – Test", check_score, check_total)
        print(f"\nPart 1 complete. Score: {check_score}/{check_total}")
    else:
        print("\nPart 1 complete.")
    input("Press Enter to return to menu...")


def run_part2():
    """Part 2: Practice (gap fill → error correction → making sentences → making questions)."""
    try:
        curriculum = load_curriculum()
    except FileNotFoundError:
        print("curriculum.json not found.")
        return
    except json.JSONDecodeError as e:
        print("Invalid curriculum.json:", e)
        return

    print("\n--- Part 2: Practice ---")
    practice = curriculum.get("practice", {})
    order = curriculum.get("practice_order") or ["gapfill", "errorcorrection", "makesentence", "makequestion"]
    total_score = 0
    total_questions = 0

    for key in order:
        section = practice.get(key)
        if not section:
            continue
        title = section.get("title", key.replace("_", " ").title())
        questions = list(section.get("questions", []))
        if not questions:
            continue
        random.shuffle(questions)
        score, total, wrong_indices, questions_used = run_practice_section(title, questions)
        total_score += score
        total_questions += total
        save_score("part2_" + key, title, score, total)
        if wrong_indices:
            retry = input("\nRetry the questions you got wrong in this section? (y/n): ").strip().lower().startswith("y")
            if retry:
                retry_wrong(questions_used, wrong_indices, title + " (retry)")
        input("\nPress Enter to continue to the next section...")

    print("\n" + "=" * 60)
    print("  Part 2 complete!")
    print("=" * 60)
    print(f"Total practice score: {total_score}/{total_questions}")
    save_score("part2_full", "Part 2 – Practice", total_score, total_questions)
    input("Press Enter to return to menu...")


def main_menu(sets_data):
    """Show menu: choose set, options, run. Save scores, offer retry and export."""
    set_ids = list(sets_data.keys())
    if not set_ids:
        print("No question sets found in questions.json.")
        return

    print("\n" + "=" * 60)
    print("  English Grammar Check")
    print("=" * 60)
    stats = get_last_and_best(sets_data)
    if any(stats[s]["last"] is not None for s in stats):
        print("\nYour scores:")
        for sid in set_ids:
            if stats[sid]["last"] is not None:
                s, t = stats[sid]["last"]
                b = stats[sid]["best"]
                best_str = f" (best: {b[0]}/{b[1]})" if b and (b[0], b[1]) != (s, t) else ""
                print(f"  {sets_data[sid]['title']}: last {s}/{t}{best_str}")
        if stats.get("all", {}).get("last"):
            s, t = stats["all"]["last"]
            print(f"  All sets combined: last {s}/{t}")
    print("\nAvailable sets:")
    for i, sid in enumerate(set_ids, 1):
        title = sets_data[sid].get("title", sid)
        n = len(sets_data[sid].get("questions", []))
        print(f"  {i}) {title} ({n} questions)")
    print(f"  {len(set_ids) + 1}) All sets (combined)")
    print("  0) Quit")

    while True:
        choice = input("\nChoose a set (number): ").strip()
        if choice == "0":
            print("Bye!")
            return
        try:
            n_choice = int(choice)
            if 1 <= n_choice <= len(set_ids) + 1:
                break
        except ValueError:
            pass
        print("Please enter a valid number.")

    if n_choice == len(set_ids) + 1:
        all_questions = []
        combined_title = "All sets combined"
        set_id_for_scores = "all"
        for sid in set_ids:
            all_questions.extend(sets_data[sid]["questions"])
        set_questions = all_questions
        summary = "Mixed practice from all sets."
    else:
        set_id = set_ids[n_choice - 1]
        set_questions = sets_data[set_id]["questions"]
        combined_title = sets_data[set_id]["title"]
        set_id_for_scores = set_id
        summary = sets_data[set_id].get("summary", "")

    total_available = len(set_questions)
    print(f"\nThis set has {total_available} questions.")
    show_scores_summary(sets_data, set_ids, set_id_for_scores)
    use_max = input("How many to attempt? (Enter for all): ").strip()
    max_q = None
    if use_max:
        try:
            max_q = int(use_max)
            max_q = max(1, min(max_q, total_available))
        except ValueError:
            max_q = total_available

    shuffle = input("Shuffle order? (y/n, default n): ").strip().lower().startswith("y")

    score, total, wrong_indices, questions_used = run_set(
        set_questions, combined_title, shuffle=shuffle, max_questions=max_q
    )

    save_score(set_id_for_scores, combined_title, score, total)

    print("\n" + "=" * 60)
    print(f"Quiz finished! Score: {score} / {total}")
    print("=" * 60)
    if summary:
        print("\nRule summary:")
        print(textwrap.fill(summary, width=70))

    if wrong_indices:
        retry = input("\nRetry the questions you got wrong? (y/n): ").strip().lower().startswith("y")
        if retry:
            retry_wrong(questions_used, wrong_indices, "Retry")
        export_choice = input("Save wrong answers to a file for review? (y/n): ").strip().lower().startswith("y")
        if export_choice:
            export_wrong_answers(questions_used, wrong_indices, combined_title)

    print("\nDone. Run the program again to try another set or options.")


if __name__ == "__main__":
    try:
        all_data = load_questions()
    except FileNotFoundError:
        print("questions.json not found. Please add it in the same folder as this script.")
        all_data = {}
    except json.JSONDecodeError as e:
        print("Invalid questions.json:", e)
        all_data = {}

    topics = load_manifest()
    if topics:
        # Multiple topics: choose topic first
        print("\n" + "=" * 60)
        print("  Grammar Quiz – Choose topic")
        print("=" * 60)
        for i, t in enumerate(topics, 1):
            print(f"  {i}) {t.get('title', t.get('id', ''))}")
        print("  0) Quit")
        while True:
            t_choice = input("\nChoose a topic (number): ").strip()
            if t_choice == "0":
                print("Bye!")
                raise SystemExit(0)
            try:
                idx = int(t_choice)
                if 1 <= idx <= len(topics):
                    current_topic.update(topics[idx - 1])
                    break
            except ValueError:
                pass
            print("Please enter a valid number.")
        sets_data = all_data.get(current_topic["questions_key"], {})
    else:
        sets_data = all_data.get("sets", {})
        if not current_topic.get("title"):
            current_topic["title"] = "Present Perfect Simple vs Continuous"

    if not sets_data and not (BASE_DIR / current_topic["curriculum"]).exists():
        print("No question sets and no curriculum for this topic.")
        raise SystemExit(1)

    print("\n" + "=" * 60)
    print("  " + current_topic.get("title", "English Grammar Check"))
    print("=" * 60)
    if (BASE_DIR / current_topic["curriculum"]).exists():
        print("\n  1) Part 1: Intro, rules & test")
        print("  2) Part 2: Practice (gap fill → error correction → making sentences → making questions)")
        print("  3) Part 3: Free practice (choose a set)")
        print("  0) Quit")
        while True:
            choice = input("\nChoose 1, 2, 3, or 0: ").strip()
            if choice == "0":
                print("Bye!")
                break
            if choice == "1":
                run_part1()
                continue
            if choice == "2":
                run_part2()
                continue
            if choice == "3":
                if sets_data:
                    main_menu(sets_data)
                else:
                    print("No question sets for this topic.")
                continue
            print("Please enter 1, 2, 3, or 0.")
    else:
        if sets_data:
            main_menu(sets_data)
        else:
            print("No curriculum and no sets for this topic.")
