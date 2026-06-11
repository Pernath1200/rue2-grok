import state from './state.js';
import { showScreen, showMenuPanel, fetchJSON, escapeAndBold, normalize, toTitleCase, shuffleArray } from './ui.js';
import { STORAGE_KEY, MEMORY_KEY, REPORTED_QUESTIONS_KEY, loadScores, saveScore, saveMemoryBankEntry, getLastBest, questionHash, getReportedQuestions, getDueReviews, saveLastActivity } from './storage.js';
import { renderScoreChart } from './ui.js';

let _renderMenu = null;
let _advanceCourseToNext = null;
let _getWeakSpotQuestions = null;
let _applyTopic = null;
let _answerMatches = null;
let _openTopicIntroFromResults = null;

export function registerCallbacks(callbacks) {
  _renderMenu = callbacks.renderMenu;
  _advanceCourseToNext = callbacks.advanceCourseToNext;
  _getWeakSpotQuestions = callbacks.getWeakSpotQuestions;
  _applyTopic = callbacks.applyTopic;
  _answerMatches = callbacks.answerMatches;
  _openTopicIntroFromResults = callbacks.openTopicIntroFromResults;
}

export function startQuiz() {
  state.coursePhase = null;
  state.quizMode = 'normal';
  state.wrongTopics = new Set();
  const numSelect = document.getElementById('numQuestionsSelect');
  const val = numSelect && numSelect.value;
  const pool = Object.values(state.setsData).flatMap(s => s.questions || []);
  if (pool.length === 0) {
    alert('No questions available for this topic.');
    return;
  }
  const questions = pool.slice();
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const max = (val === 'unlimited') ? questions.length : (parseInt(val, 10) || 20);
  state.currentQuestions = questions.slice(0, max);
  state.currentSetId = state.currentTopic.id;
  saveLastActivity(state.currentTopic.id);
  state.currentSetTitle = (state.currentTopic.title || state.currentTopic.id) + ' (' + max + ' questions)';
  state.summary = max + ' questions from this topic (random order).';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;

  document.getElementById('menuScreen').classList.add('hidden');
  document.body.classList.add('viewing-content');
  document.getElementById('quizScreen').classList.remove('hidden');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  showQuestion();
}

export function startWeakSpotsQuiz() {
  state.coursePhase = null;
  state.quizMode = 'normal';
  state.wrongTopics = new Set();
  const questions = _getWeakSpotQuestions();
  if (questions.length === 0) {
    alert('No weak spots yet. Do a quiz and get some wrong to build your revision list.');
    return;
  }
  const shuffled = questions.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  state.currentQuestions = shuffled;
  state.currentSetId = 'weakspots';
  state.currentSetTitle = 'Revise weak spots (' + shuffled.length + ' questions)';
  state.summary = 'Questions you got wrong – get each right 3 times and it will drop off.';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;

  document.getElementById('menuScreen').classList.add('hidden');
  document.body.classList.add('viewing-content');
  document.getElementById('quizScreen').classList.remove('hidden');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  showQuestion();
}

export function startReviewQuiz() {
  state.coursePhase = null;
  state.quizMode = 'normal';
  state.wrongTopics = new Set();
  const questions = getDueReviews();
  if (questions.length === 0) {
    alert('Nothing is due for review today. Come back tomorrow!');
    return;
  }
  const shuffled = questions.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  state.currentQuestions = shuffled;
  state.currentSetId = 'review';
  state.currentSetTitle = "Today's review (" + shuffled.length + ' questions)';
  state.summary = 'Spaced repetition: questions you get right come back later, ones you get wrong come back sooner.';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;

  document.getElementById('menuScreen').classList.add('hidden');
  document.body.classList.add('viewing-content');
  document.getElementById('quizScreen').classList.remove('hidden');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  showQuestion();
}

export function hasValidTopicSelected() {
  const sel = document.getElementById('topicSelect');
  const val = sel && sel.value;
  return val !== '' && val !== '-1' && state.topics[parseInt(val, 10)] != null;
}

export function syncCurrentTopicFromDropdown() {
  const sel = document.getElementById('topicSelect');
  const val = sel && sel.value;
  if (val !== '' && val !== '-1') {
    const idx = parseInt(val, 10);
    if (state.topics && state.topics[idx] != null) state.currentTopic = state.topics[idx];
  }
}

export function getTopicTitle(topicId) {
  const t = (state.topics || []).find(x => x.id === topicId);
  return toTitleCase(t ? (t.title || topicId) : topicId);
}
export function getTopicLabelForDisplay(topicId) {
  return getTopicTitle(topicId) || '';
}

export function getReportedReasonLabel(r) {
  const other = (r.reasonOther && String(r.reasonOther).trim()) ? String(r.reasonOther).trim() : '';
  if (other) return other;
  if (r.reasonType === 'nonsense') return 'Nonsense';
  if (r.reasonType === 'ambiguity') return 'Ambiguity';
  if (r.reasonType === 'other') return 'Other';
  if (r.reasonType) return String(r.reasonType);
  return '—';
}

export function addReportedQuestion(reasonType, reasonOther) {
  if (!state.currentQuestions.length || state.currentIndex < 0 || state.currentIndex >= state.currentQuestions.length) return;
  const q = state.currentQuestions[state.currentIndex];
  let topicId = '';
  let topicTitle = '';
  if (q.topic) {
    topicId = q.topic;
    topicTitle = getTopicTitle(q.topic);
  } else if (state.currentTopic) {
    topicId = state.currentTopic.id || '';
    topicTitle = state.currentTopic.title || '';
  }
  const questionText = (q.prompt || q.question || '').replace(/\s+/g, ' ').trim();
  const source = state.quizMode === 'diagnostic' ? 'Grammar Test' : state.quizMode === 'practice' ? 'Practice' : 'Quiz';
  const list = getReportedQuestions();
  list.push({ topicId, topicTitle, questionText, source, timestamp: new Date().toISOString(), reasonType: reasonType || '', reasonOther: reasonOther || '' });
  localStorage.setItem(REPORTED_QUESTIONS_KEY, JSON.stringify(list));
  const btn = document.getElementById('reportQuestionBtn');
  if (btn) { const orig = btn.textContent; btn.textContent = 'Flagged'; setTimeout(function() { btn.textContent = orig; }, 1500); }
}

export function addReportedIntroCard(reasonType, reasonOther) {
  if (!state.courseCurriculum || !state.courseCurriculum.intro) return;
  const sections = Array.isArray(state.courseCurriculum.intro.sections) ? state.courseCurriculum.intro.sections : [];
  const idx = state.introSectionIndex || 0;
  if (!sections.length || idx < 0 || idx >= sections.length) return;
  const section = sections[idx] || {};
  const list = getReportedQuestions();
  const topicId = (state.currentTopic && state.currentTopic.id) || '';
  const topicTitle = (state.currentTopic && (state.currentTopic.title || getTopicTitle(topicId))) || '';
  const title = (section.title || 'Introduction').replace(/\s+/g, ' ').trim();
  const content = (section.content || '').replace(/\s+/g, ' ').trim();
  const questionText = ('Intro card: ' + title + (content ? ' — ' + content : '')).trim();
  list.push({
    topicId,
    topicTitle,
    questionText,
    source: 'Intro',
    timestamp: new Date().toISOString(),
    reasonType: reasonType || '',
    reasonOther: reasonOther || ''
  });
  localStorage.setItem(REPORTED_QUESTIONS_KEY, JSON.stringify(list));
  const btn = document.getElementById('reportIntroCardBtn');
  if (btn) { const orig = btn.textContent; btn.textContent = 'Flagged'; setTimeout(function() { btn.textContent = orig; }, 1500); }
}
export function renderReportedQuestionsList() {
  const list = getReportedQuestions();
  const emptyEl = document.getElementById('reportedQuestionsEmpty');
  const listEl = document.getElementById('reportedQuestionsList');
  if (!listEl) return;
  if (list.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  listEl.innerHTML = list.map(function(r, i) {
    const qShort = r.questionText.length > 120 ? r.questionText.slice(0, 117) + '...' : r.questionText;
    const topic = r.topicTitle || r.topicId || '—';
    const date = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
    const reasonLabel = getReportedReasonLabel(r);
    return '<li style="margin-bottom: 0.5rem;"><strong>Q' + (i + 1) + '</strong> · ' + escapeHtml(topic) + ' · ' + escapeHtml(r.source) + ' · ' + escapeHtml(date) + (reasonLabel !== '—' ? ' · Reason: ' + escapeHtml(reasonLabel) : '') + '<br><span style="color: var(--muted);">' + escapeHtml(qShort) + '</span></li>';
  }).join('');
}
export function escapeHtml(s) {
  if (s == null) return '';
  const t = document.createElement('textarea');
  t.textContent = s;
  return t.innerHTML;
}

const TRAILING_INSTRUCTION_REGEX = /\s+(Put the verb in the correct tense\.?|Correct the sentence\.?|Fill in the auxiliary and use the correct form of the verb\.?)\s*$/i;

export function cleanQuestionDisplay(str) {
  if (!str || typeof str !== 'string') return { question: '', contextLabel: null, taskInstruction: null };
  let s = str.trim().replace(/^\d+\.\s*/, '');
  let contextLabel = null;
  const metaMatch = s.match(new RegExp('^(Multiple choice|Error correction|Choose the best sentence)(?:\\s+\\(([^)]+)\\))?\\s*\\n', 'i'));
  if (metaMatch) {
    contextLabel = metaMatch[2] ? metaMatch[2].trim() : null;
    s = s.slice(metaMatch[0].length);
  }
  let taskInstruction = null;
  const trailMatch = s.match(TRAILING_INSTRUCTION_REGEX);
  if (trailMatch) {
    taskInstruction = trailMatch[1].trim();
    if (!/\.$/.test(taskInstruction)) taskInstruction += '.';
    s = s.slice(0, trailMatch.index).trim();
  }
  return { question: s.trim(), contextLabel, taskInstruction };
}

function updateQuizProgress() {
  const el = document.getElementById('progress');
  if (!el) return;
  const total = (state.currentQuestions && state.currentQuestions.length) || 0;
  const current = (state.currentIndex || 0) + 1;
  el.textContent = `Question ${current} of ${total}`;

  // Harmonious util-bar context (A): topic + truthful progress on the consistent nav bar
  const ctx = document.getElementById('quizContext');
  if (ctx) {
    const topic = state.currentTopic ? (state.currentTopic.title || state.currentTopic.id || 'Practice') : 'Session';
    ctx.innerHTML = `<strong>${topic}</strong> · ${current}/${total}`;
  }
}

export function showQuestion() {
  updateQuizProgress();
  const q = state.currentQuestions[state.currentIndex];
  const { question: promptRaw, contextLabel, taskInstruction } = cleanQuestionDisplay(q.prompt || q.question || '');
  const promptHtml = escapeAndBold(promptRaw);
  const topicLabel = [
    q.topicTitle || (q.topic ? getTopicLabelForDisplay(q.topic) : ''),
    contextLabel || ''
  ].filter(Boolean).join(': ') || '';
  const questionEl = document.getElementById('questionText');
  if (topicLabel) {
    const escapedLabel = topicLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const showTopicAsLink = state.quizMode === 'diagnostic' && q.topic;
    if (showTopicAsLink) {
      questionEl.innerHTML = '<a href="#topic/' + (q.topic + '').replace(/"/g, '&quot;') + '" class="topic-label diagnostic-topic-link" data-topic-id="' + (q.topic + '').replace(/"/g, '&quot;') + '">' + escapedLabel + '</a>' + promptHtml;
    } else {
      questionEl.innerHTML = '<span class="topic-label">' + escapedLabel + '</span>' + promptHtml;
    }
  } else {
    questionEl.innerHTML = promptHtml;
  }
  const questionInstructionEl = document.getElementById('quizQuestionInstruction');
  if (questionInstructionEl) {
    if (taskInstruction) {
      questionInstructionEl.textContent = taskInstruction;
      questionInstructionEl.classList.remove('hidden');
    } else {
      questionInstructionEl.textContent = '';
      questionInstructionEl.classList.add('hidden');
    }
  }
  document.getElementById('openBlock').classList.add('hidden');
  document.getElementById('mcBlock').classList.add('hidden');
  document.getElementById('openInput').value = '';
  document.getElementById('feedbackBlock').classList.add('hidden');
  if (q.type !== 'mc') document.getElementById('submitBtn').classList.remove('hidden');
  else document.getElementById('submitBtn').classList.add('hidden');

  const gapFillInstructionEl = document.getElementById('quizGapFillInstruction');
  if (q.type === 'mc') {
    if (gapFillInstructionEl) gapFillInstructionEl.classList.add('hidden');
    const mcBlock = document.getElementById('mcBlock');
    mcBlock.classList.remove('hidden');
    var legend = mcBlock.querySelector('legend');
    mcBlock.innerHTML = '';
    if (legend) mcBlock.appendChild(legend);
    else { legend = document.createElement('legend'); legend.textContent = 'Choose an answer'; mcBlock.appendChild(legend); }
    Object.entries(q.options || {}).forEach(([key, text]) => {
      const label = document.createElement('label');
      label.className = 'option';
      label.dataset.option = key;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'mc_option';
      radio.value = key;
      label.appendChild(radio);
      const span = document.createElement('span');
      span.innerHTML = key + ') ' + escapeAndBold(text);
      label.appendChild(span);
      label.addEventListener('click', () => {
        if (!document.getElementById('feedbackBlock').classList.contains('hidden')) return;
        mcBlock.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        label.classList.add('selected');
        radio.checked = true;
        state.selectedMc = key;
        submitAnswer();
      });
      mcBlock.appendChild(label);
    });
    state.selectedMc = null;
  } else {
    if (gapFillInstructionEl) {
      gapFillInstructionEl.classList.remove('hidden');
      const isCorrectSentence = (q.question || '').toLowerCase().indexOf('correct the sentence') !== -1;
      gapFillInstructionEl.textContent = isCorrectSentence ? 'Type the full correct sentence.' : 'Type in the missing words.';
    }
    document.getElementById('openBlock').classList.remove('hidden');
    document.getElementById('openInput').focus();
  }
}


export function submitAnswer() {
  const q = state.currentQuestions[state.currentIndex];
  let correct = false;

  if (q.type === 'mc') {
    correct = state.selectedMc === q.correct_option;
    document.getElementById('mcBlock').querySelectorAll('.option').forEach(o => {
      o.classList.remove('selected');
      if (o.dataset.option === q.correct_option) o.classList.add('correct');
      else if (o.dataset.option === state.selectedMc && !correct) o.classList.add('wrong');
    });
  } else {
    const userAnswer = document.getElementById('openInput').value.trim();
    correct = _answerMatches(userAnswer, q.answers || []);
  }

  if (correct) state.score++; else {
    state.wrongIndices.push(state.currentIndex);
    if (q.topic) state.wrongTopics.add(q.topic);
  }
  saveMemoryBankEntry(questionHash(q), correct);

  const correctAnswerText = q.type === 'mc' ? (q.options && q.options[q.correct_option]) : (q.answers && q.answers[0]);
  let explanationHtml = escapeAndBold(q.explanation || '');
  if ((q.topicTitle || q.topic) && explanationHtml) {
    const topicLabel = q.topicTitle || getTopicLabelForDisplay(q.topic);
    const escapedTopicLabel = topicLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const showTopicAsLink = state.quizMode === 'diagnostic';
    if (showTopicAsLink) {
      explanationHtml = '<a href="#topic/' + (q.topic + '').replace(/"/g, '&quot;') + '" class="topic-label diagnostic-topic-link" data-topic-id="' + (q.topic + '').replace(/"/g, '&quot;') + '">' + escapedTopicLabel + '</a>: ' + explanationHtml;
    } else {
      explanationHtml = '<span class="topic-label">' + escapedTopicLabel + ':</span> ' + explanationHtml;
    }
  }
  if (correct) {
    document.getElementById('feedbackText').innerHTML = '<span class="result-ok">Correct.</span>';
    document.getElementById('explanation').innerHTML = explanationHtml ? '<span class="explanation-label">Explanation</span> ' + explanationHtml : '';
  } else {
    document.getElementById('feedbackText').innerHTML =
      '<span class="result-fail">Incorrect.</span>' +
      (correctAnswerText ? '<p class="correct-answer-line"><strong>Correct answer:</strong> ' + escapeAndBold(correctAnswerText) + '</p>' : '') +
      (explanationHtml ? '<p class="explanation-label">Why?</p>' : '');
    document.getElementById('explanation').innerHTML = explanationHtml || '';
  }
  document.getElementById('submitBtn').classList.add('hidden');
  document.getElementById('feedbackBlock').classList.remove('hidden');
  document.getElementById('nextBtn').focus();
}

export function nextQuestion() {
  state.currentIndex++;
  if (state.currentIndex >= state.currentQuestions.length) {
    finishQuiz();
    return;
  }
  updateQuizProgress();
  showQuestion();
}

export function buildSpellingCorrectAnswersHtml() {
  if (!state.currentTopic || state.currentTopic.id !== 'spelling' || state.wrongIndices.length === 0) return '';
  const lines = [];
  state.wrongIndices.forEach(i => {
    const q = state.currentQuestions[i];
    const correct = q.type === 'mc' ? (q.options && q.options[q.correct_option]) : (q.answers && q.answers[0]);
    if (correct) lines.push('<p style="margin: 0.5rem 0;"><strong>Correct:</strong> ' + escapeAndBold(correct) + '</p>');
  });
  return lines.join('');
}

export function finishQuiz() {
  if (!state.isRetryRound) saveScore(state.currentSetId, state.currentSetTitle, state.score, state.currentQuestions.length);
  document.body.classList.remove('viewing-content');
  document.getElementById('quizScreen').classList.add('hidden');
  const isSpellingWithWrong = state.currentTopic && state.currentTopic.id === 'spelling' && state.wrongIndices.length > 0;
  const correctAnswersHtml = isSpellingWithWrong ? buildSpellingCorrectAnswersHtml() : '';
  if (state.coursePhase) {
    // One continuous lesson: check quiz → guided rounds. Work out what comes
    // next (skipping empty rounds) and offer it as the single obvious step.
    const lessonOrder = ['check'].concat(state.part2Order || []);
    const practiceSections = (state.courseCurriculum && state.courseCurriculum.practice) || {};
    let nextPhase = null;
    for (let i = lessonOrder.indexOf(state.coursePhase) + 1; i < lessonOrder.length; i++) {
      const s = practiceSections[lessonOrder[i]];
      if (s && s.questions && s.questions.length > 0) { nextPhase = lessonOrder[i]; break; }
    }
    document.getElementById('sectionCompleteTitle').textContent =
      state.coursePhase === 'check' ? 'Check complete' : (state.currentSetTitle + ' – complete');
    document.getElementById('sectionCompleteScore').textContent = 'Score: ' + state.score + ' / ' + state.currentQuestions.length;
    const sectionNextStepWrap = document.getElementById('sectionCompleteNextStepWrap');
    const sectionNextStepEl = document.getElementById('sectionCompleteNextStep');
    const sectionRetryWrap = document.getElementById('sectionCompleteRetryWrap');
    const sectionFurtherWrap = document.getElementById('sectionCompleteFurtherPracticeWrap');
    if (nextPhase) {
      const nextTitle = (practiceSections[nextPhase] && practiceSections[nextPhase].title) || nextPhase.replace(/_/g, ' ');
      sectionNextStepEl.textContent = 'Next: ' + nextTitle;
      sectionNextStepWrap.classList.remove('hidden');
      sectionFurtherWrap.classList.add('hidden');
    } else {
      sectionNextStepWrap.classList.add('hidden');
      sectionNextStepEl.textContent = '';
      sectionFurtherWrap.classList.remove('hidden');
    }
    sectionRetryWrap.classList.toggle('hidden', state.wrongIndices.length === 0);
    const sectionCorrectBlock = document.getElementById('sectionCompleteCorrectBlock');
    const sectionCorrectList = document.getElementById('sectionCompleteCorrectList');
    if (isSpellingWithWrong) {
      sectionCorrectBlock.classList.remove('hidden');
      sectionCorrectList.innerHTML = correctAnswersHtml;
    } else {
      sectionCorrectBlock.classList.add('hidden');
      sectionCorrectList.innerHTML = '';
    }
    document.getElementById('sectionCompleteScreen').classList.remove('hidden');
    document.getElementById('sectionCompleteNextBtn').textContent =
      nextPhase ? (state.coursePhase === 'check' ? 'Start practice' : 'Next section') : 'Menu';
    document.getElementById('sectionCompleteMainMenuBtn').classList.toggle('hidden', !nextPhase);
  } else {
    document.getElementById('resultScreen').classList.remove('hidden');
    document.getElementById('resultScore').textContent = `Score: ${state.score} / ${state.currentQuestions.length}`;
    document.getElementById('resultNextStepWrap').classList.add('hidden');
    document.getElementById('resultNextStep').textContent = '';
    document.getElementById('ruleSummary').textContent = state.summary;
    document.getElementById('retryWrongBtn').classList.toggle('hidden', state.wrongIndices.length === 0);
    const wrongCorrectBlock = document.getElementById('wrongAnswersCorrectBlock');
    const wrongCorrectList = document.getElementById('wrongAnswersCorrectList');
    if (isSpellingWithWrong) {
      wrongCorrectBlock.classList.remove('hidden');
      wrongCorrectList.innerHTML = correctAnswersHtml;
    } else {
      wrongCorrectBlock.classList.add('hidden');
      wrongCorrectList.innerHTML = '';
    }
    const reviewBlock = document.getElementById('topicsToReviewBlock');
    const reviewList = document.getElementById('topicsToReviewList');
    const diagFocusBlock = document.getElementById('diagnosticSuggestedFocusBlock');
    if (state.quizMode === 'diagnostic') {
      diagFocusBlock.classList.remove('hidden');
      if (state.wrongTopics.size > 0) {
        reviewBlock.classList.remove('hidden');
        reviewList.innerHTML = '';
        state.wrongTopics.forEach(topicId => {
          const t = state.topics.find(x => x.id === topicId);
          const title = getTopicTitle(topicId);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'secondary';
          btn.textContent = 'Study: ' + title;
        btn.addEventListener('click', () => {
          if (_openTopicIntroFromResults) void _openTopicIntroFromResults(topicId);
        });
        reviewList.appendChild(btn);
      });
      } else {
        reviewBlock.classList.add('hidden');
        reviewList.innerHTML = '';
      }
    } else {
      diagFocusBlock.classList.add('hidden');
      reviewBlock.classList.add('hidden');
      reviewList.innerHTML = '';
    }
    document.getElementById('resultTitle').textContent = 'Quiz finished';
    document.getElementById('resultDefaultActions').classList.remove('hidden');
    renderScoreChart(loadScores);
  }
}

export function retryWrong() {
  const toRetry = state.wrongIndices.map(i => state.currentQuestions[i]);
  state.currentQuestions = toRetry;
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = true;
  document.getElementById('resultScreen').classList.add('hidden');
  document.body.classList.add('viewing-content');
  document.getElementById('quizScreen').classList.remove('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  updateQuizProgress();
  showQuestion();
}
