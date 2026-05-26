
    const STORAGE_KEY = 'presentPerfectQuizScores';
    const MEMORY_KEY = 'presentPerfectQuizMemory';
    let topics = [];
    let currentTopic = { id: 'present_perfect', title: 'English Grammar Check', curriculum: 'curriculum.json', questions_key: 'sets' };
    let allQuestionsData = {};
    let setsData = {};
    let currentSetId = '';
    let currentSetTitle = '';
    let currentQuestions = [];
    let currentIndex = 0;
    let score = 0;
    let wrongIndices = [];
    let summary = '';
    let isRetryRound = false;
    let courseCurriculum = null;
    let coursePhase = null;
    let coursePart = null;
    let introSectionIndex = 0;
    let prepositionsListData = null;
    let prepositionsListReturnTo = 'menu';
    let phrasalVerbsDictionaryData = null;
    let phrasalVerbsDictionaryReturnTo = 'menu';
    const COURSE_ORDER = ['check', 'gapfill', 'errorcorrection', 'makesentence', 'makequestion'];
    const PART2_ORDER = ['gapfill', 'errorcorrection', 'makesentence', 'makequestion'];
    let part2Order = PART2_ORDER;
    let quizMode = 'normal';
    let wrongTopics = new Set();
    let examMode = null;
    let examOpenClozeData = null;
    let currentExamClozeTests = [];
    let currentExamClozeTestIndex = 0;
    let currentExamClozeMode = '';
    let currentExamClozeTest = null;
    let examClozeMcSelections = [];
    let returnToAfterTopicSelect = null;

    function questionHash(q) {
      const s = (q.question || q.prompt || '').trim();
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
      return (h >>> 0).toString(36);
    }

    function escapeAndBold(str) {
      if (str == null || str === '') return '';
      const s = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    }

    function loadScores() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { history: [] };
      } catch { return { history: [] }; }
    }

    function loadMemoryBank() {
      try {
        const raw = localStorage.getItem(MEMORY_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }

    function saveMemoryBankEntry(key, correct) {
      const bank = loadMemoryBank();
      if (!bank[key]) bank[key] = { wrong: 0, right: 0, lastWrong: null };
      if (correct) bank[key].right++; else { bank[key].wrong++; bank[key].lastWrong = new Date().toISOString(); }
      localStorage.setItem(MEMORY_KEY, JSON.stringify(bank));
    }

    function saveScore(setId, setTitle, score, total) {
      const data = loadScores();
      data.history.push({ set_id: setId, set_title: setTitle, score, total, date: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getLastBest(setId) {
      const data = loadScores();
      const forSet = (data.history || []).filter(e => e.set_id === setId);
      if (!forSet.length) return { last: null, best: null };
      const last = forSet[forSet.length - 1];
      const best = forSet.reduce((acc, e) => {
        if (!acc || (e.score / e.total) > (acc.score / acc.total)) return e;
        return acc;
      }, null);
      return { last: [last.score, last.total], best: [best.score, best.total] };
    }

    const WEAK_SPOT_RIGHT_THRESHOLD = 3;
    function getWeakSpotQuestions() {
      const bank = loadMemoryBank();
      const seen = new Set();
      const out = [];
      Object.values(setsData).forEach(s => {
        (s.questions || []).forEach(q => {
          const key = questionHash(q);
          const entry = bank[key];
          if (entry && entry.wrong > 0 && (entry.right || 0) < WEAK_SPOT_RIGHT_THRESHOLD && !seen.has(key)) {
            seen.add(key);
            out.push(q);
          }
        });
      });
      return out;
    }

    function getProgressStats() {
      const data = loadScores();
      const history = data.history || [];
      const total = history.length;
      if (total === 0) return { total: 0, avg: 0, thisWeek: 0, streak: 0 };
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek = history.filter(e => new Date(e.date) >= weekAgo).length;
      let totalCorrect = 0, totalQuestions = 0;
      history.forEach(e => { totalCorrect += e.score; totalQuestions += e.total; });
      const avg = totalQuestions ? Math.round((100 * totalCorrect) / totalQuestions) : 0;
      let streak = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const pct = (100 * history[i].score) / history[i].total;
        if (pct >= 80) streak++; else break;
      }
      return { total, avg, thisWeek, streak };
    }

    function normalize(s) {
      return s.trim().toLowerCase().replace(/\s+/g, ' ');
    }
    function toTitleCase(s) {
      if (!s || typeof s !== 'string') return s;
      const minor = new Set(['a','an','the','and','but','or','in','on','at','to','for','of','with','by','vs','as']);
      return s.split(/(\s+)/).map((part, i, arr) => {
        if (/\s+/.test(part)) return part;
        const word = part.toLowerCase();
        const bare = word.replace(/^[\W_]+/, '').replace(/[\W_]+$/, '');
        const isFirst = i === 0;
        const isLast = i === arr.length - 1;
        if (minor.has(word) && !isFirst && !isLast) return word;
        if (minor.has(bare)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join('');
    }

    function answerMatches(user, accepted) {
      const u = normalize(user);
      const uNoStop = u.replace(/\.\s*$/, '');
      if (u === '') {
        const noArticleValues = ['no article', '∅', 'nothing'];
        if (accepted.some(a => noArticleValues.includes(normalize(a)))) return true;
      }
      return accepted.some(a => {
        const n = normalize(a);
        return n === u || (uNoStop !== '' && n.replace(/\.\s*$/, '') === uNoStop);
      });
    }

    function getBaseUrl() {
      return new URL('.', window.location.href).href;
    }

    async function loadQuestions() {
      const res = await fetch(new URL('questions.json?v=3', getBaseUrl()));
      if (!res.ok) throw new Error('Could not load questions.json');
      allQuestionsData = await res.json();
      setsData = allQuestionsData[currentTopic.questions_key] || allQuestionsData.sets || {};
    }

    function applyTopic() {
      setsData = allQuestionsData[currentTopic.questions_key] || allQuestionsData.sets || {};
    }

    function renderMenu() {
      const summaryEl = document.getElementById('scoresSummary');
      const lastBest = getLastBest(currentTopic.id);
      if (lastBest.last) {
        summaryEl.textContent = 'Last: ' + lastBest.last[0] + '/' + lastBest.last[1] +
          (lastBest.best && (lastBest.best[0] !== lastBest.last[0] || lastBest.best[1] !== lastBest.last[1])
            ? '  •  Best: ' + lastBest.best[0] + '/' + lastBest.best[1] : '');
      } else {
        summaryEl.textContent = '';
      }

      const memEl = document.getElementById('memoryBankSummary');
      memEl.innerHTML = '';

      document.getElementById('menuScreen').classList.remove('hidden');
      document.getElementById('quizScreen').classList.add('hidden');
      document.getElementById('resultScreen').classList.add('hidden');
      document.getElementById('introScreen').classList.add('hidden');
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      document.getElementById('prepositionsListScreen').classList.add('hidden');
      document.getElementById('phrasalVerbsDictionaryScreen').classList.add('hidden');
      document.getElementById('referenceScreen').classList.add('hidden');
      if (examMode === 'open_cloze') {
        document.getElementById('menuOpenCloze').classList.remove('hidden');
        document.getElementById('menuMain').classList.add('hidden');
        document.getElementById('menuOpenClozeModes').classList.add('hidden');
      } else {
        document.getElementById('menuMain').classList.remove('hidden');
        document.getElementById('menuOpenCloze').classList.add('hidden');
        document.getElementById('menuOpenClozeModes').classList.add('hidden');
      }
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuExamPractice').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      const diagSetup = document.getElementById('menuDiagnosticSetup');
      if (diagSetup) diagSetup.classList.add('hidden');
    }

    function showTopicSelectMenu() {
      document.getElementById('menuMain').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.remove('hidden');
      document.getElementById('menuExamPractice').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.add('hidden');
      document.getElementById('menuOpenClozeModes').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      document.getElementById('menuDiagnosticSetup').classList.add('hidden');
      const backToPrevBtn = document.getElementById('topicSelectBackToPrevBtn');
      if (backToPrevBtn) {
        if (returnToAfterTopicSelect === 'exam_cloze_feedback') {
          backToPrevBtn.classList.remove('hidden');
          backToPrevBtn.textContent = 'Back to exam answers';
        } else {
          backToPrevBtn.classList.add('hidden');
        }
      }
    }

    function showExamPracticeMenu() {
      document.getElementById('menuMain').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuExamPractice').classList.remove('hidden');
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      document.getElementById('menuDiagnosticSetup').classList.add('hidden');
    }

    function showMainMenu() {
      document.getElementById('menuMain').classList.remove('hidden');
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuExamPractice').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.add('hidden');
      document.getElementById('menuOpenClozeModes').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      document.getElementById('menuDiagnosticSetup').classList.add('hidden');
    }

    function showOpenClozeMenu() {
      currentTopic = { id: 'open_cloze', title: 'Open Cloze', curriculum: 'curriculum_open_cloze.json' };
      examMode = 'open_cloze';
      document.getElementById('menuMain').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuExamPractice').classList.add('hidden');
      document.getElementById('menuOpenClozeModes').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.remove('hidden');
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      document.getElementById('menuDiagnosticSetup').classList.add('hidden');
    }

    function showOpenClozeModes() {
      document.getElementById('menuScreen').classList.remove('hidden');
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      document.getElementById('resultScreen').classList.add('hidden');
      document.getElementById('menuOpenClozeModes').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.remove('hidden');
    }

    function renderPrepositionsListContent(data) {
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

    function prepositionsListAsText(data) {
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

    async function showPrepositionsList(returnTo) {
      prepositionsListReturnTo = returnTo || 'menu';
      if (!prepositionsListData) {
        try {
          const res = await fetch(new URL('prepositions_list.json', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load list');
          prepositionsListData = await res.json();
        } catch (e) {
          alert('Could not load preposition list. ' + e.message);
          return;
        }
      }
      renderPrepositionsListContent(prepositionsListData);
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('introScreen').classList.add('hidden');
      document.getElementById('prepositionsListScreen').classList.remove('hidden');
    }

    function hidePrepositionsList() {
      document.getElementById('prepositionsListScreen').classList.add('hidden');
      if (prepositionsListReturnTo === 'intro') {
        document.getElementById('introScreen').classList.remove('hidden');
      } else {
        document.getElementById('menuScreen').classList.remove('hidden');
      }
    }

    function renderPhrasalVerbsDictionaryContent(data) {
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

    function phrasalVerbsDictionaryAsText(data) {
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

    async function showPhrasalVerbsDictionary(returnTo) {
      phrasalVerbsDictionaryReturnTo = returnTo || 'menu';
      if (!phrasalVerbsDictionaryData) {
        try {
          const res = await fetch(new URL('phrasal_verbs_dictionary.json?v=3', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load dictionary');
          phrasalVerbsDictionaryData = await res.json();
        } catch (e) {
          alert('Could not load phrasal verb dictionary. ' + e.message);
          return;
        }
      }
      renderPhrasalVerbsDictionaryContent(phrasalVerbsDictionaryData);
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('introScreen').classList.add('hidden');
      document.getElementById('phrasalVerbsDictionaryScreen').classList.remove('hidden');
    }

    function hidePhrasalVerbsDictionary() {
      document.getElementById('phrasalVerbsDictionaryScreen').classList.add('hidden');
      if (phrasalVerbsDictionaryReturnTo === 'intro') {
        document.getElementById('introScreen').classList.remove('hidden');
      } else {
        document.getElementById('menuScreen').classList.remove('hidden');
      }
    }

    let referenceInfinitiveIngData = null;
    let referenceModalVerbsData = null;
    let dependentPrepositionsData = null;
    let countableUncountableData = null;
    let referenceView = 'index';

    function renderReferenceIndex() {
      referenceView = 'index';
      document.getElementById('referenceTitle').textContent = 'Reference';
      const content = document.getElementById('referenceContent');
      content.innerHTML = '';
      const p = document.createElement('p');
      p.style.color = 'var(--muted)';
      p.style.marginBottom = '0.5rem';
      p.style.fontSize = '0.9rem';
      p.textContent = 'Choose a reference list:';
      content.appendChild(p);
      const grid = document.createElement('div');
      grid.className = 'reference-index-grid';
      const items = [
        ['Infinitive and -ing Form', showReferenceInfinitiveIng],
        ['Modal Verbs', showReferenceModalVerbs],
        ['Phrasal Verb Dictionary', showReferencePhrasalVerbs],
        ['Prepositions List', showReferencePrepositions],
        ['Dependent Prepositions: Verbs', () => showReferenceDependentSection('verbs')],
        ['Dependent Prepositions: Nouns', () => showReferenceDependentSection('nouns')],
        ['Dependent Prepositions: Adjectives', () => showReferenceDependentSection('adjectives')],
        ['Preposition + Verb Compound Nouns', () => showReferenceDependentSection('compound_nouns')],
        ['Nouns: Uncountable and Always-Plural', showReferenceCountableUncountable],
        ['Open Cloze: Word types', showReferenceOpenCloze]
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
      document.getElementById('referenceBackBtn').textContent = 'Menu';
    }

    function renderReferencePrepositionsContent(data) {
      if (!data) return;
      referenceView = 'prepositions';
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

    async function showReferencePrepositions() {
      if (!prepositionsListData) {
        try {
          const res = await fetch(new URL('prepositions_list.json', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load list');
          prepositionsListData = await res.json();
        } catch (e) {
          alert('Could not load preposition list. ' + e.message);
          return;
        }
      }
      renderReferencePrepositionsContent(prepositionsListData);
    }

    let referenceOpenClozeData = null;

    function renderReferenceOpenClozeContent(data) {
      if (!data) return;
      referenceView = 'open_cloze';
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

    async function showReferenceOpenCloze() {
      if (!referenceOpenClozeData) {
        try {
          const res = await fetch(new URL('reference_open_cloze.json?v=1', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load reference');
          referenceOpenClozeData = await res.json();
        } catch (e) {
          alert('Could not load Open Cloze reference. ' + (e && e.message));
          return;
        }
      }
      renderReferenceOpenClozeContent(referenceOpenClozeData);
    }

    const DEPENDENT_SECTION_VIEWS = { verbs: 'dependent_verbs', nouns: 'dependent_nouns', adjectives: 'dependent_adjectives', compound_nouns: 'compound_nouns' };

    function getParticleFromPhrase(phrase) {
      if (!phrase || typeof phrase !== 'string') return '';
      const last = phrase.trim().split(/\s+/).pop() || '';
      const first = last.split(/\s*\/\s*/)[0].trim();
      return first || last;
    }

    const COMPOUND_PREFIXES = ['under', 'over', 'with', 'out', 'down', 'up', 'on', 'off', 'by', 'in'];

    function getPrefixForCompound(word) {
      if (!word || typeof word !== 'string') return '';
      const w = word.toLowerCase();
      for (let i = 0; i < COMPOUND_PREFIXES.length; i++) {
        if (w.indexOf(COMPOUND_PREFIXES[i]) === 0) return COMPOUND_PREFIXES[i];
      }
      return '';
    }

    function groupByParticle(arr, getParticle) {
      const groups = {};
      (arr || []).forEach(entry => {
        const p = getParticle(entry);
        if (!groups[p]) groups[p] = [];
        groups[p].push(entry);
      });
      return groups;
    }

    function renderReferenceDependentSection(data, section) {
      if (!data) return;
      referenceView = DEPENDENT_SECTION_VIEWS[section] || 'dependent_verbs';
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

    async function showReferenceDependentSection(section) {
      if (!dependentPrepositionsData) {
        try {
          const res = await fetch(new URL('reference_dependent_prepositions.json', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load list');
          dependentPrepositionsData = await res.json();
        } catch (e) {
          alert('Could not load list. ' + e.message);
          return;
        }
      }
      renderReferenceDependentSection(dependentPrepositionsData, section);
    }

    function dependentPrepositionsSectionAsText(data, section) {
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

    function renderReferenceCountableUncountableContent(data) {
      if (!data) return;
      referenceView = 'countable_uncountable';
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

    async function showReferenceCountableUncountable() {
      if (!countableUncountableData) {
        try {
          const res = await fetch(new URL('reference_countable_uncountable.json', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load list');
          countableUncountableData = await res.json();
        } catch (e) {
          alert('Could not load list. ' + e.message);
          return;
        }
      }
      renderReferenceCountableUncountableContent(countableUncountableData);
    }

    function countableUncountableAsText(data) {
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

    let phrasalVerbListView = 'sections';

    function renderReferencePhrasalVerbsContent(data, viewMode) {
      if (!data) return;
      if (viewMode !== undefined) phrasalVerbListView = viewMode;
      referenceView = 'phrasal_verbs';
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
      if (phrasalVerbListView === 'sections') {
        toggleBtn.textContent = 'Sort by particle';
        toggleBtn.addEventListener('click', () => renderReferencePhrasalVerbsContent(data, 'byParticle'));
      } else {
        toggleBtn.textContent = 'Show by section (Top 50 / Next 100)';
        toggleBtn.addEventListener('click', () => renderReferencePhrasalVerbsContent(data, 'sections'));
      }
      content.appendChild(toggleBtn);

      if (phrasalVerbListView === 'sections') {
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

    async function showReferencePhrasalVerbs() {
      if (!phrasalVerbsDictionaryData) {
        try {
          const res = await fetch(new URL('phrasal_verbs_dictionary.json?v=3', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load dictionary');
          phrasalVerbsDictionaryData = await res.json();
        } catch (e) {
          alert('Could not load phrasal verb dictionary. ' + e.message);
          return;
        }
      }
      renderReferencePhrasalVerbsContent(phrasalVerbsDictionaryData);
    }

    function renderReferenceInfinitiveIngContent(data) {
      if (!data) return;
      referenceView = 'infinitive_ing';
      document.getElementById('referenceTitle').textContent = data.title || 'Infinitive and -ing: verb patterns';
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

    function referenceAsText(data) {
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

    async function showReference() {
      renderReferenceIndex();
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('introScreen').classList.add('hidden');
      document.getElementById('referenceBtnWrap').classList.add('hidden');
      document.getElementById('referenceScreen').classList.remove('hidden');
      document.body.classList.add('viewing-reference');
    }

    async function showReferenceInfinitiveIng() {
      if (!referenceInfinitiveIngData) {
        try {
          const res = await fetch(new URL('reference_infinitive_ing.json', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load reference');
          referenceInfinitiveIngData = await res.json();
        } catch (e) {
          alert('Could not load reference. ' + e.message);
          return;
        }
      }
      renderReferenceInfinitiveIngContent(referenceInfinitiveIngData);
    }

    function renderReferenceModalVerbsContent(data) {
      if (!data) return;
      referenceView = 'modal_verbs';
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

    async function showReferenceModalVerbs() {
      if (!referenceModalVerbsData) {
        try {
          const res = await fetch(new URL('reference_modal_verbs.json', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load reference');
          referenceModalVerbsData = await res.json();
        } catch (e) {
          alert('Could not load reference. ' + e.message);
          return;
        }
      }
      renderReferenceModalVerbsContent(referenceModalVerbsData);
    }

    function hideReference() {
      document.getElementById('referenceScreen').classList.add('hidden');
      document.getElementById('referenceBtnWrap').classList.remove('hidden');
      document.getElementById('menuScreen').classList.remove('hidden');
      document.body.classList.remove('viewing-reference');
    }

    function onReferenceBackClick() {
      if (referenceView === 'infinitive_ing' || referenceView === 'modal_verbs' || referenceView === 'phrasal_verbs' || referenceView === 'prepositions' || referenceView === 'dependent_verbs' || referenceView === 'dependent_nouns' || referenceView === 'dependent_adjectives' || referenceView === 'compound_nouns' || referenceView === 'countable_uncountable' || referenceView === 'open_cloze') {
        renderReferenceIndex();
      } else {
        hideReference();
      }
    }

    function showIntroSection(index) {
      const intro = courseCurriculum.intro || {};
      const sections = intro.sections || [];
      if (index >= sections.length) {
        document.getElementById('introScreen').classList.add('hidden');
        if (coursePart === 1) startCourseSection('check');
        return;
      }
      document.getElementById('introTitle').textContent = sections[index].title || 'Introduction';
      const introHtml = escapeAndBold(sections[index].content || '').replace(/\n/g, '<br>');
      document.getElementById('introContent').innerHTML = '<div class="intro-section">' + introHtml + '</div>';
      const isLastSection = index >= sections.length - 1;
      const hasCheckQuestions = ((courseCurriculum?.check?.questions) || []).length > 0;
      document.getElementById('introNextBtn').textContent = !isLastSection ? 'Next' : (hasCheckQuestions ? 'Start test' : 'Menu');
      introSectionIndex = index;
      document.getElementById('introPrepositionsListWrap').classList.add('hidden');
      document.getElementById('introPhrasalVerbsWrap').classList.add('hidden');
    }

    function startCourseSection(phase) {
      coursePhase = phase;
      let questions = [];
      let title = '';
      if (phase === 'check') {
        const check = courseCurriculum.check || {};
        questions = (check.questions || []).slice();
        title = check.title || 'Test your understanding';
        currentSetId = 'course_check';
      } else {
        const practice = courseCurriculum.practice || {};
        const section = practice[phase];
        if (!section || !section.questions) {
          advanceCourseToNext();
          return;
        }
        questions = section.questions.slice();
        if (coursePart === 2 && questions.length > 1) {
          for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
          }
        }
        title = section.title || phase;
        currentSetId = 'course_' + phase;
      }
      currentSetTitle = title;
      currentQuestions = questions;
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = false;
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    function advanceCourseToNext() {
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      if (coursePart === 1) {
        coursePart = null;
        coursePhase = null;
        renderMenu();
        return;
      }
      const order = coursePart === 2 ? part2Order : COURSE_ORDER;
      const idx = order.indexOf(coursePhase);
      const nextPhase = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
      if (!nextPhase) {
        coursePhase = null;
        if (coursePart === 2) {
          coursePart = null;
          if (examMode === 'open_cloze') {
            showOpenClozeModes();
            return;
          }
          document.getElementById('resultScreen').classList.remove('hidden');
          document.getElementById('resultScore').textContent = 'Part 2 complete! Well done.';
          const sectionNames = part2Order.map(function(k) {
            const s = courseCurriculum.practice && courseCurriculum.practice[k];
            return (s && s.title) ? s.title.replace(new RegExp('^Practice: Gap fill –?\\s*', 'i'), '').trim() : k.replace(/_/g, ' ');
          });
          document.getElementById('ruleSummary').textContent = 'You have finished Practice: ' + sectionNames.join(', ') + '.';
          document.getElementById('resultNextStep').textContent = 'Suggested next step: Further Practice';
          document.getElementById('resultNextStepWrap').classList.remove('hidden');
          document.getElementById('retryWrongBtn').classList.add('hidden');
        }
        return;
      }
      const practice = courseCurriculum.practice || {};
      const section = practice[nextPhase];
      if (!section || !section.questions || section.questions.length === 0) {
        advanceCourseToNext();
        return;
      }
      startCourseSection(nextPhase);
    }

    async function startPart1() {
      if (!hasValidTopicSelected()) {
        alert('Please choose a topic first.');
        return;
      }
      try {
        const res = await fetch(new URL(currentTopic.curriculum + '?v=4', getBaseUrl()));
        if (!res.ok) throw new Error('Could not load ' + currentTopic.curriculum);
        courseCurriculum = await res.json();
      } catch (e) {
        const msg = window.location.protocol === 'file:' ? 'This app must run from a local server. Double-click start_server.bat in this folder, or run: python -m http.server 8080' : ('Could not load curriculum. ' + e.message);
      alert(msg);
        return;
      }
      coursePart = 1;
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('introScreen').classList.remove('hidden');
      introSectionIndex = 0;
      showIntroSection(0);
    }

    async function startPart2() {
      if (!hasValidTopicSelected()) {
        alert('Please choose a topic first.');
        return;
      }
      try {
        const res = await fetch(new URL(currentTopic.curriculum + '?v=4', getBaseUrl()));
        if (!res.ok) throw new Error('Could not load ' + currentTopic.curriculum);
        courseCurriculum = await res.json();
      } catch (e) {
        const msg = window.location.protocol === 'file:' ? 'This app must run from a local server. Double-click start_server.bat in this folder, or run: python -m http.server 8080' : ('Could not load curriculum. ' + e.message);
      alert(msg);
        return;
      }
      coursePart = 2;
      part2Order = courseCurriculum.practice_order || PART2_ORDER;
      document.getElementById('menuScreen').classList.add('hidden');
      if (!part2Order.length) { renderMenu(); return; }
      const practice = courseCurriculum.practice || {};
      const first = part2Order[0];
      const section = practice[first];
      if (!section || !section.questions || section.questions.length === 0) {
        renderMenu();
        return;
      }
      startCourseSection(first);
    }

    const FULL_TOPIC_TITLES = {
      conditionals: 'Tenses: Conditionals (Zero, First, Second, Third)',
      tenses_general: 'Tenses: General',
      past_perfect: 'Tenses: Past Perfect Simple and Past Perfect Continuous',
      past_simple_continuous: 'Tenses: Past Simple and Past Continuous',
      past_simple_present_perfect: 'Tenses: Past Simple vs Present Perfect',
      present_perfect: 'Tenses: Present Perfect Simple vs Continuous',
      will_going_to: 'Tenses: Will and Going To'
    };

    async function startDiagnostic(num) {
      num = Math.min(100, Math.max(20, parseInt(num, 10) || 50));
      let allData;
      try {
        const res = await fetch(new URL('questions.json?v=3', getBaseUrl()));
        if (!res.ok) throw new Error('Could not load questions');
        allData = await res.json();
      } catch (e) {
        alert('Could not load Grammar Test. ' + e.message);
        return;
      }
      const pool = [];
      (topics || []).forEach(function(t) {
        const key = t.questions_key || t.id;
        const sets = allData[key];
        if (!sets || typeof sets !== 'object') return;
        Object.values(sets).forEach(function(set) {
          const qs = set.questions || [];
          qs.forEach(function(q) {
            pool.push(Object.assign({}, q, { topic: t.id, topicTitle: FULL_TOPIC_TITLES[t.id] || t.title || getTopicTitle(t.id) }));
          });
        });
      });
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const max = Math.min(num, pool.length);
      currentQuestions = pool.slice(0, max);
      currentSetId = 'diagnostic';
      currentSetTitle = 'Grammar Test';
      summary = max + ' questions from all topics (random order). Wrong answers point to topics you need to revise.';
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = false;
      quizMode = 'diagnostic';
      wrongTopics = new Set();
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    async function startMixedPractice() {
      let data;
      try {
        const res = await fetch(new URL('mixed_cloze.json?v=3', getBaseUrl()));
        if (!res.ok) throw new Error('Could not load mixed cloze');
        data = await res.json();
      } catch (e) {
        alert('Could not load mixed practice. ' + e.message);
        return;
      }
      const questions = (data.questions || []).slice();
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
      currentQuestions = questions;
      currentSetId = 'mixed_practice';
      currentSetTitle = data.title_practice || 'Mixed cloze practice';
      summary = data.summary_practice || '';
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = false;
      quizMode = 'practice';
      wrongTopics = new Set();
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    function startExamClozeQuiz(mode, questions) {
      const list = (questions || []).slice();
      if (list.length === 0) {
        alert('Coming soon.');
        return;
      }
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      coursePhase = null;
      coursePart = null;
      quizMode = 'normal';
      wrongTopics = new Set();
      currentQuestions = list;
      currentSetId = 'open_cloze_' + mode;
      currentSetTitle = 'Open Cloze – ' + (mode === 'easy' ? 'Easy (MC)' : mode === 'medium' ? 'Medium' : mode === 'hard' ? 'Hard' : 'Expert');
      summary = list.length + ' questions (random order).';
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = false;
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      document.getElementById('resultScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    async function loadAndStartExamCloze(mode) {
      if (!examOpenClozeData) {
        try {
          const res = await fetch(new URL('exam_open_cloze.json?v=3', getBaseUrl()));
          if (!res.ok) throw new Error('Could not load exam_open_cloze.json');
          examOpenClozeData = await res.json();
        } catch (e) {
          alert('Could not load exam practice. ' + (e && e.message));
          return;
        }
      }
      const data = examOpenClozeData[mode];
      if (!data || data.length === 0) {
        alert('Coming soon.');
        return;
      }
      const isTestsFormat = data[0] && data[0].passage && Array.isArray(data[0].gaps);
      if (isTestsFormat) {
        currentExamClozeTests = data;
        currentExamClozeMode = mode;
        showExamClozeTestSelectScreen();
      } else {
        startExamClozeQuiz(mode, data);
      }
    }

    const EXAM_CLOZE_GAP = '_____';

    function showExamClozeTestSelectScreen() {
      const mode = currentExamClozeMode || 'easy';
      const cap = mode.charAt(0).toUpperCase() + mode.slice(1);
      document.getElementById('examClozeTestSelectHeading').textContent = 'Choose a test (' + cap + ').';
      const listEl = document.getElementById('examClozeTestSelectList');
      listEl.innerHTML = '';
      (currentExamClozeTests || []).forEach((test, i) => {
        const shortTitle = test.title ? (test.title.replace(new RegExp('^Open Cloze:\\s*', 'i'), '').trim() : '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary';
        btn.textContent = shortTitle ? 'Test ' + (i + 1) + ': ' + shortTitle : 'Test ' + (i + 1);
        btn.dataset.index = String(i);
        listEl.appendChild(btn);
      });
      document.getElementById('menuScreen').classList.remove('hidden');
      document.getElementById('menuOpenCloze').classList.add('hidden');
      document.getElementById('menuExamClozeTestSelect').classList.remove('hidden');
      document.getElementById('examClozeTestScreen').classList.add('hidden');
      document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
    }

    function startExamClozeTestByIndex(index) {
      currentExamClozeTestIndex = index;
      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('menuExamClozeTestSelect').classList.add('hidden');
      document.getElementById('examClozeTestScreen').classList.remove('hidden');
      document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
      renderExamClozeTest(currentExamClozeTests[currentExamClozeTestIndex]);
    }

    function renderExamClozeTest(test) {
      currentExamClozeTest = test;
      const total = currentExamClozeTests.length;
      document.getElementById('examClozeProgress').textContent = 'Test ' + (currentExamClozeTestIndex + 1) + ' of ' + total;
      const titleEl = document.getElementById('examClozeTitle');
      if (test.title) {
        titleEl.textContent = test.title;
        titleEl.classList.remove('hidden');
      } else {
        titleEl.classList.add('hidden');
      }
      const instructionsEl = document.getElementById('examClozeInstructions');
      instructionsEl.textContent = test.instructions || 'Read the text and write one word for each gap (or choose for Easy).';
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
      examClozeMcSelections = [];

      if (test.type === 'mc') {
        for (let i = 0; i < gapCount; i++) {
          passageEl.appendChild(document.createTextNode(segments[i]));
          const numSpan = document.createElement('span');
          numSpan.className = 'exam-cloze-gap-num';
          numSpan.textContent = ' (' + (i + 1) + ') ';
          numSpan.style.color = 'var(--muted)';
          passageEl.appendChild(numSpan);
        }
        passageEl.appendChild(document.createTextNode(segments[gapCount]));
        const letters = ['a', 'b', 'c', 'd'];
        test.gaps.forEach((gap, i) => {
          const row = document.createElement('div');
          row.className = 'exam-cloze-mc-row';
          row.appendChild(document.createTextNode((i + 1) + '. '));
          Object.entries(gap.options || {}).forEach(([key, text]) => {
            const opt = document.createElement('span');
            opt.className = 'option';
            opt.dataset.gapIndex = String(i);
            opt.dataset.option = key;
            opt.textContent = key + ') ' + text;
            opt.addEventListener('click', function() {
              row.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
              opt.classList.add('selected');
              examClozeMcSelections[i] = key;
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
          passageEl.appendChild(input);
        }
        passageEl.appendChild(document.createTextNode(segments[gapCount]));
      }
      document.getElementById('examClozeSubmitBtn').classList.remove('hidden');
    }

    function submitExamClozeTest() {
      const test = currentExamClozeTest;
      if (!test || !test.gaps) return;
      const results = [];
      let scoreCount = 0;
      for (let i = 0; i < test.gaps.length; i++) {
        const gap = test.gaps[i];
        let correct = false;
        let userVal = '';
        if (test.type === 'mc') {
          userVal = examClozeMcSelections[i];
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
          correct = answerMatches(userVal, gap.answers || []);
          if (input) {
            input.readOnly = true;
            input.classList.add(correct ? 'correct' : 'wrong');
          }
        }
        if (correct) scoreCount++;
        results.push({ index: i, correct, userVal, gap });
      }
      const total = test.gaps.length;
      document.getElementById('examClozeScoreText').textContent = 'Score: ' + scoreCount + ' / ' + total;
      const wrongList = document.getElementById('examClozeWrongList');
      const allHtml = results.map(r => {
        const correctAnswer = test.type === 'mc' ? (r.gap.options && r.gap.options[r.gap.correct_option]) : (r.gap.answers && r.gap.answers.length ? r.gap.answers.join(' or ') : (r.gap.answers && r.gap.answers[0]) || '');
        const correctText = correctAnswer || '';
        const topicId = r.gap.topic_id;
        const topic = topics && topics.find(t => t.id === topicId);
        const topicTitle = topic ? (topic.title || topicId) : topicId;
        let line = '<p style="margin: 0.5rem 0;"><strong>Gap ' + (r.index + 1) + ':</strong> ';
        if (topicId) {
          line += '<a href="#" class="exam-cloze-topic-link" data-topic-id="' + String(topicId).replace(/"/g, '&quot;') + '">' + String(topicTitle).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</a>. ';
        }
        line += escapeAndBold(r.gap.explanation || '') + ' <span class="correct-answer-line">Correct: ' + escapeAndBold(correctText) + '</span>';
        if (!r.correct && r.userVal !== undefined && r.userVal !== '') {
          line += ' <span style="color: var(--muted);">You wrote: ' + escapeAndBold(r.userVal) + '</span>';
        }
        line += '</p>';
        return line;
      }).join('');
      wrongList.innerHTML = allHtml;
      document.getElementById('examClozeSubmitBtn').classList.add('hidden');
      document.getElementById('examClozeFeedbackBlock').classList.remove('hidden');
      const nextBtn = document.getElementById('examClozeNextBtn');
      nextBtn.textContent = currentExamClozeTestIndex + 1 < currentExamClozeTests.length ? 'Next test' : 'Back to Open Cloze';
      nextBtn.focus();
    }

    function onExamClozeNext() {
      currentExamClozeTestIndex++;
      if (currentExamClozeTestIndex >= currentExamClozeTests.length) {
        document.getElementById('examClozeTestScreen').classList.add('hidden');
        document.getElementById('menuScreen').classList.remove('hidden');
        document.getElementById('menuOpenCloze').classList.remove('hidden');
        return;
      }
      document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
      renderExamClozeTest(currentExamClozeTests[currentExamClozeTestIndex]);
    }

    function onExamClozeExit() {
      document.getElementById('examClozeTestScreen').classList.add('hidden');
      showExamClozeTestSelectScreen();
    }

    function startQuiz() {
      coursePhase = null;
      quizMode = 'normal';
      wrongTopics = new Set();
      const numSelect = document.getElementById('numQuestionsSelect');
      const val = numSelect && numSelect.value;
      const pool = Object.values(setsData).flatMap(s => s.questions || []);
      if (pool.length === 0) {
        alert('No questions available for this topic.');
        return;
      }
      const questions = pool.slice();
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
      const max = (val === 'unlimited') ? questions.length : 20;
      currentQuestions = questions.slice(0, max);
      currentSetId = currentTopic.id;
      currentSetTitle = (currentTopic.title || currentTopic.id) + ' (' + max + ' questions)';
      summary = max + ' questions from this topic (random order).';
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = false;

      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    function startWeakSpotsQuiz() {
      coursePhase = null;
      quizMode = 'normal';
      wrongTopics = new Set();
      const questions = getWeakSpotQuestions();
      if (questions.length === 0) {
        alert('No weak spots yet. Do a quiz and get some wrong to build your revision list.');
        return;
      }
      const shuffled = questions.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      currentQuestions = shuffled;
      currentSetId = 'weakspots';
      currentSetTitle = 'Revise weak spots (' + shuffled.length + ' questions)';
      summary = 'Questions you got wrong – get each right 3 times and it will drop off.';
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = false;

      document.getElementById('menuScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    function hasValidTopicSelected() {
      if (examMode === 'open_cloze' && currentTopic && currentTopic.curriculum) return true;
      const sel = document.getElementById('topicSelect');
      const val = sel && sel.value;
      return val !== '' && val !== '-1' && topics[parseInt(val, 10)] != null;
    }

    function getTopicTitle(topicId) {
      const t = (topics || []).find(x => x.id === topicId);
      return toTitleCase(t ? (t.title || topicId) : topicId);
    }
    function getTopicLabelForDisplay(topicId) {
      return getTopicTitle(topicId) || '';
    }

    function cleanQuestionDisplay(str) {
      if (!str || typeof str !== 'string') return { question: '', contextLabel: null };
      let s = str.trim().replace(/^\d+\.\s*/, '');
      let contextLabel = null;
      const metaMatch = s.match(/^(Multiple choice|Error correction|Choose the best sentence)(?:\s+\(([^)]+)\))?\s*\n/i);
      if (metaMatch) {
        contextLabel = metaMatch[2] ? metaMatch[2].trim() : null;
        s = s.slice(metaMatch[0].length);
      }
      return { question: s.trim(), contextLabel };
    }

    function showQuestion() {
      const q = currentQuestions[currentIndex];
      const total = currentQuestions.length;
      document.getElementById('progress').textContent = `Question ${currentIndex + 1} of ${total}`;
      const { question: promptRaw, contextLabel } = cleanQuestionDisplay(q.prompt || q.question || '');
      const promptHtml = escapeAndBold(promptRaw);
      const topicLabel = [
        q.topicTitle || (q.topic ? getTopicLabelForDisplay(q.topic) : ''),
        contextLabel || ''
      ].filter(Boolean).join(': ') || '';
      const questionEl = document.getElementById('questionText');
      if (topicLabel) {
        questionEl.innerHTML = '<span class="topic-label">' + topicLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' + promptHtml;
      } else {
        questionEl.innerHTML = promptHtml;
      }
      document.getElementById('openBlock').classList.add('hidden');
      document.getElementById('mcBlock').classList.add('hidden');
      document.getElementById('openInput').value = '';
      document.getElementById('submitBtn').classList.remove('hidden');
      document.getElementById('feedbackBlock').classList.add('hidden');

      if (q.type === 'mc') {
        const mcBlock = document.getElementById('mcBlock');
        mcBlock.classList.remove('hidden');
        mcBlock.innerHTML = '';
        const letters = ['a', 'b', 'c', 'd'];
        Object.entries(q.options || {}).forEach(([key, text]) => {
          const div = document.createElement('div');
          div.className = 'option';
          div.dataset.option = key;
          div.innerHTML = key + ') ' + escapeAndBold(text);
          div.addEventListener('click', () => {
            mcBlock.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
            div.classList.add('selected');
            selectedMc = key;
          });
          mcBlock.appendChild(div);
        });
        selectedMc = null;
      } else {
        document.getElementById('openBlock').classList.remove('hidden');
        document.getElementById('openInput').focus();
      }
    }

    let selectedMc = null;

    function submitAnswer() {
      const q = currentQuestions[currentIndex];
      let correct = false;

      if (q.type === 'mc') {
        correct = selectedMc === q.correct_option;
        document.getElementById('mcBlock').querySelectorAll('.option').forEach(o => {
          o.classList.remove('selected');
          if (o.dataset.option === q.correct_option) o.classList.add('correct');
          else if (o.dataset.option === selectedMc && !correct) o.classList.add('wrong');
        });
      } else {
        const userAnswer = document.getElementById('openInput').value.trim();
        correct = answerMatches(userAnswer, q.answers || []);
      }

      if (correct) score++; else {
        wrongIndices.push(currentIndex);
        if (q.topic) wrongTopics.add(q.topic);
      }
      saveMemoryBankEntry(questionHash(q), correct);

      const correctAnswerText = q.type === 'mc' ? (q.options && q.options[q.correct_option]) : (q.answers && q.answers[0]);
      let explanationHtml = escapeAndBold(q.explanation || '');
      if ((q.topicTitle || q.topic) && explanationHtml) {
        const topicLabel = q.topicTitle || getTopicLabelForDisplay(q.topic);
        explanationHtml = '<span class="topic-label">' + topicLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + ':</span> ' + explanationHtml;
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

    function nextQuestion() {
      currentIndex++;
      if (currentIndex >= currentQuestions.length) {
        finishQuiz();
        return;
      }
      showQuestion();
    }

    function buildSpellingCorrectAnswersHtml() {
      if (!currentTopic || currentTopic.id !== 'spelling' || wrongIndices.length === 0) return '';
      const lines = [];
      wrongIndices.forEach(i => {
        const q = currentQuestions[i];
        const correct = q.type === 'mc' ? (q.options && q.options[q.correct_option]) : (q.answers && q.answers[0]);
        if (correct) lines.push('<p style="margin: 0.5rem 0;"><strong>Correct:</strong> ' + escapeAndBold(correct) + '</p>');
      });
      return lines.join('');
    }

    function finishQuiz() {
      if (!isRetryRound) saveScore(currentSetId, currentSetTitle, score, currentQuestions.length);
      document.getElementById('quizScreen').classList.add('hidden');
      const isSpellingWithWrong = currentTopic && currentTopic.id === 'spelling' && wrongIndices.length > 0;
      const correctAnswersHtml = isSpellingWithWrong ? buildSpellingCorrectAnswersHtml() : '';
      if (coursePhase) {
        document.getElementById('sectionCompleteTitle').textContent = coursePart === 1 ? 'Part 1 complete' : (currentSetTitle + ' – complete');
        document.getElementById('sectionCompleteScore').textContent = 'Score: ' + score + ' / ' + currentQuestions.length;
        const sectionNextStepWrap = document.getElementById('sectionCompleteNextStepWrap');
        const sectionNextStepEl = document.getElementById('sectionCompleteNextStep');
        const sectionRetryWrap = document.getElementById('sectionCompleteRetryWrap');
        const sectionFurtherWrap = document.getElementById('sectionCompleteFurtherPracticeWrap');
        if (coursePart === 1) {
          sectionNextStepEl.textContent = 'Suggested next step: Guided Practice';
          sectionNextStepWrap.classList.remove('hidden');
          sectionRetryWrap.classList.toggle('hidden', wrongIndices.length === 0);
          sectionFurtherWrap.classList.add('hidden');
        } else {
          sectionNextStepWrap.classList.add('hidden');
          sectionNextStepEl.textContent = '';
          sectionRetryWrap.classList.toggle('hidden', wrongIndices.length === 0);
          sectionFurtherWrap.classList.remove('hidden');
        }
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
        document.getElementById('sectionCompleteNextBtn').textContent = coursePart === 1 ? 'Menu' : (part2Order.indexOf(coursePhase) < part2Order.length - 1 ? 'Next section' : 'Menu');
      } else {
        document.getElementById('resultScreen').classList.remove('hidden');
        document.getElementById('resultScore').textContent = `Score: ${score} / ${currentQuestions.length}`;
        document.getElementById('resultNextStepWrap').classList.add('hidden');
        document.getElementById('resultNextStep').textContent = '';
        document.getElementById('ruleSummary').textContent = summary;
        document.getElementById('retryWrongBtn').classList.toggle('hidden', wrongIndices.length === 0);
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
        if (quizMode === 'diagnostic' && wrongTopics.size > 0) {
          reviewBlock.classList.remove('hidden');
          reviewList.innerHTML = '';
          wrongTopics.forEach(topicId => {
            const t = topics.find(x => x.id === topicId);
            const title = getTopicTitle(topicId);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'secondary';
            btn.textContent = 'Revise: ' + title;
            btn.addEventListener('click', () => {
              if (t) currentTopic = t;
              quizMode = 'normal';
              applyTopic();
              renderMenu();
            });
            reviewList.appendChild(btn);
          });
        } else {
          reviewBlock.classList.add('hidden');
          reviewList.innerHTML = '';
        }
      }
    }

    function retryWrong() {
      const toRetry = wrongIndices.map(i => currentQuestions[i]);
      currentQuestions = toRetry;
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = true;
      document.getElementById('resultScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    }

    try {
    document.getElementById('startBtn').addEventListener('click', startQuiz);
    document.getElementById('startPart1Btn').addEventListener('click', startPart1);
    document.getElementById('startPart2Btn').addEventListener('click', startPart2);
    document.getElementById('openPracticeSetupBtn').addEventListener('click', () => {
      if (!hasValidTopicSelected()) {
        alert('Please choose a topic first.');
        return;
      }
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.remove('hidden');
      const topicEl = document.getElementById('practiceSetupTopic');
      if (topicEl) topicEl.textContent = currentTopic ? toTitleCase(currentTopic.title || currentTopic.id) : '';
    });
    document.getElementById('practiceSetupBackBtn').addEventListener('click', () => {
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.remove('hidden');
    });
    document.getElementById('openTopicSelectBtn').addEventListener('click', () => { returnToAfterTopicSelect = null; showTopicSelectMenu(); });
    document.getElementById('topicSelectBackBtn').addEventListener('click', () => { returnToAfterTopicSelect = null; showMainMenu(); });
    document.getElementById('topicSelectBackToPrevBtn').addEventListener('click', () => {
      if (returnToAfterTopicSelect === 'exam_cloze_feedback') {
        document.getElementById('menuScreen').classList.add('hidden');
        document.getElementById('examClozeTestScreen').classList.remove('hidden');
        document.getElementById('examClozeFeedbackBlock').classList.remove('hidden');
      }
    });
    document.getElementById('openExamPracticeBtn').addEventListener('click', showExamPracticeMenu);
    document.getElementById('examPracticeBackBtn').addEventListener('click', showMainMenu);
    document.getElementById('examOpenClozeBtn').addEventListener('click', showOpenClozeMenu);
    document.getElementById('openClozePart1Btn').addEventListener('click', startPart1);
    document.getElementById('openClozePart2Btn').addEventListener('click', startPart2);
    document.getElementById('openClozeBackBtn').addEventListener('click', () => {
      examMode = null;
      document.getElementById('menuOpenCloze').classList.add('hidden');
      document.getElementById('menuExamPractice').classList.remove('hidden');
    });
    document.getElementById('openClozeMainMenuBtn').addEventListener('click', showMainMenu);
    document.getElementById('openClozeEasyBtn').addEventListener('click', () => loadAndStartExamCloze('easy'));
    document.getElementById('openClozeMediumBtn').addEventListener('click', () => loadAndStartExamCloze('medium'));
    document.getElementById('openClozeHardBtn').addEventListener('click', () => loadAndStartExamCloze('hard'));
    document.getElementById('openClozeExpertBtn').addEventListener('click', () => loadAndStartExamCloze('expert'));
    const examClozeTestSelectBackBtn = document.getElementById('examClozeTestSelectBackBtn');
    if (examClozeTestSelectBackBtn) examClozeTestSelectBackBtn.addEventListener('click', () => {
      document.getElementById('menuExamClozeTestSelect').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.remove('hidden');
    });
    const examClozeTestSelectList = document.getElementById('examClozeTestSelectList');
    if (examClozeTestSelectList) examClozeTestSelectList.addEventListener('click', function(e) {
      const btn = e.target && e.target.closest && e.target.closest('button[data-index]');
      if (!btn || !currentExamClozeTests) return;
      const index = parseInt(btn.dataset.index, 10);
      if (!isNaN(index) && index >= 0 && index < currentExamClozeTests.length) startExamClozeTestByIndex(index);
    });
    const examClozeTestSelectRandomBtn = document.getElementById('examClozeTestSelectRandomBtn');
    if (examClozeTestSelectRandomBtn) examClozeTestSelectRandomBtn.addEventListener('click', () => {
      if (!currentExamClozeTests || currentExamClozeTests.length === 0) return;
      startExamClozeTestByIndex(Math.floor(Math.random() * currentExamClozeTests.length));
    });
    const examClozeBackToTestListBtn = document.getElementById('examClozeBackToTestListBtn');
    if (examClozeBackToTestListBtn) examClozeBackToTestListBtn.addEventListener('click', showExamClozeTestSelectScreen);
    document.getElementById('openClozeModesBackBtn').addEventListener('click', () => {
      document.getElementById('menuOpenClozeModes').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.remove('hidden');
    });
    document.getElementById('examClozeSubmitBtn').addEventListener('click', submitExamClozeTest);
    document.getElementById('examClozeNextBtn').addEventListener('click', onExamClozeNext);
    document.getElementById('examClozeExitBtn').addEventListener('click', onExamClozeExit);
    document.getElementById('examClozeFeedbackBlock').addEventListener('click', function(e) {
      const link = e.target && e.target.closest('.exam-cloze-topic-link');
      if (!link) return;
      e.preventDefault();
      const topicId = link.getAttribute('data-topic-id');
      if (!topicId || !topics || !topics.length) return;
      const idx = topics.findIndex(t => t.id === topicId);
      if (idx === -1) return;
      currentTopic = topics[idx];
      applyTopic();
      returnToAfterTopicSelect = 'exam_cloze_feedback';
      document.getElementById('examClozeTestScreen').classList.add('hidden');
      document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
      document.getElementById('menuScreen').classList.remove('hidden');
      showTopicSelectMenu();
      const sel = document.getElementById('topicSelect');
      if (sel) sel.value = String(idx);
    });
    document.getElementById('examWordFormationBtn').addEventListener('click', () => { alert('Word Formation – coming soon.'); });
    document.getElementById('examSentenceTransformationBtn').addEventListener('click', () => { alert('Sentence Transformation – coming soon.'); });
    document.getElementById('openDiagnosticSetupBtn').addEventListener('click', () => {
      document.getElementById('menuMain').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuExamPractice').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.add('hidden');
      document.getElementById('menuOpenClozeModes').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.add('hidden');
      document.getElementById('menuDiagnosticSetup').classList.remove('hidden');
    });
    document.getElementById('diagnosticSetupBackBtn').addEventListener('click', () => {
      document.getElementById('menuDiagnosticSetup').classList.add('hidden');
      document.getElementById('menuMain').classList.remove('hidden');
    });
    document.getElementById('diagnostic20Btn').addEventListener('click', () => startDiagnostic(20));
    document.getElementById('diagnostic50Btn').addEventListener('click', () => startDiagnostic(50));
    document.getElementById('diagnostic100Btn').addEventListener('click', () => startDiagnostic(100));
    document.getElementById('introNextBtn').addEventListener('click', () => {
      if (introSectionIndex < (courseCurriculum?.intro?.sections?.length || 1) - 1) {
        showIntroSection(introSectionIndex + 1);
      } else {
        document.getElementById('introScreen').classList.add('hidden');
        if (coursePart === 1) {
          const checkQuestions = (courseCurriculum?.check?.questions || []);
          if (checkQuestions.length > 0) startCourseSection('check');
          else renderMenu();
        }
      }
    });
    document.getElementById('sectionCompleteNextBtn').addEventListener('click', advanceCourseToNext);
    document.getElementById('sectionCompleteGuidedPracticeBtn').addEventListener('click', () => {
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      startPart2();
    });
    document.getElementById('sectionCompleteRetryWrongBtn').addEventListener('click', () => {
      const toRetry = wrongIndices.map(i => currentQuestions[i]);
      currentQuestions = toRetry;
      currentIndex = 0;
      score = 0;
      wrongIndices = [];
      isRetryRound = true;
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      document.getElementById('quizScreen').classList.remove('hidden');
      document.getElementById('exitQuizBtn').textContent = 'Exit';
      showQuestion();
    });
    document.getElementById('sectionCompleteFurtherPracticeBtn').addEventListener('click', () => {
      document.getElementById('sectionCompleteScreen').classList.add('hidden');
      document.getElementById('menuScreen').classList.remove('hidden');
      document.getElementById('menuMain').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.remove('hidden');
      const topicEl = document.getElementById('practiceSetupTopic');
      if (topicEl) topicEl.textContent = currentTopic ? toTitleCase(currentTopic.title || currentTopic.id) : '';
    });
    document.getElementById('resultFurtherPracticeBtn').addEventListener('click', () => {
      document.getElementById('resultScreen').classList.add('hidden');
      document.getElementById('menuScreen').classList.remove('hidden');
      document.getElementById('menuMain').classList.add('hidden');
      document.getElementById('menuTopicSelect').classList.add('hidden');
      document.getElementById('menuPracticeSetup').classList.remove('hidden');
      const topicEl = document.getElementById('practiceSetupTopic');
      if (topicEl) topicEl.textContent = currentTopic ? toTitleCase(currentTopic.title || currentTopic.id) : '';
    });
    document.getElementById('submitBtn').addEventListener('click', submitAnswer);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.getElementById('retryWrongBtn').addEventListener('click', retryWrong);
    document.getElementById('backToMenuBtn').addEventListener('click', renderMenu);
    document.getElementById('exitQuizBtn').addEventListener('click', renderMenu);
    document.getElementById('introExitBtn').addEventListener('click', renderMenu);
    document.getElementById('viewPrepositionsListBtn')?.addEventListener('click', () => showPrepositionsList('menu'));
    document.getElementById('viewPrepositionsListFromIntroBtn').addEventListener('click', () => showPrepositionsList('intro'));
    document.getElementById('prepositionsListBackBtn').addEventListener('click', hidePrepositionsList);
    document.getElementById('prepositionsListPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('viewPhrasalVerbsDictionaryBtn')?.addEventListener('click', () => showPhrasalVerbsDictionary('menu'));
    document.getElementById('viewPhrasalVerbsFromIntroBtn').addEventListener('click', () => showPhrasalVerbsDictionary('intro'));
    document.getElementById('phrasalVerbsDictionaryBackBtn').addEventListener('click', hidePhrasalVerbsDictionary);
    document.getElementById('phrasalVerbsDictionaryPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('openReferenceBtn').addEventListener('click', showReference);
    document.getElementById('referenceBackBtn').addEventListener('click', onReferenceBackClick);
    document.getElementById('referencePrintBtn').addEventListener('click', () => window.print());
    document.getElementById('openInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      const quizScreen = document.getElementById('quizScreen');
      if (!quizScreen || quizScreen.classList.contains('hidden')) return;
      const fb = document.getElementById('feedbackBlock');
      if (fb && !fb.classList.contains('hidden')) return;
      const q = currentQuestions && currentQuestions[currentIndex];
      if (!q) return;
      if (q.type === 'mc' && selectedMc != null) { e.preventDefault(); submitAnswer(); }
    });

    document.getElementById('topicSelect').addEventListener('change', () => {
      const val = document.getElementById('topicSelect').value;
      if (val === '' || val === '-1') return;
      const idx = parseInt(val, 10);
      if (topics[idx] != null) {
        currentTopic = topics[idx];
        applyTopic();
        const summaryEl = document.getElementById('scoresSummary');
        const lastBest = getLastBest(currentTopic.id);
        if (lastBest.last) {
          summaryEl.textContent = 'Last: ' + lastBest.last[0] + '/' + lastBest.last[1] +
            (lastBest.best && (lastBest.best[0] !== lastBest.last[0] || lastBest.best[1] !== lastBest.last[1])
              ? '  •  Best: ' + lastBest.best[0] + '/' + lastBest.best[1] : '');
        } else {
          summaryEl.textContent = '';
        }
      }
    });

    } catch (err) {
      console.error('Quiz setup failed:', err);
      alert('Quiz setup failed. Open the Developer Console (F12) and check the Console tab for details.\n\nError: ' + (err && err.message));
    }

    (async function init() {
      try {
        const mRes = await fetch(new URL('topics.json?v=5', getBaseUrl()));
        if (mRes.ok) {
          const mData = await mRes.json();
          topics = mData.topics || [];
          if (topics.length > 0) {
            currentTopic = topics[0];
            const sel = document.getElementById('topicSelect');
            sel.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '-1';
            placeholder.textContent = 'Choose a topic';
            placeholder.selected = true;
            sel.appendChild(placeholder);
            topics.forEach((t, i) => {
              const opt = document.createElement('option');
              opt.value = i;
              opt.textContent = toTitleCase(t.title || t.id);
              sel.appendChild(opt);
            });
          }
        }
        await loadQuestions();
        renderMenu();
      } catch (err) {
        topics = [
          { id: 'auxiliary_verbs', title: 'Auxiliary Verbs', curriculum: 'curriculum_auxiliary_verbs.json', questions_key: 'auxiliary_verbs' },
          { id: 'comparatives', title: 'Comparatives and Superlatives', curriculum: 'curriculum_comparatives.json', questions_key: 'comparatives' },
          { id: 'conjunctions_linkers', title: 'Conjunctions and Linkers', curriculum: 'curriculum_conjunctions_linkers.json', questions_key: 'conjunctions_linkers' },
          { id: 'articles', title: 'Determiners: Articles (a, an, the, ∅)', curriculum: 'curriculum_articles.json', questions_key: 'articles' },
          { id: 'quantifiers', title: 'Determiners: Quantifiers', curriculum: 'curriculum_quantifiers.json', questions_key: 'quantifiers' },
          { id: 'infinitive_ing', title: 'Infinitive and -ing Form', curriculum: 'curriculum_infinitive_ing.json', questions_key: 'infinitive_ing' },
          { id: 'modal_verbs', title: 'Modal Verbs', curriculum: 'curriculum_modal_verbs.json', questions_key: 'modal_verbs' },
          { id: 'countable_uncountable', title: 'Nouns: Uncountable and Always-Plural', curriculum: 'curriculum_countable_uncountable.json', questions_key: 'countable_uncountable' },
          { id: 'passives', title: 'Passives', curriculum: 'curriculum_passives.json', questions_key: 'passives' },
          { id: 'phrasal_verbs', title: 'Phrasal Verbs', curriculum: 'curriculum_phrasal_verbs.json', questions_key: 'phrasal_verbs' },
          { id: 'prepositions', title: 'Prepositions', curriculum: 'curriculum_prepositions.json', questions_key: 'prepositions' },
          { id: 'punctuation', title: 'Punctuation and Capitalisation', curriculum: 'curriculum_punctuation.json', questions_key: 'punctuation' },
          { id: 'relative_pronouns', title: 'Relative Pronouns', curriculum: 'curriculum_relative_pronouns.json', questions_key: 'relative_pronouns' },
          { id: 'reported_speech', title: 'Reported Speech', curriculum: 'curriculum_reported_speech.json', questions_key: 'reported_speech' },
          { id: 'spelling', title: 'Spelling', curriculum: 'curriculum_spelling.json', questions_key: 'spelling' },
          { id: 'conditionals', title: 'Tenses: Conditionals (Zero, First, Second, Third)', curriculum: 'curriculum_conditionals.json', questions_key: 'conditionals' },
          { id: 'tenses_general', title: 'Tenses: General', curriculum: 'curriculum_tenses_general.json', questions_key: 'tenses_general' },
          { id: 'past_perfect', title: 'Tenses: Past Perfect Simple and Past Perfect Continuous', curriculum: 'curriculum_past_perfect.json', questions_key: 'past_perfect' },
          { id: 'past_simple_continuous', title: 'Tenses: Past Simple and Past Continuous', curriculum: 'curriculum_past_simple_continuous.json', questions_key: 'past_simple_continuous' },
          { id: 'past_simple_present_perfect', title: 'Tenses: Past Simple vs Present Perfect', curriculum: 'curriculum_past_simple_present_perfect.json', questions_key: 'past_simple_present_perfect' },
          { id: 'present_perfect', title: 'Tenses: Present Perfect Simple vs Continuous', curriculum: 'curriculum.json', questions_key: 'sets' },
          { id: 'will_going_to', title: 'Tenses: Will and Going To', curriculum: 'curriculum_will_going_to.json', questions_key: 'will_going_to' },
          { id: 'verb_subject_agreement', title: 'Verb–Subject Agreement', curriculum: 'curriculum_verb_subject_agreement.json', questions_key: 'verb_subject_agreement' },
          { id: 'word_order', title: 'Word Order in Sentences', curriculum: 'curriculum_word_order.json', questions_key: 'word_order' }
        ];
        currentTopic = topics[0];
        const sel = document.getElementById('topicSelect');
        sel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '-1';
        placeholder.textContent = 'Choose a topic';
        placeholder.selected = true;
        sel.appendChild(placeholder);
        topics.forEach((t, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = toTitleCase(t.title || t.id);
          sel.appendChild(opt);
        });
        document.getElementById('scoresSummary').textContent = 'Could not load manifest. Topic list loaded from fallback. Double-click start_server.bat and open http://localhost:8080 for full features.';
        await loadQuestions().catch(() => {});
        renderMenu();
      }
    })();
  