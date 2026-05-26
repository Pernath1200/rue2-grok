# -*- coding: utf-8 -*-
"""Ensure each curriculum has practice_order pointing to a section with exactly 10 MC questions."""
import json
import os

SKIP_IDS = {'auxiliary_verbs', 'verb_subject_agreement', 'word_order', 'phrasal_verbs', 'quantifiers'}

def get_mc_questions(questions):
    return [q for q in questions if q.get('type') == 'mc']

def ensure_10_mc(data, path):
    intro_title = (data.get('intro') or {}).get('title') or 'Practice'
    practice = data.get('practice') or {}
    practice_order = data.get('practice_order') or []

    # Find any section with exactly 10 MC
    for key, section in practice.items():
        if not isinstance(section, dict):
            continue
        qs = section.get('questions') or []
        mc = get_mc_questions(qs)
        if len(mc) == 10:
            data['practice_order'] = [key]
            return True

    # Find a section with at least 10 MC -> use first 10 as "mc"
    for key, section in practice.items():
        if not isinstance(section, dict):
            continue
        qs = section.get('questions') or []
        mc = get_mc_questions(qs)
        if len(mc) >= 10:
            data['practice'] = data.get('practice') or {}
            title = section.get('title') or ('Practice: ' + intro_title)
            if 'multiple choice' not in title:
                title = title + ' (multiple choice)'
            data['practice']['mc'] = {'title': title, 'questions': mc[:10]}
            data['practice_order'] = ['mc']
            return True

    # Get MC from check and pad to 10
    check_qs = (data.get('check') or {}).get('questions') or []
    check_mc = get_mc_questions(check_qs)
    if len(check_mc) >= 5:
        while len(check_mc) < 10:
            check_mc.extend(check_mc[:10 - len(check_mc)])
        ten = check_mc[:10]
        if 'mc' not in practice:
            data['practice'] = data.get('practice') or {}
            data['practice']['mc'] = {
                'title': 'Practice: ' + intro_title + ' (multiple choice)',
                'questions': ten
            }
        else:
            data['practice']['mc']['questions'] = ten
            data['practice']['mc']['title'] = data['practice']['mc'].get('title') or 'Practice: ' + intro_title + ' (multiple choice)'
        data['practice_order'] = ['mc']
        return True
    return False

def main():
    for f in os.listdir('.'):
        if not f.startswith('curriculum_') or not f.endswith('.json'):
            continue
        topic_id = f.replace('curriculum_', '').replace('.json', '')
        if topic_id in SKIP_IDS:
            continue
        path = os.path.join('.', f)
        try:
            with open(path, 'r', encoding='utf-8') as file:
                data = json.load(file)
        except Exception as e:
            print(path, 'load error:', e)
            continue
        if 'practice' not in data:
            print(path, 'no practice, skip')
            continue
        if ensure_10_mc(data, path):
            with open(path, 'w', encoding='utf-8') as file:
                json.dump(data, file, ensure_ascii=False, indent=2)
            print(path, '-> practice_order set to 10 MC')
        else:
            print(path, 'could not ensure 10 MC (no check MC or practice MC)')

if __name__ == '__main__':
    main()
