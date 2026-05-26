import state from './state.js';
import { showScreen, showMenuPanel, fetchJSON, escapeAndBold, toTitleCase, normalize } from './ui.js';

let _onShowExamPracticeMenu = function() {};
let _onShowWritingTipsIntroSection = null;

export function registerCallbacks({ showExamPracticeMenu, showWritingTipsIntroSection }) {
  _onShowExamPracticeMenu = showExamPracticeMenu || function() {};
  _onShowWritingTipsIntroSection = showWritingTipsIntroSection;
}

export function renderPrepositionsListContent(data) {
  const title = data.title || 'Prepositions in English';
  document.getElementById('prepositionsListTitle').textContent = title;
  const content = document.getElementById('prepositionsListContent');
  content.innerHTML = '';
  const addList = (label, arr) => {
    if (!arr || !arr.length) return;
    const h3 = document.createElement('h3');
    h3.textContent = label;
    content.appendChild(h3);
    const div = document.createElement('div');
    div.className = 'list-words';
    arr.forEach(w => {
      const span = document.createElement('span');
      span.textContent = w;
      div.appendChild(span);
    });
    content.appendChild(div);
  };
  addList('Top 20 (most common)', data.top20 || []);
  addList('Top 50', data.top50 || []);
  addList('Complete list', data.complete || []);
}

export function prepositionsListAsText(data) {
  const preps = data.prepositions || [];
  if (preps.length) {
    const lines = [(data.title || 'Prepositions in English'), '', 'Preposition\tCategory\tExample'];
    preps.forEach(entry => {
      lines.push((entry.preposition || '') + '\t' + (entry.category || '') + '\t' + (entry.example || ''));
    });
    return lines.join('\n');
  }
  return (data.title || 'Prepositions in English') + '\n\n(No list)';
}

export async function showPrepositionsList(returnTo) {
  state.prepositionsListReturnTo = returnTo || 'menu';
  if (!state.prepositionsListData) {
    try { state.prepositionsListData = await fetchJSON('prepositions_list.json'); } catch (e) {
      alert('Could not load preposition list. ' + e.message); return;
    }
  }
  renderPrepositionsListContent(state.prepositionsListData);
  showScreen('prepositionsListScreen');
}

export function hidePrepositionsList() {
  if (state.prepositionsListReturnTo === 'intro') {
    document.body.classList.add('viewing-content');
    showScreen('introScreen');
  } else {
    showScreen('menuScreen');
  }
}

export function renderPhrasalVerbsDictionaryContent(data) {
  const title = data.title || 'Phrasal verb dictionary';
  document.getElementById('phrasalVerbsDictionaryTitle').textContent = title;
  const content = document.getElementById('phrasalVerbsDictionaryContent');
  content.innerHTML = '';
  const addSection = (label, arr) => {
    if (!arr || !arr.length) return;
    const h3 = document.createElement('h3');
    h3.textContent = label;
    content.appendChild(h3);
    const list = document.createElement('div');
    list.className = 'phrasal-verb-list';
    arr.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'phrasal-verb-entry';
      div.style.marginBottom = '0.5rem';
      div.innerHTML = '<strong>' + (entry.verb || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</strong> – ' + escapeAndBold(entry.meaning || '') + '. <span class="muted">' + escapeAndBold(entry.example || '') + '</span>';
      list.appendChild(div);
    });
    content.appendChild(list);
  };
  addSection('Top 50 (most common)', data.top50 || []);
  addSection('Next 100', data.next100 || []);
}

export function phrasalVerbsDictionaryAsText(data) {
  const lines = [(data.title || 'Phrasal verb dictionary'), ''];
  const addSection = (label, arr) => {
    if (!arr || !arr.length) return;
    lines.push(label);
    lines.push('');
    arr.forEach(entry => {
      lines.push(entry.verb + ' – ' + entry.meaning + '. Example: ' + entry.example);
    });
    lines.push('');
  };
  addSection('Top 50 (most common)', data.top50 || []);
  addSection('Next 100', data.next100 || []);
  return lines.join('\n');
}

export async function showPhrasalVerbsDictionary(returnTo) {
  state.phrasalVerbsDictionaryReturnTo = returnTo || 'menu';
  if (!state.phrasalVerbsDictionaryData) {
    try { state.phrasalVerbsDictionaryData = await fetchJSON('phrasal_verbs_dictionary.json'); } catch (e) {
      alert('Could not load phrasal verb dictionary. ' + e.message); return;
    }
  }
  renderPhrasalVerbsDictionaryContent(state.phrasalVerbsDictionaryData);
  showScreen('phrasalVerbsDictionaryScreen');
}

export function hidePhrasalVerbsDictionary() {
  if (state.phrasalVerbsDictionaryReturnTo === 'intro') {
    document.body.classList.add('viewing-content');
    showScreen('introScreen');
  } else {
    showScreen('menuScreen');
  }
}

export function renderReferenceIndex() {
  state.referenceView = 'index';
  document.getElementById('referenceTitle').textContent = 'Reference';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  const p = document.createElement('p');
  p.style.color = 'var(--muted)';
  p.style.marginBottom = '0.5rem';
  p.style.fontSize = '0.9rem';
  p.textContent = 'Choose a list:';
  content.appendChild(p);
  const grid = document.createElement('div');
  grid.className = 'reference-index-grid';
  const items = [
    ['Verb Patterns: to-infinitive, -ing & bare infinitive', showReferenceInfinitiveIng],
    ['Modal Verbs', showReferenceModalVerbs],
    ['Phrasal Verb Dictionary', showReferencePhrasalVerbs],
    ['Prepositions List', showReferencePrepositions],
    ['Dependent Prepositions: Verbs', () => showReferenceDependentSection('verbs')],
    ['Dependent Prepositions: Nouns', () => showReferenceDependentSection('nouns')],
    ['Dependent Prepositions: Adjectives', () => showReferenceDependentSection('adjectives')],
    ['Preposition + Verb Compound Nouns', () => showReferenceDependentSection('compound_nouns')],
    ['Nouns: Uncountable and Always-Plural', showReferenceCountableUncountable],
    ['Open Cloze: Word types', showReferenceOpenCloze],
    ['Fixed Phrases', showReferenceFixedPhrases],
    ['Word Formation: Prefixes & Suffixes', showReferenceWordFormation],
    ['Linkers and Conjunctions', showReferenceConjunctionsLinkers],
    ['Reported Speech', showReferenceReportedSpeech],
    ['Irregular Verbs', showReferenceIrregularVerbs]
  ];
  items.forEach(([text, fn]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    btn.textContent = text;
    btn.addEventListener('click', fn);
    grid.appendChild(btn);
  });
  content.appendChild(grid);
  document.getElementById('referencePrintDownloadWrap').classList.add('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Main Menu';
}

export function renderReferencePrepositionsContent(data) {
  if (!data) return;
  state.referenceView = 'prepositions';
  document.getElementById('referenceTitle').textContent = data.title || 'Prepositions in English';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const preps = data.prepositions || [];
  if (preps.length) {
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Preposition</th><th>Category</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    preps.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.preposition) + '</td><td>' + escapeAndBold(entry.category) + '</td><td>' + escapeAndBold(entry.example) + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferencePrepositions() {
  if (!state.prepositionsListData) {
    try {
      state.prepositionsListData = await fetchJSON('prepositions_list.json');
    } catch (e) {
      alert('Could not load preposition list. ' + e.message); return;
    }
  }
  renderReferencePrepositionsContent(state.prepositionsListData);
}



export function renderReferenceOpenClozeContent(data) {
  if (!data) return;
  state.referenceView = 'open_cloze';
  document.getElementById('referenceTitle').textContent = data.title || 'Open Cloze: Word types';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }
  const categories = data.categories || [];
  if (categories.length) {
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.style.tableLayout = 'fixed';
    table.style.width = '100%';
    table.innerHTML = '<colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup><thead><tr><th>Type</th><th>Definition</th><th>Words</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    categories.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.type) + '</td><td>' + escapeAndBold(entry.definition || entry.description || '') + '</td><td>' + escapeAndBold(entry.words || '') + '</td><td class="reference-example-cell"></td>';
      const exampleCell = tr.querySelector('.reference-example-cell');
      if (exampleCell && entry.example) exampleCell.innerHTML = entry.example;
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceOpenCloze() {
  if (!state.referenceOpenClozeData) {
    try {
      state.referenceOpenClozeData = await fetchJSON('reference_open_cloze.json');
    } catch (e) {
      alert('Could not load Open Cloze reference. ' + (e && e.message));
      return;
    }
  }
  renderReferenceOpenClozeContent(state.referenceOpenClozeData);
}

export function switchToReference(returnTo) {
  state.referenceReturnTo = returnTo || 'menu';
  showScreen('referenceScreen');
  var rw = document.getElementById('referenceBtnWrap');
  if (rw) rw.classList.add('hidden');
  document.body.classList.remove('viewing-content');
  document.body.classList.add('viewing-reference');
}

export async function showOpenClozeRefFromIntro() {
  switchToReference('intro');
  await showReferenceOpenCloze();
}

export async function showFixedPhrasesRefFromIntro() {
  switchToReference('intro');
  await showReferenceFixedPhrases();
}

export async function showReportedSpeechRefFromIntro() {
  switchToReference('intro');
  await showReferenceReportedSpeech();
}

export async function showInfinitiveIngRefFromIntro() {
  switchToReference('intro');
  await showReferenceInfinitiveIng();
}

export async function showConjunctionsLinkersRefFromIntro() {
  switchToReference('intro');
  await showReferenceConjunctionsLinkers();
}

export function renderReferenceWordFormationContent(data) {
  if (!data) return;
  state.referenceView = 'word_formation';
  document.getElementById('referenceTitle').textContent = data.title || 'Word Formation: Prefixes and Suffixes';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }
  const prefixes = data.prefixes || [];
  if (prefixes.length) {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.style.color = 'var(--accent)';
    h3.textContent = '30 common prefixes';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.style.marginBottom = '1.5rem';
    table.innerHTML = '<thead><tr><th>Prefix</th><th>Meaning</th><th>Example words</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    prefixes.forEach(entry => {
      const tr = document.createElement('tr');
      const ex = (entry.examples || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      tr.innerHTML = '<td>' + escapeAndBold(entry.prefix || '') + '</td><td>' + escapeAndBold(entry.meaning || '') + '</td><td>' + ex + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  const suffixes = data.suffixes || [];
  if (suffixes.length) {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.style.color = 'var(--accent)';
    h3.textContent = '30 common suffixes';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Suffix</th><th>Part of speech</th><th>Example words</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    suffixes.forEach(entry => {
      const tr = document.createElement('tr');
      const ex = (entry.examples || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      tr.innerHTML = '<td>' + escapeAndBold(entry.suffix || '') + '</td><td>' + escapeAndBold(entry.partOfSpeech || '') + '</td><td>' + ex + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceWordFormation() {
  if (!state.referenceWordFormationData) {
    try {
      state.referenceWordFormationData = await fetchJSON('reference_word_formation.json');
    } catch (e) {
      alert('Could not load Word Formation reference. ' + (e && e.message));
      return;
    }
  }
  renderReferenceWordFormationContent(state.referenceWordFormationData);
}

export function renderReferenceConjunctionsLinkersContent(data) {
  if (!data) return;
  state.referenceView = 'conjunctions_linkers';
  document.getElementById('referenceTitle').textContent = data.title || 'Linkers and Conjunctions';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }
  const categories = data.logical_categories || [];
  if (categories.length) {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.style.color = 'var(--accent)';
    h3.textContent = 'Four logical categories';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.style.marginBottom = '1.5rem';
    table.style.tableLayout = 'fixed';
    table.style.width = '100%';
    table.innerHTML = '<colgroup><col style="width: 22%; min-width: 8em;"><col style="width: 38%"><col style="width: 40%"></colgroup><thead><tr><th>Category</th><th>Meaning</th><th>Linkers and conjunctions</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    categories.forEach(entry => {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td');
      td0.style.whiteSpace = 'nowrap';
      td0.innerHTML = escapeAndBold(entry.category || '');
      const td1 = document.createElement('td');
      td1.innerHTML = escapeAndBold(entry.meaning || '');
      const td2 = document.createElement('td');
      td2.innerHTML = escapeAndBold(entry.linkers || '');
      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  const essayLinkers = data.essay_linkers || [];
  if (essayLinkers.length) {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.style.color = 'var(--accent)';
    h3.textContent = 'Linkers in essays and writing tasks';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Phrase</th><th>Use</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    essayLinkers.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.phrase || '') + '</td><td>' + escapeAndBold(entry.use || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceConjunctionsLinkers() {
  if (!state.referenceConjunctionsLinkersData) {
    try {
      state.referenceConjunctionsLinkersData = await fetchJSON('reference_conjunctions_linkers.json');
    } catch (e) {
      alert('Could not load Linkers and Conjunctions reference. ' + (e && e.message));
      return;
    }
  }
  renderReferenceConjunctionsLinkersContent(state.referenceConjunctionsLinkersData);
}

export function renderReferenceReportedSpeechContent(data) {
  if (!data) return;
  state.referenceView = 'reported_speech';
  document.getElementById('referenceTitle').textContent = data.title || 'Reported Speech: Quick Reference';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';

  const addHeading = (text) => {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.style.color = 'var(--accent)';
    h3.textContent = text;
    content.appendChild(h3);
  };

  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }

  const backshift = data.backshift || [];
  if (backshift.length) {
    addHeading('Tense backshift');
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Direct</th><th>Reported</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    backshift.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.direct || '') + '</td><td>' + escapeAndBold(entry.reported || '') + '</td><td>' + escapeAndBold(entry.example || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }

  const pronounShifts = data.pronoun_shifts || [];
  if (pronounShifts.length) {
    addHeading('Pronoun changes');
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Direct</th><th>Reported</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    pronounShifts.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.direct || '') + '</td><td>' + escapeAndBold(entry.reported || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }

  const timePlaceShifts = data.time_place_shifts || [];
  if (timePlaceShifts.length) {
    addHeading('Time and place changes');
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Direct</th><th>Reported</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    timePlaceShifts.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.direct || '') + '</td><td>' + escapeAndBold(entry.reported || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }

  const patterns = data.patterns || [];
  if (patterns.length) {
    addHeading('Core reporting patterns');
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Rule</th><th>Form</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    patterns.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.rule || '') + '</td><td>' + escapeAndBold(entry.form || '') + '</td><td>' + escapeAndBold(entry.example || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }

  const noBackshift = data.no_backshift || [];
  if (noBackshift.length) {
    addHeading('When no backshift is needed');
    const ul = document.createElement('ul');
    ul.style.margin = '0 0 1rem 1.1rem';
    ul.style.padding = '0';
    ul.style.lineHeight = '1.55';
    noBackshift.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = escapeAndBold(item || '');
      ul.appendChild(li);
    });
    content.appendChild(ul);
  }

  const commonErrors = data.common_errors || [];
  if (commonErrors.length) {
    addHeading('Common errors');
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Wrong</th><th>Right</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    commonErrors.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.wrong || '') + '</td><td>' + escapeAndBold(entry.right || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }

  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export function renderReferenceIrregularVerbsContent(data) {
  if (!data) return;
  state.referenceView = 'irregular_verbs';
  document.getElementById('referenceTitle').textContent = data.title || '50 Common Irregular Verbs';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }
  const verbs = data.verbs || [];
  if (verbs.length) {
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Base</th><th>Past</th><th>Past participle</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    verbs.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.base || '') + '</td><td>' + escapeAndBold(entry.past || '') + '</td><td>' + escapeAndBold(entry.pastPart || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceIrregularVerbs() {
  if (!state.referenceIrregularVerbsData) {
    try {
      state.referenceIrregularVerbsData = await fetchJSON('reference_irregular_verbs.json');
    } catch (e) {
      alert('Could not load Irregular Verbs reference. ' + (e && e.message));
      return;
    }
  }
  switchToReference('menu');
  document.body.classList.add('viewing-content');
  renderReferenceIrregularVerbsContent(state.referenceIrregularVerbsData);
}

export async function showReferenceReportedSpeech() {
  if (!state.referenceReportedSpeechData) {
    try {
      state.referenceReportedSpeechData = await fetchJSON('reference_reported_speech.json');
    } catch (e) {
      alert('Could not load Reported Speech reference. ' + (e && e.message));
      return;
    }
  }
  renderReferenceReportedSpeechContent(state.referenceReportedSpeechData);
}

export function renderReferenceFixedPhrasesContent(data) {
  if (!data) return;
  state.referenceView = 'fixed_phrases';
  document.getElementById('referenceTitle').textContent = data.title || 'Common fixed phrases';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }
  const phrases = data.phrases || [];
  if (phrases.length) {
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Phrase</th><th>Meaning</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    phrases.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.phrase || '') + '</td><td>' + escapeAndBold(entry.meaning || '') + '</td><td>' + escapeAndBold(entry.example || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  const makeDo = data.make_do || [];
  if (makeDo.length) {
    const h3 = document.createElement('h3');
    h3.style.marginTop = '1.25rem';
    h3.style.marginBottom = '0.5rem';
    h3.style.fontSize = '1rem';
    h3.style.color = 'var(--accent)';
    h3.textContent = 'Make and do + noun (collocations)';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Phrase</th><th>Meaning</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    makeDo.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.phrase || '') + '</td><td>' + escapeAndBold(entry.meaning || '') + '</td><td>' + escapeAndBold(entry.example || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export function renderWritingTipsContent(data) {
  if (!data) return;
  state.referenceView = 'writing_tips';
  document.getElementById('referenceTitle').textContent = data.title || 'Writing Tips';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.marginBottom = '1rem';
    p.style.fontSize = '0.9rem';
    p.textContent = data.intro;
    content.appendChild(p);
  }
  const sections = data.sections || [];
  sections.forEach(function(section) {
    const h3 = document.createElement('h3');
    h3.style.marginTop = '1rem';
    h3.style.marginBottom = '0.35rem';
    h3.textContent = section.title || '';
    content.appendChild(h3);
    const sectionContent = section.content || '';
    const paragraphs = sectionContent.split(/\n\n+/);
    paragraphs.forEach(function(para) {
      const text = para.trim();
      if (!text) return;
      const p = document.createElement('p');
      p.style.marginBottom = '0.5rem';
      p.style.fontSize = '0.95rem';
      p.innerHTML = escapeAndBold(text);
      content.appendChild(p);
    });
  });
  const commonErrors = data.commonErrors || [];
  if (commonErrors.length > 0) {
    const h3 = document.createElement('h3');
    h3.style.marginTop = '1.25rem';
    h3.style.marginBottom = '0.35rem';
    h3.textContent = 'Common errors';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Wrong</th><th>Right</th><th>Explanation</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    commonErrors.forEach(function(entry) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.wrong || '') + '</td><td>' + escapeAndBold(entry.right || '') + '</td><td>' + escapeAndBold(entry.explanation || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = state.referenceReturnTo === 'exam_practice' ? 'Back to Exam Practice' : 'Back to Reference';
}

export async function showWritingTips(returnTo) {
  state.referenceReturnTo = returnTo || 'menu';
  if (!state.writingTipsData) {
    try {
      state.writingTipsData = await fetchJSON('writing_tips.json');
    } catch (e) {
      alert('Could not load Writing Tips. ' + (e && e.message));
      return;
    }
  }
  if (state.referenceReturnTo === 'exam_practice') {
    state.writingTipsIntroActive = true;
    state.writingTipsIntroSectionIndex = 0;
    document.getElementById('menuScreen').classList.add('hidden');
    var mep = document.getElementById('menuExamPractice');
    if (mep) mep.classList.add('hidden');
    var rw = document.getElementById('referenceBtnWrap');
    if (rw) rw.classList.add('hidden');
    document.body.classList.add('viewing-content');
    document.getElementById('introScreen').classList.remove('hidden');
    _onShowWritingTipsIntroSection(0);
    return;
  }
  renderWritingTipsContent(state.writingTipsData);
  switchToReference(state.referenceReturnTo);
  document.body.classList.add('viewing-content');
}

export async function showReferenceFixedPhrases() {
  if (!state.referenceFixedPhrasesData) {
    try {
      state.referenceFixedPhrasesData = await fetchJSON('reference_fixed_phrases.json');
    } catch (e) {
      alert('Could not load Fixed Phrases reference. ' + (e && e.message));
      return;
    }
  }
  renderReferenceFixedPhrasesContent(state.referenceFixedPhrasesData);
}

const DEPENDENT_SECTION_VIEWS = { verbs: 'dependent_verbs', nouns: 'dependent_nouns', adjectives: 'dependent_adjectives', compound_nouns: 'compound_nouns' };

export function getParticleFromPhrase(phrase) {
  if (!phrase || typeof phrase !== 'string') return '';
  const last = phrase.trim().split(/\s+/).pop() || '';
  const first = last.split(/\s*\/\s*/)[0].trim();
  return first || last;
}

const COMPOUND_PREFIXES = ['under', 'over', 'with', 'out', 'down', 'up', 'on', 'off', 'by', 'in'];

export function getPrefixForCompound(word) {
  if (!word || typeof word !== 'string') return '';
  const w = word.toLowerCase();
  for (let i = 0; i < COMPOUND_PREFIXES.length; i++) {
    if (w.indexOf(COMPOUND_PREFIXES[i]) === 0) return COMPOUND_PREFIXES[i];
  }
  return '';
}

export function groupByParticle(arr, getParticle) {
  const groups = {};
  (arr || []).forEach(entry => {
    const p = getParticle(entry);
    if (!groups[p]) groups[p] = [];
    groups[p].push(entry);
  });
  return groups;
}

export function renderReferenceDependentSection(data, section) {
  if (!data) return;
  state.referenceView = DEPENDENT_SECTION_VIEWS[section] || 'dependent_verbs';
  const titles = { verbs: data.title_verbs, nouns: data.title_nouns, adjectives: data.title_adjectives, compound_nouns: data.title_compound_nouns };
  document.getElementById('referenceTitle').textContent = titles[section] || 'Dependent prepositions';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const addGroup = (particle, entries, cols) => {
    const h3 = document.createElement('h3');
    h3.textContent = 'Particle: ' + particle;
    h3.style.fontSize = '1rem';
    h3.style.color = 'var(--accent)';
    h3.style.marginTop = '1rem';
    h3.style.marginBottom = '0.5rem';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    const headers = cols.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('</th><th>');
    table.innerHTML = '<thead><tr><th>' + headers + '</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    entries.forEach(entry => {
      const cells = cols.map(c => escapeAndBold(entry[c] || ''));
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + cells.join('</td><td>') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  };
  if (section === 'verbs') {
    const arr = data.dependent_verbs || [];
    const groups = groupByParticle(arr, e => getParticleFromPhrase(e.phrase));
    const particles = Object.keys(groups).filter(Boolean).sort();
    particles.forEach(particle => addGroup(particle, groups[particle], ['phrase', 'meaning', 'example']));
  } else if (section === 'nouns') {
    const arr = data.dependent_nouns || [];
    const groups = groupByParticle(arr, e => getParticleFromPhrase(e.phrase));
    const particles = Object.keys(groups).filter(Boolean).sort();
    particles.forEach(particle => addGroup(particle, groups[particle], ['phrase', 'example']));
  } else if (section === 'adjectives') {
    const arr = data.dependent_adjectives || [];
    const groups = groupByParticle(arr, e => getParticleFromPhrase(e.phrase));
    const particles = Object.keys(groups).filter(Boolean).sort();
    particles.forEach(particle => addGroup(particle, groups[particle], ['phrase', 'meaning', 'example']));
  } else if (section === 'compound_nouns') {
    const arr = data.compound_nouns || [];
    const groups = groupByParticle(arr, e => getPrefixForCompound(e.word));
    const particles = Object.keys(groups).filter(Boolean).sort();
    particles.forEach(particle => addGroup(particle, groups[particle], ['word', 'meaning', 'example']));
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceDependentSection(section) {
  if (!state.dependentPrepositionsData) {
    try {
      state.dependentPrepositionsData = await fetchJSON('reference_dependent_prepositions.json');
    } catch (e) {
      alert('Could not load list. ' + e.message);
      return;
    }
  }
  renderReferenceDependentSection(state.dependentPrepositionsData, section);
}

export function dependentPrepositionsSectionAsText(data, section) {
  if (!data) return '';
  const titles = { verbs: data.title_verbs, nouns: data.title_nouns, adjectives: data.title_adjectives, compound_nouns: data.title_compound_nouns };
  const lines = [(titles[section] || section), ''];
  const addGroup = (particle, entries, cols) => {
    lines.push('Particle: ' + particle);
    lines.push(cols.join('\t'));
    entries.forEach(entry => { lines.push(cols.map(c => entry[c] || '').join('\t')); });
    lines.push('');
  };
  if (section === 'verbs') {
    const arr = data.dependent_verbs || [];
    const groups = groupByParticle(arr, e => getParticleFromPhrase(e.phrase));
    Object.keys(groups).filter(Boolean).sort().forEach(particle => addGroup(particle, groups[particle], ['phrase', 'meaning', 'example']));
  } else if (section === 'nouns') {
    const arr = data.dependent_nouns || [];
    const groups = groupByParticle(arr, e => getParticleFromPhrase(e.phrase));
    Object.keys(groups).filter(Boolean).sort().forEach(particle => addGroup(particle, groups[particle], ['phrase', 'example']));
  } else if (section === 'adjectives') {
    const arr = data.dependent_adjectives || [];
    const groups = groupByParticle(arr, e => getParticleFromPhrase(e.phrase));
    Object.keys(groups).filter(Boolean).sort().forEach(particle => addGroup(particle, groups[particle], ['phrase', 'meaning', 'example']));
  } else if (section === 'compound_nouns') {
    const arr = data.compound_nouns || [];
    const groups = groupByParticle(arr, e => getPrefixForCompound(e.word));
    Object.keys(groups).filter(Boolean).sort().forEach(particle => addGroup(particle, groups[particle], ['word', 'meaning', 'example']));
  }
  return lines.join('\n');
}

export function renderReferenceCountableUncountableContent(data) {
  if (!data) return;
  state.referenceView = 'countable_uncountable';
  document.getElementById('referenceTitle').textContent = data.title || 'Uncountable Nouns and Plural-only Nouns';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const addSection = (label, arr, cols, headerLabels) => {
    if (!arr || !arr.length) return;
    const h3 = document.createElement('h3');
    h3.textContent = label;
    h3.style.fontSize = '1rem';
    h3.style.color = 'var(--accent)';
    h3.style.marginTop = '1rem';
    h3.style.marginBottom = '0.5rem';
    content.appendChild(h3);
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    const headers = (headerLabels || cols.map(c => c.charAt(0).toUpperCase() + c.slice(1))).join('</th><th>');
    table.innerHTML = '<thead><tr><th>' + headers + '</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    arr.forEach(entry => {
      const cells = cols.map(c => escapeAndBold(entry[c] || ''));
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + cells.join('</td><td>') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  };
  addSection('30 common uncountable nouns', data.uncountable || [], ['word', 'note'], ['Word', 'Example sentence']);
  addSection('Plural-only nouns (20)', data.always_plural || [], ['word', 'note'], ['Word', 'Example sentence']);
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceCountableUncountable() {
  if (!state.countableUncountableData) {
    try {
      state.countableUncountableData = await fetchJSON('reference_countable_uncountable.json');
    } catch (e) {
      alert('Could not load list. ' + e.message);
      return;
    }
  }
  renderReferenceCountableUncountableContent(state.countableUncountableData);
}

export function countableUncountableAsText(data) {
  if (!data) return '';
  const lines = [(data.title || 'Uncountable Nouns and Plural-only Nouns'), ''];
  const addTable = (label, arr) => {
    if (!arr || !arr.length) return;
    lines.push(label);
    lines.push('Word\tNote');
    arr.forEach(entry => { lines.push((entry.word || '') + '\t' + (entry.note || '')); });
    lines.push('');
  };
  addTable('30 common uncountable nouns', data.uncountable || []);
  addTable('Plural-only nouns (20)', data.always_plural || []);
  return lines.join('\n');
}

export function renderReferencePhrasalVerbsContent(data, viewMode) {
  if (!data) return;
  if (viewMode !== undefined) state.phrasalVerbListView = viewMode;
  state.referenceView = 'phrasal_verbs';
  document.getElementById('referenceTitle').textContent = data.title || 'Phrasal verb dictionary';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const addTable = (arr) => {
    if (!arr || !arr.length) return null;
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Phrasal verb</th><th>Definition</th><th>Example</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    arr.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeAndBold(entry.verb) + '</td><td>' + escapeAndBold(entry.meaning) + '</td><td>' + escapeAndBold(entry.example) + '</td>';
      tbody.appendChild(tr);
    });
    return table;
  };
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'secondary';
  toggleBtn.style.marginBottom = '1rem';
  if (state.phrasalVerbListView === 'sections') {
    toggleBtn.textContent = 'Sort by particle';
    toggleBtn.addEventListener('click', () => renderReferencePhrasalVerbsContent(data, 'byParticle'));
  } else {
    toggleBtn.textContent = 'Show by section (Top 50 / Next 100)';
    toggleBtn.addEventListener('click', () => renderReferencePhrasalVerbsContent(data, 'sections'));
  }
  content.appendChild(toggleBtn);

  if (state.phrasalVerbListView === 'sections') {
    const addSection = (label, arr) => {
      if (!arr || !arr.length) return;
      const h3 = document.createElement('h3');
      h3.textContent = label;
      h3.style.fontSize = '1rem';
      h3.style.color = 'var(--accent)';
      h3.style.marginTop = '1rem';
      h3.style.marginBottom = '0.5rem';
      content.appendChild(h3);
      content.appendChild(addTable(arr));
    };
    addSection('Top 50 (most common)', data.top50 || []);
    addSection('Next 100', data.next100 || []);
  } else {
    const all = [...(data.top50 || []), ...(data.next100 || [])];
    const byParticle = {};
    all.forEach(entry => {
      const parts = (entry.verb || '').trim().split(/\s+/);
      const particle = parts.length > 1 ? parts[parts.length - 1] : '';
      if (!byParticle[particle]) byParticle[particle] = [];
      byParticle[particle].push(entry);
    });
    const particles = Object.keys(byParticle).filter(p => p).sort();
    particles.forEach(particle => {
      const h3 = document.createElement('h3');
      h3.textContent = 'Particle: ' + particle;
      h3.style.fontSize = '1rem';
      h3.style.color = 'var(--accent)';
      h3.style.marginTop = '1rem';
      h3.style.marginBottom = '0.5rem';
      content.appendChild(h3);
      const table = addTable(byParticle[particle]);
      if (table) content.appendChild(table);
    });
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferencePhrasalVerbs() {
  if (!state.phrasalVerbsDictionaryData) {
    try {
      state.phrasalVerbsDictionaryData = await fetchJSON('phrasal_verbs_dictionary.json');
    } catch (e) {
      alert('Could not load phrasal verb dictionary. ' + e.message);
      return;
    }
  }
  renderReferencePhrasalVerbsContent(state.phrasalVerbsDictionaryData);
}

export function renderReferenceInfinitiveIngContent(data) {
  if (!data) return;
  state.referenceView = 'infinitive_ing';
  document.getElementById('referenceTitle').textContent = data.title || 'Verb Patterns: to-infinitive, -ing & bare infinitive';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-line';
    p.style.marginBottom = '1rem';
    p.style.color = 'var(--muted)';
    p.innerHTML = escapeAndBold(data.intro || '').replace(/\n/g, '<br>');
    content.appendChild(p);
  }
  const verbs = data.verbs || [];
  if (verbs.length) {
    const getSection = (note) => {
      const n = (note || '').toLowerCase();
      if (n.indexOf('only to-infinitive') === 0) return 'to_only';
      if (n.indexOf('only -ing') === 0) return 'ing_only';
      if (n.indexOf('both correct; same meaning') === 0) return 'both_same';
      if (n.indexOf('both correct; different meaning') === 0) return 'both_different';
      if (n.indexOf('after preposition') === 0 || n.indexOf('after too') === 0 || n.indexOf('after enough') === 0) return 'other_rules';
      return '';
    };
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    table.innerHTML = '<thead><tr><th>Verb</th><th>With -ing (example)</th><th>With to (example)</th><th>Note</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    let lastSection = '';
    verbs.forEach(entry => {
      const section = getSection(entry.note);
      if (section && section !== lastSection && lastSection !== '') {
        const spacer = document.createElement('tr');
        spacer.innerHTML = '<td colspan="4" style="border: none; border-top: 1px solid rgba(86, 95, 137, 0.5); height: 0.75rem; background: transparent;"></td>';
        tbody.appendChild(spacer);
      }
      lastSection = section || lastSection;
      const tr = document.createElement('tr');
      const ing = (entry.example_ing || '').trim();
      const to = (entry.example_to || '').trim();
      const wrongIng = (entry.wrong_ing || '').trim();
      const wrongTo = (entry.wrong_to || '').trim();
      const ingCell = wrongIng
        ? '<span style="text-decoration: line-through">' + escapeAndBold(wrongIng) + '</span>'
        : (ing && ing !== '—' ? escapeAndBold(ing) : '—');
      const toCell = wrongTo
        ? '<span style="text-decoration: line-through">' + escapeAndBold(wrongTo) + '</span>'
        : (to && to !== '—' ? escapeAndBold(to) : '—');
      tr.innerHTML = '<td>' + escapeAndBold(entry.verb || '') + '</td><td>' + ingCell + '</td><td>' + toCell + '</td><td>' + escapeAndBold(entry.note || '') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export function referenceAsText(data) {
  if (!data) return '';
  const stripBold = (s) => (s || '').replace(/\*\*(.*?)\*\*/g, '$1');
  const lines = [stripBold(data.title || 'Reference'), '', stripBold(data.intro || ''), ''];
  const verbs = data.verbs || [];
  if (verbs.length) {
    const col = (s, w) => (s || '').slice(0, w).padEnd(w);
    const w1 = 22;
    const w2 = 42;
    const w3 = 42;
    const w4 = 38;
    lines.push(col('Verb', w1) + col('With -ing (example)', w2) + col('With to (example)', w3) + col('Note', w4));
    lines.push('-'.repeat(w1 + w2 + w3 + w4));
    verbs.forEach(entry => {
      const ing = (entry.example_ing || '').trim() || '—';
      const to = (entry.example_to || '').trim() || '—';
      lines.push(col(entry.verb || '', w1) + col(ing, w2) + col(to, w3) + col(entry.note || '', w4));
    });
  }
  return lines.join('\n');
}

export async function showReference() {
  renderReferenceIndex();
  switchToReference('menu');
}

/** Reference index from a topic intro; Back returns to intro. */
export function showReferenceIndexFromIntro() {
  renderReferenceIndex();
  switchToReference('intro');
}

export async function showReferenceInfinitiveIng() {
  if (!state.referenceInfinitiveIngData) {
    try {
      state.referenceInfinitiveIngData = await fetchJSON('reference_infinitive_ing.json');
    } catch (e) {
      alert('Could not load reference. ' + e.message);
      return;
    }
  }
  renderReferenceInfinitiveIngContent(state.referenceInfinitiveIngData);
}

export function renderReferenceModalVerbsContent(data) {
  if (!data) return;
  state.referenceView = 'modal_verbs';
  document.getElementById('referenceTitle').textContent = data.title || 'Modal verbs and semi-modals';
  const content = document.getElementById('referenceContent');
  content.innerHTML = '';
  if (data.intro) {
    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-line';
    p.style.marginBottom = '1rem';
    p.style.color = 'var(--muted)';
    p.innerHTML = escapeAndBold(data.intro || '').replace(/\n/g, '<br>');
    content.appendChild(p);
  }
  const addTable = (arr, cols) => {
    if (!arr || !arr.length) return;
    const table = document.createElement('table');
    table.className = 'reference-phrasal-table';
    table.setAttribute('border', '1');
    const headers = cols.map(c => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ')).join('</th><th>');
    table.innerHTML = '<thead><tr><th>' + headers + '</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    arr.forEach(entry => {
      const tr = document.createElement('tr');
      const cells = cols.map(c => escapeAndBold(entry[c] || ''));
      tr.innerHTML = '<td>' + cells.join('</td><td>') + '</td>';
      tbody.appendChild(tr);
    });
    content.appendChild(table);
  };
  if ((data.modals || []).length) {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.color = 'var(--accent)';
    h3.style.marginTop = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.textContent = 'Modal verbs';
    content.appendChild(h3);
    addTable(data.modals, ['modal', 'meaning', 'example', 'form']);
  }
  if ((data.semi_modals || []).length) {
    const h3 = document.createElement('h3');
    h3.style.fontSize = '1rem';
    h3.style.color = 'var(--accent)';
    h3.style.marginTop = '1rem';
    h3.style.marginBottom = '0.5rem';
    h3.textContent = 'Semi-modals';
    content.appendChild(h3);
    addTable(data.semi_modals, ['modal', 'meaning', 'example', 'form']);
  }
  document.getElementById('referencePrintDownloadWrap').classList.remove('hidden');
  document.getElementById('referenceBackBtn').textContent = 'Back to Reference';
}

export async function showReferenceModalVerbs() {
  if (!state.referenceModalVerbsData) {
    try {
      state.referenceModalVerbsData = await fetchJSON('reference_modal_verbs.json');
    } catch (e) {
      alert('Could not load reference. ' + e.message);
      return;
    }
  }
  renderReferenceModalVerbsContent(state.referenceModalVerbsData);
}

export function hideReference() {
  state.referenceReturnTo = 'menu';
  showScreen('menuScreen');
  var rw = document.getElementById('referenceBtnWrap');
  if (rw) rw.classList.remove('hidden');
  if (document.getElementById('menuMain')) showMenuPanel('menuMain');
  else if (document.getElementById('menuExamPractice')) showMenuPanel('menuExamPractice');
  document.body.classList.remove('viewing-reference');
}

export function onReferenceBackClick() {
  if (state.referenceView === 'index' && state.referenceReturnTo === 'intro') {
    state.referenceReturnTo = 'menu';
    showScreen('introScreen');
    var rwIdx = document.getElementById('referenceBtnWrap');
    if (rwIdx) rwIdx.classList.remove('hidden');
    document.body.classList.remove('viewing-reference');
    document.body.classList.add('viewing-content');
    return;
  }
  if (state.referenceView === 'infinitive_ing' || state.referenceView === 'modal_verbs' || state.referenceView === 'phrasal_verbs' || state.referenceView === 'prepositions' || state.referenceView === 'dependent_verbs' || state.referenceView === 'dependent_nouns' || state.referenceView === 'dependent_adjectives' || state.referenceView === 'compound_nouns' || state.referenceView === 'countable_uncountable' || state.referenceView === 'open_cloze' || state.referenceView === 'fixed_phrases' || state.referenceView === 'word_formation' || state.referenceView === 'conjunctions_linkers' || state.referenceView === 'reported_speech' || state.referenceView === 'irregular_verbs' || state.referenceView === 'writing_tips') {
    if (state.referenceReturnTo === 'intro') {
      state.referenceReturnTo = 'menu';
      showScreen('introScreen');
      var rwIntro = document.getElementById('referenceBtnWrap');
      if (rwIntro) rwIntro.classList.remove('hidden');
      document.body.classList.remove('viewing-reference');
      document.body.classList.add('viewing-content');
      return;
    }
    if (state.referenceView === 'writing_tips' && state.referenceReturnTo === 'exam_practice') {
      state.referenceReturnTo = 'menu';
      showScreen('menuScreen');
      document.body.classList.remove('viewing-reference');
      _onShowExamPracticeMenu();
      return;
    }
    renderReferenceIndex();
  } else {
    hideReference();
  }
}
