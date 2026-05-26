import json
import os
from glob import glob
from datetime import datetime

LOG_PATH = os.path.join(os.path.dirname(__file__), ".cursor", "debug.log")


def log(hypothesis_id, location, message, data, run_id="initial"):
    """Append a single NDJSON log line to the debug log."""
    entry = {
        "id": f"log_{int(datetime.utcnow().timestamp()*1000)}_{hypothesis_id}",
        "timestamp": int(datetime.utcnow().timestamp() * 1000),
        "location": location,
        "message": message,
        "data": data,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
    }
    line = json.dumps(entry, ensure_ascii=False)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def normalize_answer(s: str) -> str:
    return " ".join(s.strip().lower().strip(".!?").split())


PREPOSITIONS = {
    "in",
    "on",
    "at",
    "under",
    "below",
    "above",
    "over",
    "between",
    "among",
    "next to",
    "beside",
    "by",
    "near",
    "behind",
    "in front of",
    "inside",
    "outside",
    "through",
    "across",
    "into",
    "onto",
    "off",
    "from",
    "to",
    "for",
    "of",
}


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log("LOAD", f"audit_questions.py", "Failed to load JSON", {"path": path, "error": str(e)})
        return None


def audit_mc_question(file_path, context_key, q_idx, q):
    """H1 + H4: MC questions with duplicate options or multiple preposition options."""
    options = q.get("options") or {}
    correct_key = q.get("correct_option")
    if not options or not correct_key:
        return

    # H1: duplicated option texts
    norm_to_keys = {}
    for key, text in options.items():
        norm = normalize_answer(str(text))
        norm_to_keys.setdefault(norm, []).append(key)

    for norm, keys in norm_to_keys.items():
        if len(keys) > 1 and correct_key in keys:
            log(
                "H1",
                "audit_questions.py",
                "MC question has duplicated option text including correct option",
                {
                    "file": os.path.basename(file_path),
                    "context": context_key,
                    "question_index": q_idx,
                    "question": q.get("question"),
                    "options": options,
                    "correct_option": correct_key,
                    "duplicate_norm": norm,
                    "duplicate_keys": keys,
                },
            )

    # H4: preposition-choice style MC
    preposition_keys = []
    for key, text in options.items():
        norm = normalize_answer(str(text))
        if norm in PREPOSITIONS:
            preposition_keys.append(key)

    if len(preposition_keys) >= 2 and options.get(correct_key) and normalize_answer(str(options[correct_key])) in PREPOSITIONS:
        log(
            "H4",
            "audit_questions.py",
            "Preposition MC question for manual context review",
            {
                "file": os.path.basename(file_path),
                "context": context_key,
                "question_index": q_idx,
                "question": q.get("question"),
                "options": options,
                "correct_option": correct_key,
                "preposition_keys": preposition_keys,
            },
        )


def audit_open_question(file_path, context_key, q_idx, q):
    """H2 + H4 for open questions."""
    answers = q.get("answers") or []
    if not answers:
        return

    norm_answers = [normalize_answer(str(a)) for a in answers]
    distinct = sorted(set(norm_answers))

    # H2: multiple distinct one-word answers
    if len(distinct) > 1:
        all_single_word = all(" " not in a for a in distinct)
        if all_single_word:
            log(
                "H2",
                "audit_questions.py",
                "Open question with multiple distinct single-word answers",
                {
                    "file": os.path.basename(file_path),
                    "context": context_key,
                    "question_index": q_idx,
                    "question": q.get("question"),
                    "answers": answers,
                    "normalized_answers": distinct,
                },
            )

    # H4: preposition open question
    if any(a in PREPOSITIONS for a in distinct):
        log(
            "H4",
            "audit_questions.py",
            "Preposition open question for manual context review",
            {
                "file": os.path.basename(file_path),
                "context": context_key,
                "question_index": q_idx,
                "question": q.get("question"),
                "answers": answers,
                "normalized_answers": distinct,
            },
        )


def audit_questions_in_list(file_path, context_key, questions):
    for idx, q in enumerate(questions):
        q_type = q.get("type")
        if q_type == "mc":
            audit_mc_question(file_path, context_key, idx, q)
        elif q_type == "open":
            audit_open_question(file_path, context_key, idx, q)


def audit_file(file_path):
    data = load_json(file_path)
    if data is None:
        return
    base = os.path.basename(file_path)

    # Top-level pools
    if base in ("questions.json", "mixed_cloze.json", "exam_open_cloze.json", "exam_word_formation.json", "exam_sentence_transformation.json"):
        if base == "questions.json":
            for topic_key, topic_sets in data.items():
                for set_key, set_data in topic_sets.items():
                    qs = set_data.get("questions") or []
                    context = f"{topic_key}:{set_key}"
                    audit_questions_in_list(file_path, context, qs)
        elif base == "mixed_cloze.json":
            qs = data.get("questions") or []
            audit_questions_in_list(file_path, "mixed_cloze", qs)
        elif base == "exam_open_cloze.json":
            for level, tests in data.items():
                for t_idx, test in enumerate(tests):
                    gaps = test.get("gaps") or []
                    # Treat each gap as an open question with answers/options
                    fake_questions = []
                    for g in gaps:
                        if "options" in g and "correct_option" in g:
                            fake_questions.append({"type": "mc", "question": test.get("title"), "options": g["options"], "correct_option": g["correct_option"]})
                        elif "answers" in g:
                            fake_questions.append({"type": "open", "question": test.get("title"), "answers": g["answers"]})
                    context = f"exam_open_cloze:{level}:test{t_idx}"
                    audit_questions_in_list(file_path, context, fake_questions)
        elif base == "exam_word_formation.json":
            for level, tests in data.items():
                for t_idx, test in enumerate(tests):
                    gaps = test.get("gaps") or []
                    fake_questions = []
                    for g in gaps:
                        if "options" in g and "correct_option" in g:
                            fake_questions.append({"type": "mc", "question": test.get("title"), "options": g["options"], "correct_option": g["correct_option"]})
                        elif "answers" in g:
                            fake_questions.append({"type": "open", "question": test.get("title"), "answers": g["answers"]})
                    context = f"exam_word_formation:{level}:test{t_idx}"
                    audit_questions_in_list(file_path, context, fake_questions)
        elif base == "exam_sentence_transformation.json":
            for level, tests in data.items():
                for t_idx, test in enumerate(tests):
                    items = test.get("items") or []
                    fake_questions = []
                    for item in items:
                        if "answers" in item:
                            fake_questions.append(
                                {
                                    "type": "open",
                                    "question": f"{item.get('sentence1', '')} / {item.get('keyword', '')} / {item.get('sentence2_prefix', '')} ___ {item.get('sentence2_suffix', '')}",
                                    "answers": item["answers"],
                                }
                            )
                    context = f"exam_sentence_transformation:{level}:test{t_idx}"
                    audit_questions_in_list(file_path, context, fake_questions)
        return

    # Curriculum files: look for check and practice sections
    if base.startswith("curriculum") and isinstance(data, dict):
        check = data.get("check") or {}
        if "questions" in check:
            audit_questions_in_list(file_path, f"{base}:check", check["questions"])
        practice = data.get("practice") or {}
        for section_key, section in practice.items():
            qs = section.get("questions") or []
            context = f"{base}:practice:{section_key}"
            audit_questions_in_list(file_path, context, qs)


def main():
    root = os.path.dirname(__file__)
    # Core JSON files in root
    candidates = [
        "questions.json",
        "mixed_cloze.json",
        "exam_open_cloze.json",
        "exam_word_formation.json",
        "exam_sentence_transformation.json",
    ]
    for name in candidates:
        path = os.path.join(root, name)
        if os.path.exists(path):
            audit_file(path)

    # All curriculum_*.json files
    for path in glob(os.path.join(root, "curriculum_*.json")):
        audit_file(path)


if __name__ == "__main__":
    main()

