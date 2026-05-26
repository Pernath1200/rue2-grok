# -*- coding: utf-8 -*-
"""Convert all MC questions in questions.json to open (error correction or gap-fill) format."""
import json

def convert_mc_to_open(q):
    if q.get('type') != 'mc':
        return q
    opts = q.get('options', {})
    correct_key = q.get('correct_option', 'b')
    correct_text = opts.get(correct_key, '')
    question_text = q.get('question', '')
    explanation = q.get('explanation', '')

    # If question is gap-fill style (has _____ or "I have _____") -> open gap-fill
    if '_____' in question_text or ('_____' in str(opts.values())):
        # Extract stem: e.g. "1. I have _____ milk in the fridge." -> "1. I have _____ milk in the fridge."
        stem = question_text.split('\n')[0] if '\n' in question_text else question_text
        # Remove leading number and period for consistency
        new_question = stem.strip()
        if not new_question.endswith('.'):
            new_question += '.'
        return {
            'type': 'open',
            'question': new_question + ' (Fill in the blank.)',
            'answers': [correct_text.strip()],
            'explanation': explanation
        }

    # Otherwise: "Wrong: '[wrong option].' Correct the sentence."
    wrong_key = 'a' if correct_key != 'a' else 'c'
    wrong_text = opts.get(wrong_key, list(opts.values())[0] if opts else '')
    wrong_text = wrong_text.strip()
    if not wrong_text.endswith('.'):
        wrong_text += '.'
    return {
        'type': 'open',
        'question': "Wrong: '" + wrong_text + "' Correct the sentence.",
        'answers': [correct_text.strip(), correct_text.strip().rstrip('.')],
        'explanation': explanation
    }

def main():
    with open('questions.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for topic_key, topic_data in data.items():
        if not isinstance(topic_data, dict):
            continue
        for set_key, set_data in topic_data.items():
            if not isinstance(set_data, dict) or 'questions' not in set_data:
                continue
            new_questions = []
            for q in set_data['questions']:
                if q.get('type') == 'mc':
                    new_questions.append(convert_mc_to_open(q))
                else:
                    new_questions.append(q)
            set_data['questions'] = new_questions

    with open('questions.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print('Converted all MC to open in questions.json')

if __name__ == '__main__':
    main()
