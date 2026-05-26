import state from '../js/state.js';
import { showScreen, showMenuPanel, fetchJSON, escapeAndBold, normalize, shuffleArray } from '../js/ui.js';

let _showQuestion = null;
let _showMainMenu = null;
let _getTopicTitle = null;
let _getTopicLabelForDisplay = null;
let _answerMatches = null;

export function registerCallbacks(callbacks) {
  _showQuestion = callbacks.showQuestion;
  _showMainMenu = callbacks.showMainMenu;
  _getTopicTitle = callbacks.getTopicTitle;
  _getTopicLabelForDisplay = callbacks.getTopicLabelForDisplay;
  _answerMatches = callbacks.answerMatches;
}

export function startExamClozeQuiz(mode, questions) {
  const list = (questions || []).slice();
  if (list.length === 0) {
    alert('Coming soon.');
    return;
  }
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  state.coursePhase = null;
  state.coursePart = null;
  state.quizMode = 'normal';
  state.wrongTopics = new Set();
  state.currentQuestions = list;
  state.currentSetId = 'open_cloze_' + mode;
  state.currentSetTitle = 'Open Cloze – ' + (mode === 'easy' ? 'Easy (MC)' : mode === 'medium' ? 'Medium' : mode === 'hard' ? 'Hard' : 'Expert');
  state.summary = list.length + ' questions (random order).';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;
  showScreen('quizScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  _showQuestion();
}

export async function startOpenClozeFreePractice() {
  let data;
  try { data = await fetchJSON('exam_open_cloze_free.json', { samePageDir: true }); } catch (e) {
    alert('Could not load free practice. ' + (e && e.message)); return;
  }
  const pool = data.questions || [];
  if (pool.length === 0) {
    alert('No questions available yet.');
    return;
  }
  const questions = pool.slice();
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const numSelect = document.getElementById('openClozeFreeNumSelect');
  const val = numSelect && numSelect.value;
  const max = (val === 'unlimited') ? questions.length : (parseInt(val, 10) || 20);
  const list = questions.slice(0, max);
  state.coursePhase = null;
  state.coursePart = null;
  state.quizMode = 'normal';
  state.wrongTopics = new Set();
  state.currentQuestions = list;
  state.currentSetId = 'open_cloze_free';
  state.currentSetTitle = 'Open Cloze: Free practice (' + max + ' questions)';
  state.summary = max + ' questions (random order).';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;
  showScreen('quizScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  document.getElementById('quizGapFillInstruction').classList.remove('hidden');
  _showQuestion();
}

export async function loadAndStartExamCloze(mode) {
  if (!state.examOpenClozeData) {
    try { state.examOpenClozeData = await fetchJSON('exam_open_cloze.json', { samePageDir: true }); } catch (e) {
      alert('Could not load exam practice. ' + (e && e.message)); return;
    }
  }
  const data = state.examOpenClozeData[mode];
  if (!data || data.length === 0) {
    alert('Coming soon.');
    return;
  }
  const isTestsFormat = data[0] && data[0].passage && Array.isArray(data[0].gaps);
  if (isTestsFormat) {
    state.currentExamType = 'open_cloze';
    state.currentExamSubMenu = 'open_cloze';
    state.currentExamClozeTests = data;
    state.currentExamClozeMode = mode;
    showExamTestSelectScreen();
  } else {
    startExamClozeQuiz(mode, data);
  }
}

export async function loadAndStartExamWordFormation(mode) {
  if (!state.examWordFormationData) {
    try { state.examWordFormationData = await fetchJSON('exam_word_formation.json', { samePageDir: true }); } catch (e) {
      alert('Could not load Word Formation. ' + (e && e.message)); return;
    }
  }
  const data = state.examWordFormationData[mode];
  if (!data || data.length === 0) {
    alert('No tests available for this level yet.');
    return;
  }
  state.currentExamType = 'word_formation';
  state.currentExamSubMenu = 'word_formation';
  state.currentExamClozeTests = data;
  state.currentExamClozeMode = mode;
  showExamTestSelectScreen();
}

export async function loadAndStartExamSentenceTransform(mode) {
  if (!state.examSentenceTransformData) {
    try { state.examSentenceTransformData = await fetchJSON('exam_sentence_transformation.json', { samePageDir: true }); } catch (e) {
      alert('Could not load Sentence Transformation. ' + (e && e.message)); return;
    }
  }
  const data = state.examSentenceTransformData[mode];
  if (!data || data.length === 0) {
    alert('No tests available for this level yet.');
    return;
  }
  state.currentExamType = 'sentence_transformation';
  state.currentExamSubMenu = 'sentence_transformation';
  state.currentExamTransformTests = data;
  state.currentExamTransformMode = mode;
  showExamTestSelectScreen();
}

const EXAM_CLOZE_GAP = '_____';

export function getCurrentExamTests() {
  return state.currentExamType === 'sentence_transformation' ? state.currentExamTransformTests : state.currentExamClozeTests;
}

export function showExamTestSelectScreen() {
  const mode = (state.currentExamType === 'sentence_transformation' ? state.currentExamTransformMode : state.currentExamClozeMode) || 'easy';
  const cap = mode.charAt(0).toUpperCase() + mode.slice(1);
  const typeLabel = state.currentExamType === 'open_cloze' ? 'Open Cloze' : state.currentExamType === 'word_formation' ? 'Word Formation' : 'Sentence Transformation';
  document.getElementById('examClozeTestSelectHeading').textContent = typeLabel + ' – Choose a test (' + cap + ').';
  const backBtn = document.getElementById('examClozeTestSelectBackBtn');
  if (backBtn) backBtn.textContent = 'Back to ' + typeLabel;
  const listEl = document.getElementById('examClozeTestSelectList');
  listEl.innerHTML = '';
  const tests = getCurrentExamTests() || [];
  const openClozePrefix = 'Open Cloze:';
  const wfPrefix = 'Word Formation:';
  tests.forEach((test, i) => {
    let shortTitle = (test.title || '').trim();
    if (state.currentExamType === 'open_cloze' && shortTitle.indexOf(openClozePrefix) === 0) shortTitle = shortTitle.slice(openClozePrefix.length).trim();
    else if (state.currentExamType === 'word_formation' && shortTitle.indexOf(wfPrefix) === 0) shortTitle = shortTitle.slice(wfPrefix.length).trim();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    btn.textContent = shortTitle ? 'Test ' + (i + 1) + ': ' + shortTitle : 'Test ' + (i + 1);
    btn.dataset.index = String(i);
    listEl.appendChild(btn);
  });
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuOpenClozeStep3').classList.add('hidden');
  document.getElementById('menuOpenClozeFreeSetup').classList.add('hidden');
  document.getElementById('menuOpenClozeFurther').classList.add('hidden');
  document.getElementById('menuWordFormation').classList.add('hidden');
  document.getElementById('menuWordFormationFurther').classList.add('hidden');
  document.getElementById('menuSentenceTransform').classList.add('hidden');
  document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
  document.getElementById('menuExamClozeTestSelect').classList.remove('hidden');
  document.getElementById('examClozeTestScreen').classList.add('hidden');
  document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
  document.getElementById('examTransformTestScreen').classList.add('hidden');
  document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
}

export function showExamClozeTestSelectScreen() {
  showExamTestSelectScreen();
}

export function startExamClozeTestByIndex(index) {
  state.currentExamClozeTestIndex = index;
  showScreen('examClozeTestScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
  renderExamClozeTest(state.currentExamClozeTests[state.currentExamClozeTestIndex]);
}

export function startExamTransformTestByIndex(index) {
  state.currentExamTransformTestIndex = index;
  showScreen('examTransformTestScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
  renderExamTransformTest(state.currentExamTransformTests[state.currentExamTransformTestIndex]);
}

export function renderExamClozeTest(test) {
  state.currentExamClozeTest = test;
  const total = state.currentExamClozeTests.length;
  document.getElementById('examClozeProgress').textContent = 'Test ' + (state.currentExamClozeTestIndex + 1) + ' of ' + total;
  const titleEl = document.getElementById('examClozeTitle');
  if (test.title) {
    titleEl.textContent = test.title;
    titleEl.classList.remove('hidden');
  } else {
    titleEl.classList.add('hidden');
  }
  const instructionsEl = document.getElementById('examClozeInstructions');
  if (test.type === 'mc' && state.currentExamType === 'word_formation') {
    instructionsEl.textContent = 'Read the text below. Use the word in CAPITALS (shown next to each gap) to form a word that fits. Choose the correct answer (FCE-style, guided).';
  } else {
    instructionsEl.textContent = (test.instructions || 'Read the text. Write one word in each gap. (Easy: choose from options.)');
  }
  const passageEl = document.getElementById('examClozePassage');
  passageEl.innerHTML = '';
  const segments = (test.passage || '').split(EXAM_CLOZE_GAP);
  const gapCount = (test.gaps || []).length;
  if (segments.length !== gapCount + 1) {
    passageEl.textContent = 'Invalid passage (expected ' + gapCount + ' gaps).';
    return;
  }
  const mcRowsEl = document.getElementById('examClozeMcRows');
  mcRowsEl.innerHTML = '';
  mcRowsEl.classList.add('hidden');
  state.examClozeMcSelections = [];

  if (test.type === 'mc') {
    for (let i = 0; i < gapCount; i++) {
      passageEl.appendChild(document.createTextNode(segments[i]));
      const numSpan = document.createElement('span');
      numSpan.className = 'exam-cloze-gap-num';
      const gap = test.gaps[i];
      numSpan.textContent = ' (' + (i + 1) + ') ';
      numSpan.style.color = 'var(--muted)';
      passageEl.appendChild(numSpan);
      if (gap && gap.stem) {
        const stemSpan = document.createElement('span');
        stemSpan.style.color = 'var(--muted)';
        stemSpan.textContent = ' (' + gap.stem + ') ';
        passageEl.appendChild(stemSpan);
      }
    }
    passageEl.appendChild(document.createTextNode(segments[gapCount]));
    const letters = ['a', 'b', 'c', 'd'];
    test.gaps.forEach((gap, i) => {
      const row = document.createElement('div');
      row.className = 'exam-cloze-mc-row';
      const label = (i + 1) + (gap.stem ? ' (' + gap.stem + '): ' : ': ');
      row.appendChild(document.createTextNode(label));
      shuffleArray(Object.entries(gap.options || {})).forEach(([key, text]) => {
        const opt = document.createElement('span');
        opt.className = 'option';
        opt.dataset.gapIndex = String(i);
        opt.dataset.option = key;
        opt.textContent = key + ') ' + text;
        opt.addEventListener('click', function() {
          row.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          state.examClozeMcSelections[i] = key;
          const test = state.currentExamClozeTest;
          if (test && test.gaps && test.gaps.every((_, idx) => state.examClozeMcSelections[idx])) submitExamClozeTest();
        });
        row.appendChild(opt);
      });
      mcRowsEl.appendChild(row);
    });
    mcRowsEl.classList.remove('hidden');
  } else {
    for (let i = 0; i < gapCount; i++) {
      passageEl.appendChild(document.createTextNode(segments[i]));
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = (i + 1).toString();
      input.dataset.gapIndex = String(i);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      passageEl.appendChild(input);
      if (test.gaps[i] && test.gaps[i].stem) {
        const stemSpan = document.createElement('span');
        stemSpan.style.color = 'var(--muted)';
        stemSpan.textContent = ' (' + test.gaps[i].stem + ') ';
        passageEl.appendChild(stemSpan);
      }
    }
    passageEl.appendChild(document.createTextNode(segments[gapCount]));
  }
  document.getElementById('examClozeSubmitBtn').classList.remove('hidden');
}

export function submitExamClozeTest() {
  const test = state.currentExamClozeTest;
  if (!test || !test.gaps) return;
  const emptyGapIndices = [];
  if (test.type !== 'mc') {
    for (let i = 0; i < test.gaps.length; i++) {
      const input = document.querySelector('#examClozePassage input[data-gap-index="' + i + '"]');
      const val = input ? input.value.trim() : '';
      if (val === '') emptyGapIndices.push(i + 1);
    }
  }
  const results = [];
  let scoreCount = 0;
  for (let i = 0; i < test.gaps.length; i++) {
    const gap = test.gaps[i];
    let correct = false;
    let userVal = '';
    if (test.type === 'mc') {
      userVal = state.examClozeMcSelections[i];
      correct = userVal === gap.correct_option;
      const row = document.querySelector('.exam-cloze-mc-row:nth-child(' + (i + 1) + ')');
      if (row) {
        row.querySelectorAll('.option').forEach(o => {
          o.classList.remove('selected', 'correct', 'wrong');
          if (o.dataset.option === gap.correct_option) o.classList.add('correct');
          else if (o.dataset.option === userVal && !correct) o.classList.add('wrong');
        });
      }
    } else {
      const input = document.querySelector('#examClozePassage input[data-gap-index="' + i + '"]');
      userVal = input ? input.value.trim() : '';
      correct = _answerMatches(userVal, gap.answers || []);
      if (input) {
        input.readOnly = true;
        input.classList.add(correct ? 'correct' : 'wrong');
      }
    }
    if (correct) scoreCount++;
    results.push({ index: i, correct, userVal, gap });
  }
  const total = test.gaps.length;
  let scoreText = 'Score: ' + scoreCount + ' / ' + total;
  if (emptyGapIndices && emptyGapIndices.length > 0) {
    scoreText += ' (You left gap(s) ' + emptyGapIndices.join(', ') + ' empty.)';
  }
  document.getElementById('examClozeScoreText').textContent = scoreText;
  const wrongList = document.getElementById('examClozeWrongList');
  const wrongResults = results.filter(r => !r.correct);
  const topicCounts = {};
  wrongResults.forEach(r => {
    const tid = r.gap.topic_id;
    if (tid) topicCounts[tid] = (topicCounts[tid] || 0) + 1;
  });
  const topicSummaryParts = [];
  Object.keys(topicCounts).sort().forEach(tid => {
    const topic = state.topics && state.topics.find(t => t.id === tid);
    const name = topic ? (topic.title || tid) : tid;
    topicSummaryParts.push(name + ' (' + topicCounts[tid] + ')');
  });
  const topicSummaryHtml = topicSummaryParts.length > 0 ? '<p style="font-size: 0.9rem; color: var(--muted); margin-bottom: 0.5rem;">Suggested study: ' + topicSummaryParts.join(', ') + '</p>' : '';
  const allHtml = topicSummaryHtml + results.map(r => {
    const correctAnswer = test.type === 'mc' ? (r.gap.options && r.gap.options[r.gap.correct_option]) : (r.gap.answers && r.gap.answers.length ? r.gap.answers.join(' or ') : (r.gap.answers && r.gap.answers[0]) || '');
    const correctText = correctAnswer || '';
    const topicId = r.gap.topic_id;
    const topic = state.topics && state.topics.find(t => t.id === topicId);
    const topicTitle = topic ? (topic.title || topicId) : topicId;
    let line = '<p style="margin: 0.5rem 0;"><strong>Gap ' + (r.index + 1) + ':</strong> ';
    if (topicId) {
      line += 'Study: <a href="#topic/' + String(topicId).replace(/"/g, '&quot;') + '" class="exam-cloze-topic-link" data-topic-id="' + String(topicId).replace(/"/g, '&quot;') + '">' + String(topicTitle).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</a>. ';
    }
    line += escapeAndBold(r.gap.explanation || '') + ' <span class="correct-answer-line">Correct: ' + escapeAndBold(correctText) + '</span>';
    if (!r.correct && r.userVal !== undefined && r.userVal !== '') {
      line += ' <span style="color: var(--muted);">You wrote: ' + escapeAndBold(r.userVal) + '</span>';
    }
    if (!r.correct && (r.userVal === undefined || r.userVal === '')) {
      line += ' <span style="color: var(--muted);">(left empty)</span>';
    }
    line += '</p>';
    return line;
  }).join('');
  wrongList.innerHTML = allHtml;
  document.getElementById('examClozeSubmitBtn').classList.add('hidden');
  document.getElementById('examClozeFeedbackBlock').classList.remove('hidden');
  const nextBtn = document.getElementById('examClozeNextBtn');
  const backLabel = state.currentExamSubMenu === 'word_formation' ? 'Back to Word Formation' : 'Back to Open Cloze';
  nextBtn.textContent = state.currentExamClozeTestIndex + 1 < state.currentExamClozeTests.length ? 'Next test' : backLabel;
  nextBtn.focus();
}

export function onExamClozeNext() {
  state.currentExamClozeTestIndex++;
  if (state.currentExamClozeTestIndex >= state.currentExamClozeTests.length) {
    document.body.classList.remove('viewing-content');
    document.getElementById('examClozeTestScreen').classList.add('hidden');
    document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
    if (state.currentExamSubMenu === 'word_formation') {
      document.getElementById('menuWordFormationFurther').classList.add('hidden');
      document.getElementById('menuWordFormation').classList.remove('hidden');
    } else {
      document.getElementById('menuOpenClozeFurther').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.remove('hidden');
    }
    return;
  }
  document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
  renderExamClozeTest(state.currentExamClozeTests[state.currentExamClozeTestIndex]);
}

export function onExamClozeExit() {
  document.body.classList.remove('viewing-content');
  document.getElementById('examClozeTestScreen').classList.add('hidden');
  showExamTestSelectScreen();
}

export function renderExamTransformTest(test) {
  state.currentExamTransformTest = test;
  const total = state.currentExamTransformTests.length;
  document.getElementById('examTransformProgress').textContent = 'Test ' + (state.currentExamTransformTestIndex + 1) + ' of ' + total;
  const titleEl = document.getElementById('examTransformTitle');
  if (test.title) {
    titleEl.textContent = test.title;
    titleEl.classList.remove('hidden');
  } else titleEl.classList.add('hidden');
  document.getElementById('examTransformInstructions').textContent = (test.instructions || 'Finish the second sentence. Use the key word. Same meaning as the first.');
  const hintEl = document.getElementById('examTransformHint');
  const wordRangeMatch = test.instructions && test.instructions.match(/between (two|\d+) and (five|six|eight|\d+) words/i);
  if (wordRangeMatch) {
    hintEl.textContent = 'Use between ' + wordRangeMatch[1] + ' and ' + wordRangeMatch[2] + ' words in each gap (including the key word).';
  } else {
    hintEl.textContent = 'Use the number of words stated in the instructions in each gap (including the key word).';
  }
  hintEl.classList.remove('hidden');
  const container = document.getElementById('examTransformItems');
  container.innerHTML = '';
  (test.items || []).forEach((item, i) => {
    const block = document.createElement('div');
    block.className = 'card';
    block.style.marginBottom = '0.5rem';
    block.innerHTML = '<p style="margin: 0 0 0.35rem 0; font-size: 0.95rem;">' + (i + 1) + '. ' + escapeAndBold(item.sentence1) + '</p>' +
      '<p style="margin: 0 0 0.35rem 0; font-size: 0.9rem; color: var(--accent);"><strong>' + (item.keyword || '') + '</strong></p>' +
      '<p style="margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem;"><span>' + escapeAndBold(item.sentence2_prefix || '') + '</span><input type="text" data-item-index="' + i + '" style="min-width: 20em; width: 100%; max-width: 28em;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><span>' + escapeAndBold(item.sentence2_suffix || '') + '</span></p>';
    container.appendChild(block);
  });
  document.getElementById('examTransformSubmitBtn').classList.remove('hidden');
}

export function submitExamTransformTest() {
  const test = state.currentExamTransformTest;
  if (!test || !test.items) return;
  const emptyItemIndices = [];
  test.items.forEach((item, i) => {
    const input = document.querySelector('#examTransformItems input[data-item-index="' + i + '"]');
    const val = input ? input.value.trim() : '';
    if (val === '') emptyItemIndices.push(i + 1);
  });
  const results = [];
  let scoreCount = 0;
  test.items.forEach((item, i) => {
    const input = document.querySelector('#examTransformItems input[data-item-index="' + i + '"]');
    const userVal = input ? input.value.trim() : '';
    const correct = _answerMatches(userVal, item.answers || []);
    if (correct) scoreCount++;
    if (input) {
      input.readOnly = true;
      input.classList.add(correct ? 'correct' : 'wrong');
    }
    results.push({ index: i, correct, userVal, item });
  });
  const total = test.items.length;
  let transformScoreText = 'Score: ' + scoreCount + ' / ' + total;
  if (emptyItemIndices.length > 0) {
    transformScoreText += ' (You left item(s) ' + emptyItemIndices.join(', ') + ' empty.)';
  }
  document.getElementById('examTransformScoreText').textContent = transformScoreText;
  const wrongList = document.getElementById('examTransformWrongList');
  const wrongResults = results.filter(r => !r.correct);
  const topicCounts = {};
  wrongResults.forEach(r => {
    const tid = r.item.topic_id;
    if (tid) topicCounts[tid] = (topicCounts[tid] || 0) + 1;
  });
  const topicSummaryParts = [];
  Object.keys(topicCounts).sort().forEach(tid => {
    const topic = state.topics && state.topics.find(t => t.id === tid);
    const name = topic ? (topic.title || tid) : tid;
    topicSummaryParts.push(name + ' (' + topicCounts[tid] + ')');
  });
  const topicSummaryHtml = topicSummaryParts.length > 0 ? '<p style="font-size: 0.9rem; color: var(--muted); margin-bottom: 0.5rem;">Suggested study: ' + topicSummaryParts.join(', ') + '</p>' : '';
  wrongList.innerHTML = topicSummaryHtml + results.map(r => {
    const correctText = (r.item.answers && r.item.answers.length) ? r.item.answers.join(' or ') : '';
    const topicId = r.item.topic_id;
    const topic = state.topics && state.topics.find(t => t.id === topicId);
    const topicTitle = topic ? (topic.title || topicId) : topicId;
    let line = '<p style="margin: 0.5rem 0;"><strong>Item ' + (r.index + 1) + ':</strong> ';
    if (topicId) line += 'Study: <a href="#topic/' + String(topicId).replace(/"/g, '&quot;') + '" class="exam-cloze-topic-link" data-topic-id="' + String(topicId).replace(/"/g, '&quot;') + '">' + String(topicTitle).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</a>. ';
    line += escapeAndBold(r.item.explanation || '') + ' <span class="correct-answer-line">Correct: ' + escapeAndBold(correctText) + '</span>';
    if (!r.correct && r.userVal !== '') {
      line += ' <span style="color: var(--muted);">You wrote: ' + escapeAndBold(r.userVal) + '</span>';
      const wordCount = (r.userVal.match(/\S+/g) || []).length;
      if (wordCount === 1) line += ' <span style="color: var(--muted); font-size: 0.9em;">(Your answer had 1 word; use the number of words stated in the instructions.)</span>';
    }
    if (!r.correct && (r.userVal === undefined || r.userVal === '')) {
      line += ' <span style="color: var(--muted);">(left empty)</span>';
    }
    line += '</p>';
    return line;
  }).join('');
  document.getElementById('examTransformSubmitBtn').classList.add('hidden');
  document.getElementById('examTransformFeedbackBlock').classList.remove('hidden');
  const nextBtn = document.getElementById('examTransformNextBtn');
  nextBtn.textContent = state.currentExamTransformTestIndex + 1 < state.currentExamTransformTests.length ? 'Next test' : 'Back to Sentence Transformation';
  nextBtn.focus();
}

export function onExamTransformNext() {
  state.currentExamTransformTestIndex++;
  if (state.currentExamTransformTestIndex >= state.currentExamTransformTests.length) {
    document.body.classList.remove('viewing-content');
    document.getElementById('examTransformTestScreen').classList.add('hidden');
    document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
    document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
    document.getElementById('menuSentenceTransform').classList.remove('hidden');
    return;
  }
  document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
  renderExamTransformTest(state.currentExamTransformTests[state.currentExamTransformTestIndex]);
}

export function onExamTransformExit() {
  document.body.classList.remove('viewing-content');
  document.getElementById('examTransformTestScreen').classList.add('hidden');
  showExamTestSelectScreen();
}
