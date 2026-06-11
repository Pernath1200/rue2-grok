export const DATA_VERSION = 40;  // v41 bundle - forcing update for user

export const SCREEN_IDS = [
  'menuScreen','quizScreen','introScreen','sectionCompleteScreen',
  'resultScreen','examClozeTestScreen','examTransformTestScreen',
  'prepositionsListScreen','phrasalVerbsDictionaryScreen','referenceScreen'
];

export const MENU_PANEL_IDS = [
  'menuMain','menuExamPractice','menuOpenCloze','menuOpenClozeStep3',
  'menuOpenClozeFreeSetup','menuOpenClozeFurther','menuWordFormation',
  'menuWordFormationFurther','menuSentenceTransform','menuSentenceTransformFurther',
  'menuExamClozeTestSelect','menuOpenClozeModes','menuTopicSelect',
  'menuPracticeSetup','menuDiagnosticSetup',
  'menuTreeOverview',  // Added for the new Grammar Tree view
  'menuRootPractice'   // Deep-link practice landing (#practice/root/... links)
];

export function showScreen(id) {
  SCREEN_IDS.forEach(function(sid) {
    var el = document.getElementById(sid);
    if (el) { el.classList.toggle('hidden', sid !== id); el.classList.remove('screen-enter'); }
  });
  var target = document.getElementById(id);
  if (target) { void target.offsetWidth; target.classList.add('screen-enter'); }
}

export function showMenuPanel(id) {
  MENU_PANEL_IDS.forEach(function(pid) {
    var el = document.getElementById(pid);
    if (el) el.classList.toggle('hidden', pid !== id);
  });

  // Central control for the global Back button visibility
  const backBtn = document.getElementById('navBackBtn');
  if (backBtn) {
    backBtn.style.display = (id === 'menuMain') ? 'none' : '';
  }
}

var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openOverlay(overlayId, triggerEl) {
  var overlay = document.getElementById(overlayId);
  overlay.classList.remove('hidden');
  overlay._triggerEl = triggerEl || document.activeElement;
  var first = overlay.querySelector(FOCUSABLE);
  if (first) first.focus();
  if (!overlay._trapBound) {
    overlay._trapBound = true;
    overlay.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab') return;
      var focusable = Array.from(overlay.querySelectorAll(FOCUSABLE));
      if (!focusable.length) return;
      var firstEl = focusable[0], lastEl = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      } else {
        if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    });
  }
}

export function closeOverlay(overlayId) {
  var overlay = document.getElementById(overlayId);
  overlay.classList.add('hidden');
  if (overlay._triggerEl) { overlay._triggerEl.focus(); overlay._triggerEl = null; }
}

export function escapeAndBold(str) {
  if (str == null || str === '') return '';
  const strikes = [];
  let s = String(str).replace(/~~([\s\S]+?)~~/g, function(_, inner) {
    strikes.push(inner);
    return '\uE000ST' + (strikes.length - 1) + '\uE000';
  });
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  strikes.forEach(function(inner, i) {
    const token = '\uE000ST' + i + '\uE000';
    s = s.split(token).join('<span class="intro-strike">' + escapeAndBold(inner) + '</span>');
  });
  return s;
}

/**
 * Intro `content` with optional links:
 * - [[topic:topic_id|Label]] → navigates to that grammar topic (topic select screen).
 * - [[preplist|Label]] → opens Reference prepositions list (printable); return path "intro".
 * - [[ref|Label]] → opens Reference index (all printable lists); return path "intro".
 * - [[reflinkers|Label]] → opens Reference "Linkers and Conjunctions"; return path "intro".
 * - ~~text~~ → strikethrough (wrong examples); nest ** / * inside the tildes if needed.
 */
export function renderIntroContentHtml(str) {
  if (str == null || str === '') return '';
  const markers = [];
  let s = String(str)
    .replace(/\[\[topic:([a-z0-9_]+)\|([^\]]+?)\]\]/gi, function(_, id, label) {
      markers.push({ type: 'topic', id: String(id).toLowerCase(), label: label });
      return '__ILINK_' + (markers.length - 1) + '__';
    })
    .replace(/\[\[preplist\|([^\]]+?)\]\]/gi, function(_, label) {
      markers.push({ type: 'preplist', label: label });
      return '__ILINK_' + (markers.length - 1) + '__';
    })
    .replace(/\[\[ref\|([^\]]+?)\]\]/gi, function(_, label) {
      markers.push({ type: 'refindex', label: label });
      return '__ILINK_' + (markers.length - 1) + '__';
    })
    .replace(/\[\[reflinkers\|([^\]]+?)\]\]/gi, function(_, label) {
      markers.push({ type: 'reflinkers', label: label });
      return '__ILINK_' + (markers.length - 1) + '__';
    });
  // Lines starting "- " render as real list items; other lines keep <br>
  // separation (no <br> straight after a list — the list carries its margin).
  const lines = escapeAndBold(s).split('\n');
  let html = '';
  let list = null;
  let prevWasText = false;
  lines.forEach(function(line) {
    const m = /^\s*-\s+(.*)$/.exec(line);
    if (m) {
      if (!list) list = [];
      list.push('<li>' + m[1] + '</li>');
      return;
    }
    if (list) { html += '<ul class="intro-list">' + list.join('') + '</ul>'; list = null; prevWasText = false; }
    html += (prevWasText ? '<br>' : '') + line;
    prevWasText = true;
  });
  if (list) html += '<ul class="intro-list">' + list.join('') + '</ul>';
  markers.forEach(function(m, i) {
    const token = '__ILINK_' + i + '__';
    if (m.type === 'topic') {
      const idEsc = String(m.id).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      html = html.split(token).join(
        '<a href="#" class="intro-content-link intro-topic-link" data-topic-id="' + idEsc + '">' + escapeAndBold(m.label) + '</a>'
      );
    } else if (m.type === 'refindex') {
      html = html.split(token).join(
        '<a href="#" class="intro-content-link intro-ref-index-link">' + escapeAndBold(m.label) + '</a>'
      );
    } else if (m.type === 'reflinkers') {
      html = html.split(token).join(
        '<a href="#" class="intro-content-link intro-reflinkers-link">' + escapeAndBold(m.label) + '</a>'
      );
    } else {
      html = html.split(token).join(
        '<a href="#" class="intro-content-link intro-preplist-link">' + escapeAndBold(m.label) + '</a>'
      );
    }
  });
  return html;
}

export function normalize(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function toTitleCase(s) {
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

export function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

var _fetchBaseHref = null;

/** When true, curriculum/topics/questions load from the parent directory (e.g. _exam_app/ → repo root). */
export function setFetchBaseToParent(useParent) {
  _fetchBaseHref = useParent ? new URL('..', window.location.href).href : null;
}

export function getBaseUrl() {
  return _fetchBaseHref || new URL('.', window.location.href).href;
}

export async function fetchJSON(file, opts) {
  var version = (opts && opts.version != null) ? opts.version : DATA_VERSION;
  var base = (opts && opts.samePageDir)
    ? new URL('.', window.location.href).href
    : getBaseUrl();
  var url = new URL(file + (version ? '?v=' + version : ''), base).href;
  var fetchOpts = (opts && opts.noStore) ? { cache: 'no-store' } : undefined;
  var res = await fetch(url, fetchOpts);
  if (!res.ok) throw new Error('Network error loading ' + file);
  var text = await res.text();
  if (text.trim().startsWith('<!')) throw new Error('Got HTML instead of JSON for ' + file);
  return JSON.parse(text);
}

export function renderScoreChart(loadScoresFn) {
  var data = loadScoresFn();
  var history = data.history || [];
  var chartWrap = document.getElementById('recentScoresChart');
  var barsEl = document.getElementById('scoreChartBars');
  if (!chartWrap || !barsEl) return;
  if (history.length < 2) { chartWrap.classList.add('hidden'); return; }
  var recent = history.slice(-10);
  barsEl.innerHTML = '';
  recent.forEach(function(entry) {
    var pct = entry.total ? Math.round(100 * entry.score / entry.total) : 0;
    var h = Math.max(4, pct);
    var col = document.createElement('div');
    col.className = 'score-chart-col';
    var track = document.createElement('div');
    track.className = 'score-chart-bar-track';
    var bar = document.createElement('div');
    bar.className = 'score-bar';
    bar.style.height = h + '%';
    bar.title = (entry.set_title || 'Quiz') + ': ' + entry.score + '/' + entry.total + ' (' + pct + '%)';
    track.appendChild(bar);
    var meta = document.createElement('div');
    meta.className = 'score-chart-meta';
    var scoreLine = document.createElement('div');
    scoreLine.className = 'score-chart-score';
    scoreLine.textContent = entry.total != null ? entry.score + '/' + entry.total : '\u2014';
    var dateLine = document.createElement('div');
    dateLine.className = 'score-chart-date';
    dateLine.textContent = entry.date ? new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '\u2014';
    meta.appendChild(scoreLine);
    meta.appendChild(dateLine);
    col.appendChild(track);
    col.appendChild(meta);
    barsEl.appendChild(col);
  });
  chartWrap.classList.remove('hidden');
}

export function applyTheme(themeClass) {
  document.body.classList.remove('theme-cursor', 'theme-light');
  if (themeClass) document.body.classList.add(themeClass);
  var wrap = document.getElementById('themeToggle');
  if (wrap) {
    wrap.querySelectorAll('button').forEach(function(b) { b.classList.toggle('active', b.dataset.theme === themeClass); });
  }
  try { localStorage.setItem('rue2_theme', themeClass); } catch (e) {}
}
